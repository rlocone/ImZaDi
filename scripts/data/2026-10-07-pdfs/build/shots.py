import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import pymupdf
from extract import extract, key
W = '/workspace/imzadi-content-20261007/work'; OUT = '/workspace/imzadi-content-20261007/screenshots'
M = json.load(open(f'{W}/pdfbuild/map.json'))
def page_keys(path):
    return [key(p.get_text()) for p in pymupdf.open(path)]
info = {}
for code, uuid in M.items():
    old = f'{W}/live-pdfs/{uuid}.pdf'; new = f'{W}/pdfbuild/pdf/{code}.pdf'
    jobs = [(old, 1, f'{OUT}/before/pdf-{code}-p1.png'), (new, 1, f'{OUT}/after/pdf-{code}-p1.png')]
    if code in ('028', '029', '055', '062'):
        q = json.load(open(f'{W}/pdfbuild/out/{code}.qa.json'))
        ex = extract(old); S = ex['stream']
        title_k = key(q['icon'] + q['title'])
        g = next(g for g in q['gaps'] if g != title_k and len(g) > 20)
        gi = S.find(g)
        old_page = ex['lines'][ex['lineinfo'][gi]]['page'] + 1
        after_k = S[gi + len(g): gi + len(g) + 50]
        before_k = S[max(0, gi - 40): gi]
        nk = page_keys(new); full = ''.join(nk)
        pos = full.find(before_k + after_k[:30])
        assert pos >= 0, code
        pos += len(before_k); acc = 0; new_page = None
        for i, k in enumerate(nk):
            if acc + len(k) > pos: new_page = i + 1; break
            acc += len(k)
        info[code] = dict(first_change_old_page=old_page, first_change_new_page=new_page, removed_starts=g[:60], resumes_with=after_k[:40])
        jobs += [(old, old_page, f'{OUT}/before/pdf-{code}-first-change-p{old_page}.png'), (new, new_page, f'{OUT}/after/pdf-{code}-first-change-p{new_page}.png')]
    for path, pg, out in jobs:
        base = out[:-4]
        subprocess.run(['pdftoppm', '-r', '80', '-f', str(pg), '-l', str(pg), '-png', '-singlefile', path, base], check=True)
json.dump(info, open(f'{W}/pdfbuild/out/first-change-pages.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(info, indent=1, ensure_ascii=False))
