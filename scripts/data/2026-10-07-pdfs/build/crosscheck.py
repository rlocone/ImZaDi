"""Cross-check each rebuilt chapter against Molly's approved change files:
 (a) every piece of old PDF text missing from the new text is inside an approved deletion/replaced 'current text';
 (b) every approved deletion is absent from the new text;
 (c) every replacement / 'paragraph after the change' text is present in the new text."""
import sys, re, json, glob, os
sys.path.insert(0, os.path.dirname(__file__))
from extract import key
from build import PUA
PKG = '/workspace/imzadi-ship-2026-10-07'
W = '/workspace/imzadi-content-20261007/work'
FILES = {'027': ['openings/17-pdf-027-a-young-couple-i.md'], '028': ['body-cleanups/strip-028-a-young-couple-ii.md'],
         '029': ['body-cleanups/strip-029-a-young-couple-iii.md'], '055': ['body-cleanups/mid-055-a-babies-cry.md'],
         '062': ['body-cleanups/mid-062-genetics.md'], '063': ['openings/16-pdf-063-the-water-breaks.md'],
         '095': ['openings/18-pdf-095-astound-the-world.md'], '101': ['openings/19-pdf-101-goodbye.md']}

def sections(md):
    """yield (mode, text) where mode in del/keep for quoted blocks"""
    mode = None; out = []
    lines = md.split('\n'); i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith('## '):
            h = ln.lower()
            mode = 'del' if ('current text' in h or h.startswith('## deleted') or h.startswith('## mid-')) else ('keep' if 'replacement' in h else ('trim' if 'trimmed' in h else None))
            if 'left in place' in h or 'how to apply' in h or 'target' in h or 'rule' in h: mode = None
        elif ln.strip() in ('Delete:',) or ln.startswith('**Delete'):
            sub = 'del'
        if ln.strip() == 'Paragraph after the change:': cur_sub = 'keep'
        if ln.startswith('```text') and mode == 'del':
            j = i + 1; buf = []
            while not lines[j].startswith('```'): buf.append(lines[j]); j += 1
            out.append(('del', '\n'.join(buf))); i = j + 1; continue
        if ln.startswith('> '):
            buf = [ln[2:]]; j = i + 1
            while j < len(lines) and lines[j].startswith('> '): buf.append(lines[j][2:]); j += 1
            # find the nearest instruction line above
            k = i - 1
            while k >= 0 and not lines[k].strip(): k -= 1
            above = lines[k].strip() if k >= 0 else ''
            m = mode
            if mode == 'trim':
                m = 'del' if above == 'Delete:' else ('keep' if above == 'Paragraph after the change:' else None)
            if mode == 'del' and above.startswith('James') : m = 'keep'
            if m: out.append((m, '\n'.join(buf)))
            i = j; continue
        i += 1
    return out

def check(code):
    q = json.load(open(f'{W}/pdfbuild/out/{code}.qa.json'))
    final = open(glob.glob(f'{PKG}/final-text/{code}-*.md')[0], encoding='utf-8').read().translate(PUA)
    FK = key(final)
    dels, keeps = [], []
    for f in FILES[code]:
        for m, t in sections(open(f'{PKG}/{f}', encoding='utf-8').read().translate(PUA)):
            (dels if m == 'del' else keeps).append(t)
    DK = [key(d) for d in dels]
    Dcat = ''.join(DK)
    title_key = key(q['icon'] + q['title'])
    res = dict(code=code, deletions_listed=len(dels), replacements_listed=len(keeps))
    bad_gaps = []
    for g in q['gaps']:
        gg = g[len(title_key):] if g.startswith(title_key) else g
        if not gg: continue
        if gg in Dcat: continue
        # allow a gap spanning deletions that are not adjacent in the listing order
        rest = gg
        for d in sorted(DK, key=len, reverse=True):
            rest = rest.replace(d, '')
        if rest.strip() and not all(r in Dcat for r in [rest]):
            bad_gaps.append(dict(len=len(gg), not_in_deletions=rest[:200]))
    res['old_text_removed_outside_approved_deletions'] = bad_gaps
    # (b) deleted text must be absent (skip tiny fragments and lines that also legitimately remain, e.g. James's kept lines)
    still = [d[:90] for d, k in zip(dels, DK) if len(k) > 25 and k in FK]
    res['approved_deletions_still_present'] = still
    missing_keep = [t[:90] for t in keeps if key(t) not in FK]
    res['replacements_missing'] = missing_keep
    return res

if __name__ == '__main__':
    allres = [check(c) for c in (sys.argv[1:] or FILES)]
    json.dump(allres, open(f'{W}/pdfbuild/out/crosscheck.json', 'w'), indent=1, ensure_ascii=False)
    for r in allres:
        print(r['code'], 'dels', r['deletions_listed'], 'keeps', r['replacements_listed'], '| removed-outside-approved:', len(r['old_text_removed_outside_approved_deletions']),
              '| deletions-still-present:', len(r['approved_deletions_still_present']), '| replacements-missing:', len(r['replacements_missing']))
        for x in r['old_text_removed_outside_approved_deletions'][:3]: print('   GAP', x)
        for x in r['approved_deletions_still_present'][:3]: print('   STILL', x)
        for x in r['replacements_missing'][:3]: print('   MISSINGKEEP', x)
