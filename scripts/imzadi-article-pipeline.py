#!/usr/bin/env python3
"""ImZaDi article pipeline. Cover: pdfimages (-all/-png/-j) then PPM convert; pdftoppm last; AI only with --ai-cover.

Requires: poppler-utils (pdfimages, pdftoppm, pdftotext). ImageMagick optional —
PPM/PGM/PBM conversion tries Pillow, GraphicsMagick (gm), ffmpeg, then ImageMagick convert.

Env IMZADI_API default http://localhost:3004
CLI: python3 imzadi-article-pipeline.py <story-dir> [--recreate] [--tags=A,B] [--dry-run] [--ai-cover]
     python3 imzadi-article-pipeline.py --root <parent> [...]
Jennifer:
  python3 scripts/imzadi-article-pipeline.py /home/ginger/projects/imzadi/catatumbo --dry-run --tags=Sci-Fi,Speculative
  IMZADI_API=https://imzadi.love python3 scripts/imzadi-article-pipeline.py --root /home/ginger/projects/imzadi --tags=Sci-Fi,Speculative
  IMZADI_API=http://imzadi-v2-web:3000 python3 scripts/imzadi-article-pipeline.py /home/ginger/projects/imzadi/catatumbo --tags=Sci-Fi,Speculative --recreate
"""
from __future__ import annotations
import os,re,sys,json,time,uuid,base64,shutil,tempfile,subprocess
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
try: import requests
except ImportError: requests=None
API=os.environ.get("IMZADI_API","http://localhost:3004").rstrip("/")
UP,POSTS,TAGS=f"{API}/api/media/upload",f"{API}/api/posts",f"{API}/api/tags"
IMG={".png",".jpg",".jpeg",".webp",".gif"}; AUD={".m4a",".mp3"}; PDF={".pdf"}; SKIP={"_extract"}
def run(c,**k):
 r=subprocess.run(c,shell=True,capture_output=True,text=True,**k); return r.stdout,r.stderr,r.returncode
def slugify(t): return re.sub(r"[^a-z0-9]+","-",t.lower()).strip("-")
def api_json(url,data=None,method=None):
 body=json.dumps(data).encode() if data is not None else None
 req=Request(url,data=body,method=method); req.add_header("Content-Type","application/json")
 try:
  with urlopen(req,timeout=60) as r: return json.loads(r.read().decode())
 except HTTPError as e: print(f"  HTTP {e.code}: {e.read().decode()[:300]}"); return None
 except Exception as e: print(f"  Error: {e}"); return None
def get_or_create_tags(names):
 ids=[]
 for n in names or []:
  r=api_json(TAGS,data={"name":n.strip()},method="POST")
  if r and r.get("success"): t=r["tags"][0]; ids.append(t["id"]); print(f"  Tag: {t['name']} ({t['id']})")
  time.sleep(.25)
 return ids
def extract_excerpt(pdf,mn=450,mx=600):
 out,err,rc=run(f"pdftotext {str(pdf)!r} -")
 if rc: print(f"  pdftotext failed: {err}"); return None
 foot=re.compile(r"^(?:\d+|Catatumbo\s+\d+|[A-Za-z][A-Za-z0-9 _-]{0,40}\s+\d{1,3})\s*$",re.I)
 cl=[]
 for line in out.splitlines():
  s=line.strip()
  if not s:
   if cl and cl[-1]!="": cl.append(""); continue
  if foot.match(s): continue
  if re.match(r"^(Spanish|Italian|Overall|Lets delve|Let's delve)",s,re.I): break
  cl.append(s)
 parts=[]
 for line in cl:
  if line=="":
   if parts and not parts[-1].endswith("\n"): parts.append("\n"); continue
  parts.append(line if not parts or parts[-1].endswith("\n") else " "+line)
 full=re.sub(r"[ \t]+"," ","".join(parts).strip()); full=re.sub(r"\n{3,}","\n\n",full)
 if not full: return None
 if len(full)<=mx: return full
 best=None
 for m in re.finditer(r"[.!?...][\"')\]]?\s",full[:mx+1]):
  if m.end()>=mn: best=m.end()
 if best: return full[:best].strip()
 cut=full[:mx].rsplit(" ",1)[0]; return (cut or full[:mx]).strip()+"..."
