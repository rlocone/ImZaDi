"""Rebuild an ImZaDi chapter PDF's HTML from Molly's final-text, carrying the old PDF's look.
usage: build.py <code>   -> work/pdfbuild/out/<code>.html + <code>.qa.json"""
import sys, glob, re, json, html, difflib, os
sys.path.insert(0, os.path.dirname(__file__))
import pymupdf
from extract import extract, key, QFIX

W = '/workspace/imzadi-content-20261007/work'
PKG = '/workspace/imzadi-ship-2026-10-07'
M = json.load(open(f'{W}/pdfbuild/map.json'))
# Private-use glyphs that pdftotext left in Molly's final-text; the live PDFs show these characters
# (confirmed by aligning each occurrence against the PDF's own text layer via PyMuPDF).
PUA = str.maketrans({'\ue081': '(', '\ue082': ')', '\ue088': '-', '\ue089': '\u2013', '\ue092': ':'})

def kind_ok_first(c, S, LI):
    # the paragraph must START a line in the old PDF (its first char is the first char of that line)
    return c == 0 or LI[c - 1] != LI[c]

def esc(s): return html.escape(s, quote=False)

def css_inline(st):
    w, it, color, size, mono = st
    out = []
    if w == 'bold': out.append('font-weight:700')
    elif w == 'semibold': out.append('font-weight:600')
    elif w == 'medium': out.append('font-weight:500')
    if it: out.append('font-style:italic')
    if color: out.append('color:#%06x' % color)
    if mono: out.append('font-family:monospace')
    return ';'.join(out)

