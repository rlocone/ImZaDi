"""Extract a style map from an old ImZaDi chapter PDF (Notion page printed by headless Chrome).
Produces a char stream (whitespace removed) with per-char style + per-line block info."""
import pymupdf, re

QFIX = str.maketrans({'\u02bc': '\u2019', '\u02ee': '\u201d'})
CALLOUT_FILL = (0.94, 0.937, 0.929)

def _style(span):
    f = span['font']
    w = 'bold' if 'Bold' in f and 'Semi' not in f else ('semibold' if 'SemiBold' in f else ('medium' if 'Medium' in f else 'regular'))
    it = 'Italic' in f
    mono = 'Mono' in f or 'Courier' in f
    return (w, it, span['color'], round(span['size'], 1), mono)

def extract(path):
    doc = pymupdf.open(path)
    chars, styles, lineinfo = [], [], []   # chars: str, styles: tuple, lineinfo: index into lines
    lines = []
    links = []
    for page in doc:
        H = page.rect.height
        drawings = page.get_drawings()
        bullets = [d['rect'] for d in drawings if d.get('fill') is not None and d['rect'].width < 7 and d['rect'].height < 7 and abs(d['rect'].width - d['rect'].height) < 1]
        callouts = [d['rect'] for d in drawings if d.get('fill') is not None and all(abs(a - b) < 0.02 for a, b in zip(d['fill'], CALLOUT_FILL)) and d['rect'].height > 20]
        bars = [d['rect'] for d in drawings if d.get('fill') is not None and d['rect'].width <= 4 and d['rect'].height > 12]
        hrs = [d['rect'] for d in drawings if d.get('fill') is not None and d['rect'].height <= 1.5 and d['rect'].width > 300]
        for l in page.get_links():
            if l.get('uri'): links.append((page.number, l['from'], l['uri']))
        for b in page.get_text('dict')['blocks']:
            if b['type'] != 0:
                continue
            for l in b['lines']:
                x0, y0, x1, y1 = l['bbox']
                sp = [s for s in l['spans'] if s['text'].strip()]
                if not sp:
                    continue
                if y0 > H - 50 and round(sp[0]['size'], 1) <= 8:   # running footer
                    continue
                info = dict(page=page.number, x1=round(max(x['bbox'][2] for x in sp), 1), x0=round(sp[0]['bbox'][0], 1), y0=round(y0, 1), size=round(sp[0]['size'], 1),
                            bullet=any(r.y0 >= y0 - 2 and r.y1 <= y1 + 2 and r.x1 < sp[0]['bbox'][0] and r.x1 > sp[0]['bbox'][0] - 20 for r in bullets),
                            callout=any(r.contains(pymupdf.Rect(l['bbox'])) for r in callouts),
                            quote=any(r.x1 < x0 and r.x0 > x0 - 20 and r.y0 <= y0 + 2 and r.y1 >= y1 - 2 for r in bars),
                            hr_before=any(r.y1 <= y0 and r.y1 > y0 - 30 for r in hrs),
                            text=''.join(s['text'] for s in l['spans']))
                li = len(lines); lines.append(info)
                for s in l['spans']:
                    st = _style(s)
                    if s['font'].startswith('Type3'):
                        st = ('regular', False, 0, st[3], False)
                    for ch in s['text'].translate(QFIX):
                        if ch.isspace():
                            continue
                        chars.append(ch); styles.append(st); lineinfo.append(li)
    return dict(stream=''.join(chars), styles=styles, lineinfo=lineinfo, lines=lines, links=links, pages=len(doc),
                title=doc.metadata.get('title'))

def key(s):
    return re.sub(r'\s+', '', s.translate(QFIX))