PROMPTS={"romance":"Romantic cover: {context}. NO text.","thriller":"Thriller cover: {context}. NO text.","scifi":"Sci-fi cover: {context}. NO text.","family":"Literary cover: {context}. NO text.","fantasy":"Fantasy cover: {context}. NO text.","default":"Story cover: {context}. NO text."}
KW={"romance":["love","couple","heart"],"thriller":["kill","murder","dark","crime"],"scifi":["quantum","cyber","ai","future","catatumbo"],"family":["family","mother","father"],"fantasy":["magic","dragon","spell"]}
def _stype(n,e):
 t=f"{n} {e or ''}".lower(); sc={k:sum(1 for w in v if w in t) for k,v in KW.items()}
 return "default" if max(sc.values())==0 else max(sc,key=sc.get)
def ai_cover(name,excerpt,out):
 if requests is None or not os.environ.get("OPENROUTER_API_KEY"): print("  AI cover unavailable"); return False
 ctx=re.sub(r"\s+"," ",re.sub(r"[\U00010000-\U0010ffff]","",excerpt or name)).strip()[:120]
 prompt=PROMPTS[_stype(name,excerpt)].format(context=ctx or name)
 try:
  resp=requests.post("https://openrouter.ai/api/v1/chat/completions",headers={"Authorization":f"Bearer {os.environ['OPENROUTER_API_KEY']}","Content-Type":"application/json","HTTP-Referer":API,"X-Title":"ImZaDi"},json={"model":"google/gemini-2.5-flash-image","messages":[{"role":"user","content":f"Generate book cover. {prompt} Image only."}],"max_tokens":1024},timeout=120)
  if resp.status_code!=200: print(f"  OpenRouter {resp.status_code}"); return False
  b64=resp.json()["choices"][0]["message"]["images"][0]["image_url"]["url"].split("base64,",1)[1]
  out.write_bytes(base64.b64decode(b64)); print(f"  AI cover saved"); return True
 except Exception as e: print(f"  AI cover error: {e}"); return False
def usable(p,mn=8000): return p.is_file() and p.stat().st_size>=mn and p.suffix.lower() in IMG|{".ppm",".pbm",".pgm"}
def _ppm_to_png(src, dest):
 """Convert PPM/PGM/PBM to PNG without requiring ImageMagick.
 Order: Pillow -> gm convert -> ffmpeg -> ImageMagick convert.
 Returns True on success.
 """
 dest=Path(dest); src=Path(src)
 try:
  from PIL import Image
  Image.open(src).save(dest, format="PNG")
  if usable(dest): print(f"  PPM->PNG via Pillow ({src.name})"); return True
 except Exception: pass
 if shutil.which("gm"):
  if run(f"gm convert {str(src)!r} {str(dest)!r}")[2]==0 and usable(dest):
   print(f"  PPM->PNG via gm ({src.name})"); return True
 if shutil.which("ffmpeg"):
  if run(f"ffmpeg -y -i {str(src)!r} {str(dest)!r}")[2]==0 and usable(dest):
   print(f"  PPM->PNG via ffmpeg ({src.name})"); return True
 if shutil.which("convert"):
  if run(f"convert {str(src)!r} {str(dest)!r}")[2]==0 and usable(dest):
   print(f"  PPM->PNG via ImageMagick convert ({src.name})"); return True
 return False

def _pick_embed(cands):
 use=[p for p in cands if usable(p)]
 if not use: return None
 return max(use,key=lambda p:p.stat().st_size)