def build(code):
    uuid = M[code]
    src = glob.glob(f'{PKG}/final-text/{code}-*.md')[0]
    raw = open(src, encoding='utf-8').read()
    text = raw.translate(PUA)
    first, rest = text.split('\n', 1)
    assert first.startswith('# ')
    title_full = first[2:].strip()
    icon, title = title_full.split(' ', 1)
    paras = [p.strip('\n') for p in re.split(r'\n[ \t]*\n', rest) if p.strip()]
    old = f'{W}/live-pdfs/{uuid}.pdf'
    ex = extract(old)
    S, ST, LI, LINES = ex['stream'], ex['styles'], ex['lineinfo'], ex['lines']
    # link rects -> line index
    doc = pymupdf.open(old)
    line_uri = {}
    for li, ln in enumerate(LINES):
        for (pg, r, uri) in ex['links']:
            if pg == ln['page'] and abs(r.y0 - ln['y0']) < 8:
                line_uri[li] = uri
    soft = set()   # old lines that begin after a soft line break (previous line short, same block spacing)
    for li in range(1, len(LINES)):
        pj = li - 1
        while pj >= 0 and LINES[pj]['page'] == LINES[li]['page'] and abs(LINES[pj]['y0'] - LINES[li]['y0']) < 1: pj -= 1
        if pj < 0: continue
        a, c = LINES[pj], LINES[li]
        if a['page'] == c['page'] and abs((c['y0'] - a['y0']) - 18.0) < 0.6 and abs(a['x0'] - c['x0']) < 1 and a['size'] == c['size'] == 12.0:
            w0 = (c['text'].split() or [''])[0]
            # soft break only if the next line's first word would have fitted on the previous line
            if a['x1'] + 3.4 + 1.08 * pymupdf.get_text_length(w0, fontname='helv', fontsize=12) < 539:
                soft.add(li)
    covered = [False] * len(S)
    cur = 0
    n_soft = 0
    blocks, qa_unmatched = [], []
    for n, p in enumerate(paras):
        k = key(p)
        i = S.find(k, cur)
        cmap = [None] * len(k)
        if i >= 0:
            for j in range(len(k)): cmap[j] = i + j
            cur = i + len(k)
        else:
            nxt = None
            for q in paras[n + 1:n + 4]:
                jj = S.find(key(q), cur)
                if jj >= 0: nxt = jj; break
            region_end = nxt if nxt is not None else min(len(S), cur + len(k) * 3 + 200)
            region = S[cur:region_end]
            sm = difflib.SequenceMatcher(None, k, region, autojunk=False)
            blocks_ok = [b for b in sm.get_matching_blocks() if b.size >= 12]
            ratio = sum(b.size for b in blocks_ok) / max(1, len(k))
            if ratio >= 0.8:   # a trimmed / lightly edited old paragraph: carry its styles
                for b in blocks_ok:
                    for j in range(b.size): cmap[b.a + j] = cur + b.b + j
            got = sum(1 for c in cmap if c is not None)
            qa_unmatched.append(dict(index=n, chars=len(k), styled_from_old=got, text=p[:90]))
            last = max([c for c in cmap if c is not None], default=None)
            if last is not None and got > 0.5 * len(k): cur = last + 1
        for c in cmap:
            if c is not None: covered[c] = True
        # block type from first mapped char's line
        firsts = [c for c in cmap if c is not None]
        ln = LINES[LI[firsts[0]]] if firsts else dict(size=12.0, bullet=False, callout=False, quote=False, x0=72.0, hr_before=False)
        uri = line_uri.get(LI[firsts[0]]) if firsts else None
        # soft line break in the old PDF (same block, next line 18pt below, no 6pt paragraph gap)
        tight = False
        if firsts and kind_ok_first(firsts[0], S, LI):
            li0 = LI[firsts[0]]
            pj = li0 - 1
            while pj >= 0 and LINES[pj]['page'] == LINES[li0]['page'] and abs(LINES[pj]['y0'] - LINES[li0]['y0']) < 1: pj -= 1
            if pj >= 0:
                a, b2 = LINES[pj], LINES[li0]
                tight = a['page'] == b2['page'] and abs((b2['y0'] - a['y0']) - 18.0) < 0.6 and abs(a['x0'] - b2['x0']) < 1 and a['size'] == b2['size'] == 12.0
        sizes = [ST[c][3] for c in firsts if S[c].isalnum()]
        size = max(set(sizes), key=sizes.count) if sizes else 12.0
        kind = 'p'
        if size >= 22: kind = 'h1'
        elif size >= 17: kind = 'h2'
        elif size >= 14: kind = 'h3'
        elif ln['callout']: kind = 'callout'
        elif ln['bullet']: kind = 'li'
        elif ln['quote']: kind = 'quote'
        indent = max(0.0, ln['x0'] - 72.0)
        # inline spans: walk the paragraph text, map non-space chars to old styles
        out, kidx, prev_st, buf = [], 0, None, ''
        def flush():
            nonlocal buf
            if buf:
                c = css_inline(prev_st) if prev_st else ''
                t = esc(buf).replace('\n', '<br>')
                out.append(f'<span style="{c}">{t}</span>' if c else t)
            buf = ''
        for pos_, ch in enumerate(p):
            if ch.isspace():
                nxt_c = cmap[kidx] if kidx < len(cmap) else None
                if ch == ' ' and nxt_c is not None and LI[nxt_c] in soft and (nxt_c == 0 or LI[nxt_c - 1] != LI[nxt_c]) and kind == 'p':
                    ch = '\n'; n_soft += 1
                buf += ch; continue
            st = ST[cmap[kidx]] if cmap[kidx] is not None else ('regular', False, 0, 12.0, False)
            if kind in ('h1', 'h2', 'h3'): st = ('regular', st[1], st[2], st[3], st[4])   # heading weight comes from CSS
            kidx += 1
            if st != prev_st: flush(); prev_st = st
            buf += ch
        flush()
        inner = ''.join(out)
        blocks.append(dict(kind=kind, tight=tight, text=p, html=inner, indent=indent, uri=uri, hr=ln.get('hr_before', False), level=int(round((ln['x0'] - 94) / 24)) if kind == 'li' else 0))
    # what old text did NOT make it into the new file (must be approved deletions + the title)
    gaps, i = [], 0
    while i < len(S):
        if not covered[i]:
            j = i
            while j < len(S) and not covered[j]: j += 1
            gaps.append(S[i:j]); i = j
        else: i += 1
    return dict(code=code, uuid=uuid, icon=icon, title=title, old_title=ex['title'], blocks=blocks, gaps=gaps,
                unmatched=qa_unmatched, soft_breaks_restored=n_soft, old_pages=ex['pages'], n_paras=len(paras), pua_fixed=sum(raw.count(c) for c in '\ue081\ue082\ue088\ue089\ue092'))

CSS = """
@page { size: Letter; margin: 72pt 72pt 72pt 72pt; }
html, body { margin: 0; padding: 0; }
body { font-family: 'InterPDF', 'Noto Color Emoji', sans-serif; font-size: 12pt; line-height: 18pt; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-feature-settings: 'liga' 1; }
.cover { display: block; width: 468pt; height: 194.25pt; object-fit: cover; object-position: center 50%; }
.icon { font-size: 36pt; line-height: 42pt; height: 42pt; margin-top: -25.2pt; margin-left: 2.5pt; position: relative; font-family: 'Noto Color Emoji', sans-serif; }
h1.title { font-size: 30pt; line-height: 36pt; font-weight: 700; margin: 12.5pt 0 23.8pt 0; letter-spacing: -0.01em; }
p, .blk { margin: 0 0 6pt 0; white-space: pre-wrap; word-wrap: break-word; }
h1.h1 { font-size: 22.5pt; line-height: 1.3; font-weight: 600; margin: 24pt 0 6pt 0; }
h2.h2 { font-size: 18pt; line-height: 1.3; font-weight: 600; margin: 20pt 0 4pt 0; }
h3.h3 { font-size: 15pt; line-height: 1.3; font-weight: 600; margin: 15pt 0 4pt 0; }
ul { margin: 0 0 6pt 0; padding-left: 22pt; } li { margin: 0 0 3pt 0; white-space: pre-wrap; } li::marker { font-size: 0.9em; }
.callout { display: flex; gap: 9pt; background: rgb(241,239,237); border-radius: 7.5pt; padding: 12pt 12pt 12pt 12pt; margin: 6pt 0 12pt 0; }
.callout .ci { flex: none; font-size: 18pt; line-height: 18pt; } .callout .ct { white-space: pre-wrap; }
blockquote { margin: 6pt 0; padding-left: 14pt; border-left: 3pt solid currentColor; white-space: pre-wrap; }
hr { border: none; border-top: 0.75pt solid rgba(55,53,47,0.09); margin: 12pt 0; }
a.pagelink { color: inherit; text-decoration: underline; text-decoration-color: rgba(55,53,47,0.4); }
.pageblk { margin: 0 0 6pt 0; }
"""

