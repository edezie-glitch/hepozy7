"""
pagepic.py - draws the first page of a document as a clean picture (white A4-style page, real margins,
headings, paragraphs; spreadsheets and CSV as a ruled table). Used for the file pictures in the chat.

render_page(items, table=False, scale=1) -> PNG bytes
    items: list of (text, is_heading) pairs
    table: True for Excel / CSV: each text is one row, cells separated by " | "
The picture is 1000 x 1300 (or 2x with scale=2), so it stays sharp when the chat shows it small.
"""
import io
import re

from PIL import Image, ImageDraw

from visuals import _font, _FONT_REG, _FONT_BOLD

W, H, MARGIN = 1000, 1300, 80
BODY, HEAD = 25, 31
INK, HEAD_INK, GRID, HEAD_BG = "#222222", "#111111", "#d7dbe0", "#f1f3f5"


def _wrap(d, text, font, width):
    out, line = [], ""
    for word in text.split(" "):
        trial = (line + " " + word).strip()
        if d.textlength(trial, font=font) <= width:
            line = trial
            continue
        if line:
            out.append(line)
        # a single very long word is cut so it can never run off the page
        while d.textlength(word, font=font) > width and len(word) > 1:
            cut = len(word)
            while cut > 1 and d.textlength(word[:cut], font=font) > width:
                cut -= 1
            out.append(word[:cut])
            word = word[cut:]
        line = word
    if line:
        out.append(line)
    return out


def _fit(d, text, font, width):
    if d.textlength(text, font=font) <= width:
        return text
    while len(text) > 1 and d.textlength(text + "…", font=font) > width:
        text = text[:-1]
    return text + "…"


def _draw_doc(d, items, s):
    reg, bold = _font(_FONT_REG, BODY * s), _font(_FONT_BOLD, HEAD * s)
    width = (W - 2 * MARGIN) * s
    y, bottom = MARGIN * s, (H - MARGIN) * s
    first = True
    for text, heading in items:
        font = bold if heading else reg
        step = int((HEAD if heading else BODY) * 1.42 * s)
        if heading and not first:
            y += int(14 * s)
        for ln in _wrap(d, text, font, width):
            if y + step > bottom:
                return
            d.text((MARGIN * s, y), ln, font=font, fill=HEAD_INK if heading else INK)
            y += step
        y += int((16 if heading else 12) * s)
        first = False


def _draw_table(d, items, s):
    cells = [[c.strip() for c in re.split(r"\s\|\s|\t", t)] for t, _ in items if t.strip()]
    if not cells:
        return
    cols = max(1, min(max(len(r) for r in cells), 6))
    reg, bold = _font(_FONT_REG, 25 * s), _font(_FONT_BOLD, 25 * s)
    left, top = MARGIN * s, MARGIN * s
    cw, rh = int((W - 2 * MARGIN) * s / cols), 54 * s
    bottom = (H - MARGIN) * s
    for ri, row in enumerate(cells):
        y = top + ri * rh
        if y + rh > bottom:
            break
        if ri == 0:
            d.rectangle([left, y, left + cw * cols, y + rh], fill=HEAD_BG)
        for ci in range(cols):
            x = left + ci * cw
            txt = row[ci] if ci < len(row) else ""
            d.text((x + 14 * s, y + rh // 2), _fit(d, txt, bold if ri == 0 else reg, cw - 28 * s),
                   font=bold if ri == 0 else reg, fill=HEAD_INK if ri == 0 else INK, anchor="lm")
    rows = min(len(cells), (bottom - top) // rh)
    for ri in range(rows + 1):
        d.line([left, top + ri * rh, left + cw * cols, top + ri * rh], fill=GRID, width=max(1, s))
    for ci in range(cols + 1):
        d.line([left + ci * cw, top, left + ci * cw, top + rows * rh], fill=GRID, width=max(1, s))


def render_page(items, table=False, scale=1):
    s = max(1, int(scale))
    img = Image.new("RGB", (W * s, H * s), "#ffffff")
    d = ImageDraw.Draw(img)
    items = [(t, bool(h)) for t, h in items if str(t).strip()]
    (_draw_table if table else _draw_doc)(d, items, s)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()