def extract_cover(pdf,work):
 """Extract embedded cover from PDF.
 Prefer real embeds via pdfimages (-all, -png, -j). Convert leftover PPM/PGM/PBM
 without ImageMagick when possible. pdftoppm page raster is LAST resort.
 Containers need poppler-utils; ImageMagick is optional.
 """
 work.mkdir(parents=True,exist_ok=True); stem=pdf.stem; final=work/f"{stem}-cover.png"
 # Clear prior embed attempts in work
 for old in work.glob(f"{stem}-emb*"):
  try: old.unlink()
  except OSError: pass

 attempts=[
  ("pdfimages -all", f"pdfimages -all {str(pdf)!r} {str(work/f'{stem}-emb')!r}"),
  ("pdfimages -png", f"pdfimages -png {str(pdf)!r} {str(work/f'{stem}-emb')!r}"),
  ("pdfimages -j", f"pdfimages -j {str(pdf)!r} {str(work/f'{stem}-emb')!r}"),
 ]
 for label,cmd in attempts:
  for old in work.glob(f"{stem}-emb*"):
   try: old.unlink()
   except OSError: pass
  out,err,rc=run(cmd)
  cands=sorted(work.glob(f"{stem}-emb*"))
  best=_pick_embed(cands)
  if not best:
   print(f"  {label}: no usable embeds (rc={rc})")
   continue
  ext=best.suffix.lower()
  if ext in IMG:
   final=work/f"{stem}-cover{ext}"; shutil.copy2(best,final)
   print(f"  Cover via {label}: {best.name} ({best.stat().st_size} bytes)")
   return final,label.replace(" ","-")
  # PPM/PGM/PBM — convert without relying on ImageMagick alone
  conv=work/f"{stem}-cover.png"
  if _ppm_to_png(best,conv):
   print(f"  Cover via {label}+PPM-convert: {best.name}")
   return conv,f"{label.replace(' ','-')}+ppm"
  print(f"  {label}: got {best.name} but PPM convert failed")

 for p in work.glob(f"{stem}-emb*"):
  try: p.unlink()
  except OSError: pass

 print("  Falling back to pdftoppm (last resort)...")
 run(f"pdftoppm -r 150 -png -f 1 -l 1 {str(pdf)!r} {str(work/stem)!r}")
 actual=work/f"{stem}-1.png"
 if not actual.exists(): actual=work/f"{stem}-01.png"
 if actual.exists(): actual.rename(final)
 if final.exists() and usable(final):
  print(f"  Cover via pdftoppm: {final.name} ({final.stat().st_size} bytes)")
  return final,"pdftoppm"
 print("  Cover extraction failed (none)")
 return None,"none"
def generate_cover(pdf,work,name=None,excerpt=None,use_ai=False):
 work=Path(work); work.mkdir(parents=True,exist_ok=True); stem=Path(pdf).stem
 if use_ai and name:
  ai=work/f"{stem}-ai-cover.png"
  if ai_cover(name,excerpt,ai) and usable(ai,10000): return ai,"ai-cover"
  if ai.exists():
   try: ai.unlink()
   except OSError: pass
  print("  AI cover unavailable; using PDF extraction...")
 return extract_cover(Path(pdf),work)
def list_files(d):
 pdfs,auds,imgs=[],[],[]
 for root,dirs,files in os.walk(d):
  dirs[:]=[x for x in dirs if x not in SKIP and not x.startswith(".")]
  rel=Path(root).relative_to(d)
  if any(p in SKIP for p in rel.parts): continue
  for name in files:
   path=Path(root)/name; 
   if not path.is_file(): continue
   low,ext=name.lower(),path.suffix.lower()
   if any(low.startswith(x) for x in ("pdf-cover","ai-cover")) and ext in IMG: continue
   if re.search(r"-cover\.(png|jpe?g|webp|gif)$",low): continue
   if ext in PDF: pdfs.append(path)
   elif ext in AUD: auds.append(path)
   elif ext in IMG: imgs.append(path)
 def pk(p):
  m=re.match(r"^(\d+)-(.+)$",p.name); return (0,int(m.group(1)),p.name) if m else (1,0,p.name)
 pdfs.sort(key=pk); auds.sort(key=lambda p:p.name.lower()); imgs.sort(key=lambda p:p.name.lower()); return pdfs,auds,imgs
def upload(path,typ,title,post_id=None,timeout=600):
 """Never pass post_id until post exists (pid-before-create fix)."""
 if not os.path.exists(path): print(f"  missing {path}"); return None
 fn=os.path.basename(path); sz=os.path.getsize(path)
 mime={".pdf":"application/pdf",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".m4a":"audio/mp4",".mp3":"audio/mpeg"}.get(os.path.splitext(path)[1].lower(),"application/octet-stream")
 print(f"  Uploading {fn} ({sz/1024/1024:.1f}MB) as {typ}...")
 try:
  data=Path(path).read_bytes(); b="----WebKitFormBoundary"+uuid.uuid4().hex; parts=[]
  def field(n,v): parts.append(f"--{b}\r\n".encode()); parts.append(f'Content-Disposition: form-data; name="{n}"\r\n\r\n'.encode()); parts.append(f"{v}\r\n".encode())
  field("type",typ); field("title",title or fn)
  if post_id: field("postId",post_id)
  parts += [f"--{b}\r\n".encode(), f'Content-Disposition: form-data; name="file"; filename="{fn}"\r\n'.encode(), f"Content-Type: {mime}\r\n\r\n".encode(), data, b"\r\n", f"--{b}--\r\n".encode()]
  req=Request(UP,data=b"".join(parts)); req.add_header("Content-Type",f"multipart/form-data; boundary={b}")
  with urlopen(req,timeout=timeout) as r:
   res=json.loads(r.read().decode())
   if res.get("success"): print(f"    -> {res['media']['id']}"); return res["media"]
   print(f"    -> fail {res}"); return None
 except HTTPError as e: print(f"    -> HTTP {e.code}"); return None
 except Exception as e: print(f"    -> {e}"); return None