def render(b, cover_src):
    parts = [f'<!doctype html><html><head><meta charset="utf-8"><title>{esc(b["old_title"] or b["title"])}</title><style>{CSS}</style></head><body>',
             f'<img class="cover" src="{cover_src}">', f'<div class="icon">{esc(b["icon"])}</div>', f'<h1 class="title">{esc(b["title"])}</h1>']
    in_ul = False; prev_kind = None
    for bl in b['blocks']:
        if bl['kind'] != 'li' and in_ul: parts.append('</ul>'); in_ul = False
        if bl['hr']: parts.append('<hr>')
        h = bl['html']
        if bl['uri']:
            t = bl['text'].strip()
            m = re.match(r'^(\S+)\s+(.*)$', t, re.S)
            icon, label = (esc(m.group(1)), esc(m.group(2))) if m and not m.group(1)[0].isalnum() else ('', esc(t))
            if not icon and 'The-Phoenix' in bl['uri']:   # its Notion icon is an image, reused from the old PDF (page 9)
                icon = f'<img src="file://{W}/covers/101-phoenix-icon.png" style="width:13.5pt;height:13.5pt;vertical-align:-2pt">'
            parts.append(f'<div class="blk pageblk">{icon + " " if icon else ""}<a class="pagelink" style="font-weight:500" href="{html.escape(bl["uri"])}">{label}</a></div>')
            continue
        sty = []
        if bl['kind'] == 'p' and bl['indent'] > 4: sty.append(f'margin-left:{bl["indent"]:.1f}pt')
        if bl['kind'] == 'p' and bl.get('tight') and prev_kind == 'p': sty.append('margin-top:-6pt')
        style = f' style="{";".join(sty)}"' if sty else ''
        prev_kind = bl['kind']
        if bl['kind'] == 'li':
            if not in_ul: parts.append('<ul>'); in_ul = True
            parts.append(f'<li>{h}</li>')
        elif bl['kind'] in ('h1', 'h2', 'h3'):
            parts.append(f'<{bl["kind"][:2]} class="{bl["kind"]}">{h}</{bl["kind"][:2]}>')
        elif bl['kind'] == 'callout':
            m = re.match(r'^(\S+)\s+(.*)$', h, re.S)
            parts.append(f'<div class="callout"><div class="ci">{m.group(1)}</div><div class="ct">{m.group(2)}</div></div>' if m else f'<div class="callout">{h}</div>')
        elif bl['kind'] == 'quote':
            parts.append(f'<blockquote>{h}</blockquote>')
        else:
            parts.append(f'<p{style}>{h}</p>')
    if in_ul: parts.append('</ul>')
    parts.append('</body></html>')
    return '\n'.join(parts)

if __name__ == '__main__':
    os.makedirs(f'{W}/pdfbuild/out', exist_ok=True)
    for code in sys.argv[1:]:
        b = build(code)
        cover = f'{W}/covers/{code}-cover-000.png'   # full-resolution cover, losslessly extracted from the old PDF (pdfimages -png); James 10/7 11:22
        open(f'{W}/pdfbuild/out/{code}.html', 'w', encoding='utf-8').write(render(b, 'file://' + cover))
        qa = {k: b[k] for k in ('code', 'uuid', 'icon', 'title', 'old_title', 'old_pages', 'n_paras', 'pua_fixed')}
        qa['kinds'] = {}
        for bl in b['blocks']: qa['kinds'][bl['kind']] = qa['kinds'].get(bl['kind'], 0) + 1
        qa['links'] = [bl['uri'] for bl in b['blocks'] if bl['uri']]
        qa['unmatched'] = b['unmatched']; qa['gaps'] = b['gaps']; qa['soft_breaks_restored'] = b['soft_breaks_restored']
        json.dump(qa, open(f'{W}/pdfbuild/out/{code}.qa.json', 'w'), indent=1, ensure_ascii=False)
        print(code, qa['kinds'], 'unmatched', len(b['unmatched']), 'gaps', len(b['gaps']), 'gapchars', sum(map(len, b['gaps'])), 'pua', b['pua_fixed'], 'softbreaks', b['soft_breaks_restored'])
