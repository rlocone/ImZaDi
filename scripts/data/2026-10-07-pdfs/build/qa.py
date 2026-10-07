import sys, os, json, glob, re, hashlib, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import pymupdf
from extract import key
from build import PUA
W = '/workspace/imzadi-content-20261007/work'; PKG = '/workspace/imzadi-ship-2026-10-07'
M = json.load(open(f'{W}/pdfbuild/map.json'))
v1 = set(l.strip().replace('.pdf', '') for l in open(f'{W}/v1-uuids.txt') if l.strip())
def text_key(path):
    d = pymupdf.open(path); out = []
    for p in d:
        H = p.rect.height
        for b in p.get_text('dict')['blocks']:
            if b['type'] != 0: continue
            for l in b['lines']:
                if l['bbox'][1] > H - 50 and l['spans'][0]['size'] <= 8: continue
                out.append(''.join(s['text'] for s in l['spans']))
    return key('\n'.join(out)), len(d)
res = []
for code, uuid in M.items():
    new = f'{W}/pdfbuild/pdf/{code}.pdf'; old = f'{W}/live-pdfs/{uuid}.pdf'
    final = open(glob.glob(f'{PKG}/final-text/{code}-*.md')[0], encoding='utf-8').read().translate(PUA)
    fk = key(final[2:])   # drop '# '
    nk, npages = text_key(new); ok_, opages = text_key(old)
    icon = final[2:].split(' ', 1)[0]
    # the page icon is drawn after the title, so it comes out later in reading order: compare with it removed once
    nk = icon + nk.replace(icon, '', 1)
    p1 = subprocess.run(['pdftotext', '-f', '1', '-l', '1', '-layout', new, '-'], capture_output=True, text=True).stdout
    alltxt = subprocess.run(['pdftotext', new, '-'], capture_output=True, text=True).stdout
    markers = [m for m in re.findall(r'\[[^\]]{0,40}\]|TODO|TBD|XXX|DRAFT|\bNOTE:|<<|>>|\{\{', alltxt)]
    pua = sum(1 for ch in alltxt if 0xE000 <= ord(ch) <= 0xF8FF)
    r = dict(chapter=code, uuid=uuid, in_v1=uuid in v1, old_pages=opages, new_pages=npages,
             old_sha256=hashlib.sha256(open(old, 'rb').read()).hexdigest(), new_sha256=hashlib.sha256(open(new, 'rb').read()).hexdigest(),
             old_bytes=os.path.getsize(old), new_bytes=os.path.getsize(new),
             text_equals_final_text=(nk == fk), first_page_text=' '.join(p1.split())[:260], draft_markers=markers, pua_chars=pua,
             title=pymupdf.open(new).metadata.get('title'))
    if nk != fk:
        i = next((i for i in range(min(len(nk), len(fk))) if nk[i] != fk[i]), min(len(nk), len(fk)))
        r['text_diff'] = dict(at=i, new_len=len(nk), final_len=len(fk), new=nk[max(0,i-40):i+60], final=fk[max(0,i-40):i+60])
    res.append(r)
    print(code, uuid, 'v1?', r['in_v1'], f"pages {opages}->{npages}", 'text==final:', r['text_equals_final_text'], 'markers', markers[:3], 'pua', pua, '| p1:', r['first_page_text'][:110])
    if 'text_diff' in r: print('   DIFF', r['text_diff'])
json.dump(res, open(f'{W}/pdfbuild/out/qa-all.json', 'w'), indent=1, ensure_ascii=False)