def check(slug):
 try:
  with urlopen(Request(f"{POSTS}/{slug}"),timeout=10) as r:
   j=json.loads(r.read().decode());
   if j.get("success") and j.get("post"): return j["post"]["id"]
 except HTTPError as e:
  if e.code==404: return None
 except Exception: pass
 return None
def delete(slug):
 try:
  with urlopen(Request(f"{POSTS}/{slug}",method="DELETE"),timeout=30) as r: return r.status==200
 except Exception: return False
def create_post(title,slug,excerpt,mids,fi=None,fa=None,tids=None,author="Gloria"):
 data={"title":title,"slug":slug,"excerpt":excerpt,"author":author,"mediaIds":mids,"published":True}
 if fi: data["featuredImageId"]=fi
 if fa: data["featuredAudioId"]=fa
 if tids: data["tagIds"]=tids
 req=Request(POSTS,data=json.dumps(data).encode()); req.add_header("Content-Type","application/json")
 try:
  with urlopen(req,timeout=60) as r:
   j=json.loads(r.read().decode());
   if j.get("success") or j.get("id"):
    pid=j.get("id") or j.get("post",{}).get("id"); print(f"  -> created {pid}"); return pid
   print(f"  -> fail {j}"); return None
 except HTTPError as e: print(f"  -> HTTP {e.code}"); return None
def update_post(slug,patch):
 url=f"{POSTS}/{slug}"
 if requests is not None:
  try: return requests.patch(url,json=patch,headers={"Content-Type":"application/json"},timeout=60).status_code==200
  except Exception as e: print(f"  PATCH {e}"); return False
 try:
  req=Request(url,data=json.dumps(patch).encode(),method="PATCH"); req.add_header("Content-Type","application/json")
  with urlopen(req,timeout=60) as r: return r.status==200
 except Exception as e: print(f"  PATCH {e}"); return False
def process(story_dir,recreate=False,tags=None,dry=False,ai=False):
 story_dir=Path(story_dir).resolve(); name=story_dir.name
 print(f"\n{'='*60}\nStory: {name}\nAPI: {API}")
 if tags: print(f"Tags: {tags}")
 if dry: print("Mode: DRY-RUN")
 pdfs,auds,imgs=list_files(story_dir)
 if not pdfs: print("  No PDFs"); return False
 primary=pdfs[0]; print(f"  Primary PDF: {primary.name}"); slug=slugify(name)
 excerpt=extract_excerpt(primary) or f"{name.replace('_',' ')} - story"
 print(f"  Excerpt ({len(excerpt)}): {excerpt[:200]}...")
 work=Path(tempfile.mkdtemp(prefix=f"imzadi-cover-{slug}-"))
 cover,method=generate_cover(primary,work,name,excerpt,ai)
 if dry:
  print("\n-- DRY-RUN --"); print(f"  slug: {slug}\n  excerpt_len: {len(excerpt)}\n  excerpt: {excerpt[:300]}\n  cover_method: {method}\n  cover_path: {cover}")
  print(f"  PDFs ({len(pdfs)}):"); [print(f"    - {p.name}") for p in pdfs]
  print(f"  Audio ({len(auds)}):"); [print(f"    - {p.name}") for p in imgs]
  print(f"  Images ({len(imgs)}):"); [print(f"    - {p.name}") for p in imgs]
  print(f"  featuredImage: PDF cover ({method})\n  featuredAudio: {auds[0].name if auds else '(none)'}")
  shutil.rmtree(work,ignore_errors=True); return True
 eid=check(slug); existing=None
 if eid:
  if recreate:
   print(f"  deleting {eid}..."); 
   if not delete(slug): existing={"id":eid}
  else: existing={"id":eid}; print(f"  updating {eid}...")
 tids=get_or_create_tags(tags) if tags else []
 mids=[]; cm=None; fa=None
 if cover:
  cm=upload(str(cover),"IMAGE",f"{name} cover",None)
  if cm: mids.append(cm["id"]); time.sleep(.3)
 for img in imgs:
  m=upload(str(img),"IMAGE",img.stem.replace("_"," ").replace("-"," "),None)
  if m: mids.append(m["id"]); time.sleep(.3)
 for pdf in pdfs:
  m2=re.match(r"^(\d+)-(.+)$",pdf.name); title=m2.group(2).replace(".pdf","").replace("_"," ") if m2 else pdf.stem.replace("_"," ")
  m=upload(str(pdf),"PDF",title,None)
  if m: mids.append(m["id"]); time.sleep(.3)
 for a in auds:
  m=upload(str(a),"AUDIO",a.stem.replace("_"," "),None,timeout=900)
  if m:
   mids.append(m["id"]);
   if fa is None: fa=m["id"]
  time.sleep(.3)
 fi=cm["id"] if cm else None; title=name.replace("_"," ").replace("-"," ")
 if existing and not recreate:
  patch={"excerpt":excerpt,"featuredImageId":fi,"featuredAudioId":fa,"mediaIds":mids}
  if tids: patch["tagIds"]=tids
  ok=update_post(slug,patch); pid=existing["id"]; print(f"  {'updated' if ok else 'update failed'}: {pid}")
 else: pid=create_post(title,slug,excerpt,mids,fi,fa,tids)
 shutil.rmtree(work,ignore_errors=True)
 if pid: print(f"\n  DONE: {API}/post/{slug}\n  featuredImageId={fi} featuredAudioId={fa} cover={method} media={len(mids)}"); return True
 return False
def discover(root):
 root=Path(root).resolve(); dirs=[]
 if any(p.suffix.lower()==".pdf" for p in root.iterdir() if p.is_file()): dirs.append(root)
 for c in sorted(root.iterdir()):
  if not c.is_dir() or c.name.startswith(".") or c.name in SKIP: continue
  if any(p.suffix.lower()==".pdf" for p in c.rglob("*.pdf") if "_extract" not in p.parts): dirs.append(c)
 return dirs
def parse(argv):
 fr="--recreate" in argv; dry="--dry-run" in argv; ai="--ai-cover" in argv
 tags=root=None; pos=[]; i=0
 while i<len(argv):
  a=argv[i]
  if a in ("--recreate","--dry-run","--ai-cover"): i+=1; continue
  if a=="--root":
   if i+1>=len(argv): print("--root needs path"); sys.exit(2)
   root=argv[i+1]; i+=2; continue
  if a.startswith("--root="): root=a.split("=",1)[1]; i+=1; continue
  if a.startswith("--tags="): tags=[t.strip() for t in a.split("=",1)[1].split(",") if t.strip()]; i+=1; continue
  if a=="--tags":
   if i+1>=len(argv): print("--tags needs value"); sys.exit(2)
   tags=[t.strip() for t in argv[i+1].split(",") if t.strip()]; i+=2; continue
  if a.startswith("-"): print(f"Unknown {a}"); sys.exit(2)
  pos.append(a); i+=1
 return fr,dry,ai,tags,root,pos
def main():
 fr,dry,ai,tags,root,pos=parse(sys.argv[1:])
 if not root and not pos: print(__doc__); sys.exit(1)
 if root:
  r=Path(root)
  if not r.is_dir(): print(f"Not a dir: {r}"); sys.exit(1)
  dirs=discover(r)
  if not dirs: print(f"No PDF dirs under {r}"); sys.exit(1)
  print(f"Found {len(dirs)} story dir(s)")
 else:
  d=Path(pos[0])
  if not d.is_dir(): print(f"Not a dir: {d}"); sys.exit(1)
  dirs=[d]
 ok=True
 for sd in dirs: ok=process(sd,fr,tags,dry,ai) and ok
 sys.exit(0 if ok else 1)
if __name__=="__main__": main()
