"""
visuals.py - charts (line, bar, pie, area) and architecture diagrams for chat replies and generated files.

The model writes each visual as a small JSON spec between [[VISUAL]] and [[/VISUAL]]:

  chart:   {"kind":"chart","type":"line|bar|pie|area","title":"...","x_label":"...","y_label":"...",
            "labels":["Jan","Feb"],"series":[{"name":"Sales","data":[10,20]}]}
  diagram: {"kind":"diagram","title":"...","direction":"LR|TB",
            "nodes":[{"id":"web","label":"Web app","group":"frontend"}],
            "edges":[{"from":"web","to":"api","label":"HTTPS"}]}

extract_visuals()  pulls the specs out of the model text (and cleans them, so nothing unsafe or oversized survives)
render_png()       draws a spec as a PNG, used when the visual goes inside a PDF / Word / Excel file
The chat page draws the same specs itself (visuals.js).
"""
import io
import json
import math
import re

MAX_VISUALS = 3
_BLOCK_RE = re.compile(r"\[\[VISUAL\]\](.*?)\[\[/VISUAL\]\]", re.S)
_FENCE_RE = re.compile(r"```[a-zA-Z]*\s*\n(\{.*?\})\s*\n```", re.S)
_CHART_TYPES = ("line", "bar", "pie", "area")


def _s(v, n):
    return re.sub(r"\s+", " ", str(v if v is not None else "")).strip()[:n]


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def clean_visual(spec):
    """Returns a safe, size-limited copy of a visual spec, or None if it cannot be drawn."""
    if not isinstance(spec, dict):
        return None
    kind = spec.get("kind")
    if kind not in ("chart", "diagram"):
        kind = "diagram" if "nodes" in spec else "chart" if "series" in spec else None
    if kind == "chart":
        ctype = _s(spec.get("type"), 10).lower()
        if ctype not in _CHART_TYPES:
            ctype = "line"
        labels = [_s(x, 24) for x in (spec.get("labels") or [])[:40]]
        series = []
        for srs in (spec.get("series") or [])[:6]:
            if not isinstance(srs, dict):
                continue
            data = [_num(x) for x in (srs.get("data") or [])[:len(labels)]]
            data += [None] * (len(labels) - len(data))
            if any(d is not None for d in data):
                series.append({"name": _s(srs.get("name"), 30) or "Series", "data": data})
        if not series or len(labels) < (1 if ctype == "pie" else 2):
            return None
        if ctype == "pie":
            series = series[:1]
            if any((d or 0) < 0 for d in series[0]["data"]):
                return None
        return {"kind": "chart", "type": ctype, "title": _s(spec.get("title"), 80),
                "x_label": _s(spec.get("x_label"), 40), "y_label": _s(spec.get("y_label"), 40),
                "labels": labels, "series": series}
    if kind == "diagram":
        nodes, seen = [], set()
        for n in (spec.get("nodes") or [])[:24]:
            if not isinstance(n, dict):
                continue
            nid = _s(n.get("id"), 30)
            if not nid or nid in seen:
                continue
            seen.add(nid)
            nodes.append({"id": nid, "label": _s(n.get("label"), 40) or nid, "group": _s(n.get("group"), 24)})
        edges = []
        for e in (spec.get("edges") or [])[:48]:
            if not isinstance(e, dict):
                continue
            a, b = _s(e.get("from"), 30), _s(e.get("to"), 30)
            if a in seen and b in seen and a != b:
                edges.append({"from": a, "to": b, "label": _s(e.get("label"), 24)})
        if len(nodes) < 2:
            return None
        d = _s(spec.get("direction"), 2).upper()
        return {"kind": "diagram", "title": _s(spec.get("title"), 80), "direction": d if d in ("LR", "TB") else "LR",
                "nodes": nodes, "edges": edges}
    return None


def extract_visuals(text, placeholder=None):
    """
    Pulls visual specs out of a model answer.
    Returns (text_without_specs, [clean specs]). If placeholder is given (a function index -> text),
    its result replaces each spec in the text; otherwise the spec is removed.
    """
    specs = []

    def take(raw, original):
        if len(specs) >= MAX_VISUALS:
            return ""
        try:
            spec = clean_visual(json.loads(raw))
        except Exception:
            spec = None
        if spec is None:
            return original if original.startswith("```") else ""
        specs.append(spec)
        return placeholder(len(specs) - 1) if placeholder else ""

    text = _BLOCK_RE.sub(lambda m: take(m.group(1), m.group(0)), text or "")

    def fence(m):
        if '"kind"' not in m.group(1) and '"series"' not in m.group(1) and '"nodes"' not in m.group(1):
            return m.group(0)
        return take(m.group(1), m.group(0))

    text = _FENCE_RE.sub(fence, text)
    text = re.sub(r"\[\[/?VISUAL\]\]", "", text)          # a broken marker is never shown
    return re.sub(r"\n{3,}", "\n\n", text).strip(), specs


# ── drawing (PNG) ─────────────────────────────────────────────────────────────────────────────
PALETTE = ["#e8600a", "#3b82f6", "#16a34a", "#9333ea", "#ca8a04", "#0891b2", "#dc2626", "#6b7280"]
_FONT_REG = ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf", "Helvetica.ttc")
_FONT_BOLD = ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf")


def _font(names, size):
    from PIL import ImageFont
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size)
    except Exception:
        return ImageFont.load_default()


def _nice_ticks(lo, hi, n=5):
    if lo == hi:
        hi = lo + 1 if lo == 0 else lo * 1.1 if lo > 0 else lo * 0.9
        lo = min(lo, 0) if lo > 0 else lo
    span = hi - lo
    raw = span / max(n, 1)
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    start = math.floor(lo / step) * step
    ticks, v = [], start
    while v <= hi + step * 0.999 and len(ticks) < 12:
        ticks.append(round(v, 10))
        v += step
    return ticks


def _fmt(v):
    if abs(v) >= 1e9:
        return f"{v / 1e9:g}B"
    if abs(v) >= 1e6:
        return f"{v / 1e6:g}M"
    if abs(v) >= 1e4:
        return f"{v / 1e3:g}K"
    return f"{v:g}"


def _layout_diagram(spec):
    """Layered layout: columns for LR, rows for TB. Returns {id: (layer, order)} and layer count."""
    ids = [n["id"] for n in spec["nodes"]]
    out = {i: [] for i in ids}
    inc = {i: [] for i in ids}
    for e in spec["edges"]:
        out[e["from"]].append(e["to"])
        inc[e["to"]].append(e["from"])
    # layer = longest path from a source, ignoring edges that close a cycle
    layer, state = {}, {}

    def visit(n, depth, stack):
        if n in stack:
            return
        if layer.get(n, -1) >= depth:
            return
        layer[n] = depth
        for m in out[n]:
            visit(m, depth + 1, stack | {n})

    for n in ids:
        if not inc[n]:
            visit(n, 0, frozenset())
    for n in ids:
        if n not in layer:
            visit(n, 0, frozenset())
    layers = {}
    for n in ids:
        layers.setdefault(layer[n], []).append(n)
    order = {n: i for L in layers.values() for i, n in enumerate(L)}
    for _ in range(3):  # order each column by the average position of its parents
        for d in sorted(layers):
            if d == 0:
                continue
            layers[d].sort(key=lambda n: (sum(order[p] for p in inc[n] if layer.get(p, 0) < d) /
                                          max(1, len([p for p in inc[n] if layer.get(p, 0) < d])), order[n]))
            for i, n in enumerate(layers[d]):
                order[n] = i
    return layer, order, layers


def render_png(spec, scale=2):
    """Draws a (cleaned) visual spec as a PNG on a white page. Returns bytes."""
    from PIL import Image, ImageDraw
    if spec["kind"] == "chart":
        img = _draw_chart(spec, scale)
    else:
        img = _draw_diagram(spec, scale)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def _text_w(d, t, f):
    return d.textlength(t, font=f)


def _draw_chart(spec, S):
    from PIL import Image, ImageDraw
    W, H = 900, 520
    img = Image.new("RGB", (W * S, H * S), "#ffffff")
    d = ImageDraw.Draw(img)
    f, fb, ft = _font(_FONT_REG, 13 * S), _font(_FONT_BOLD, 13 * S), _font(_FONT_BOLD, 18 * S)
    labels, series, ctype = spec["labels"], spec["series"], spec["type"]
    y = 18
    if spec["title"]:
        d.text((W * S / 2, y * S), spec["title"], font=ft, fill="#1a1a1a", anchor="ma")
        y += 34
    multi = len(series) > 1 or ctype == "pie"
    if ctype == "pie":
        vals = [max(v or 0, 0) for v in series[0]["data"]]
        tot = sum(vals) or 1
        cx, cy, r = 300 * S, (y + (H - y) / 2) * S, min(190, (H - y - 40) / 2) * S
        start = -90.0
        for i, v in enumerate(vals):
            ang = 360.0 * v / tot
            if ang > 0:
                d.pieslice([cx - r, cy - r, cx + r, cy + r], start, start + ang, fill=PALETTE[i % 8], outline="#ffffff", width=2 * S)
            start += ang
        lx, ly = 560 * S, (y + 30) * S
        for i, lab in enumerate(labels):
            d.rectangle([lx, ly + i * 28 * S, lx + 14 * S, ly + i * 28 * S + 14 * S], fill=PALETTE[i % 8])
            d.text((lx + 22 * S, ly + i * 28 * S - 1 * S), f"{lab}  {vals[i] / tot * 100:.1f}%", font=f, fill="#333333")
        return img.resize((W * S // S * 1, H * S // S * 1), 1) if False else img
    L, R, B = 78, 30, 64
    if multi:
        lx = L
        for i, s in enumerate(series):
            d.rectangle([lx * S, y * S + 3 * S, lx * S + 12 * S, y * S + 15 * S], fill=PALETTE[i % 8])
            d.text((lx * S + 18 * S, y * S), s["name"], font=f, fill="#333333")
            lx += 18 + int(_text_w(d, s["name"], f) / S) + 24
        y += 30
    top, bottom, left, right = y + 6, H - B, L, W - R
    allv = [v for s in series for v in s["data"] if v is not None]
    lo, hi = min(allv + [0]) if ctype == "bar" or min(allv) >= 0 and ctype != "line" else min(allv), max(allv)
    if ctype in ("bar", "area"):
        lo = min(lo, 0)
    ticks = _nice_ticks(lo, hi)
    lo, hi = min(ticks[0], lo), max(ticks[-1], hi)
    def py(v):
        return (bottom - (v - lo) / ((hi - lo) or 1) * (bottom - top)) * S
    for t in ticks:
        d.line([(left * S, py(t)), (right * S, py(t))], fill="#e5e7eb", width=1 * S)
        d.text(((left - 10) * S, py(t)), _fmt(t), font=f, fill="#555555", anchor="rm")
    d.line([(left * S, bottom * S), (right * S, bottom * S)], fill="#9ca3af", width=1 * S)
    n = len(labels)
    slot = (right - left) / n
    def px(i):
        return (left + slot * (i + 0.5)) * S
    every = max(1, math.ceil(n / 14))
    for i, lab in enumerate(labels):
        if i % every == 0:
            d.text((px(i), (bottom + 10) * S), lab, font=f, fill="#555555", anchor="ma")
    if ctype == "bar":
        k = len(series)
        bw = min(46, slot * 0.78 / k)
        for si, s in enumerate(series):
            for i, v in enumerate(s["data"]):
                if v is None:
                    continue
                x0 = px(i) / S - bw * k / 2 + si * bw
                d.rectangle([x0 * S, min(py(v), py(0)), (x0 + bw - 2) * S, max(py(v), py(0))], fill=PALETTE[si % 8])
    else:
        for si, s in enumerate(series):
            col = PALETTE[si % 8]
            pts = [(px(i), py(v)) for i, v in enumerate(s["data"]) if v is not None]
            if ctype == "area" and len(pts) > 1:
                from PIL import Image as _I
                ov = _I.new("RGBA", img.size, (0, 0, 0, 0))
                ImageDraw.Draw(ov).polygon(pts + [(pts[-1][0], py(max(lo, 0))), (pts[0][0], py(max(lo, 0)))],
                                           fill=tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)) + (60,))
                img.paste(ov, (0, 0), ov)
                d = ImageDraw.Draw(img)
            if len(pts) > 1:
                d.line(pts, fill=col, width=3 * S, joint="curve")
            for (x, yy) in pts:
                d.ellipse([x - 4 * S, yy - 4 * S, x + 4 * S, yy + 4 * S], fill="#ffffff", outline=col, width=2 * S)
    if spec["x_label"]:
        d.text(((left + right) / 2 * S, (H - 22) * S), spec["x_label"], font=fb, fill="#333333", anchor="ma")
    if spec["y_label"]:
        tmp = Image.new("RGBA", (260 * S, 24 * S), (255, 255, 255, 0))
        ImageDraw.Draw(tmp).text((130 * S, 2 * S), spec["y_label"], font=fb, fill="#333333", anchor="ma")
        tmp = tmp.rotate(90, expand=True)
        img.paste(tmp, (4 * S, int((top + bottom) / 2 * S - tmp.size[1] / 2)), tmp)
    return img


def _draw_diagram(spec, S):
    from PIL import Image, ImageDraw
    f, fb, ft = _font(_FONT_REG, 13 * S), _font(_FONT_BOLD, 14 * S), _font(_FONT_BOLD, 18 * S)
    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    layer, order, layers = _layout_diagram(spec)
    groups = []
    for n in spec["nodes"]:
        if n["group"] and n["group"] not in groups:
            groups.append(n["group"])
    BH, GAPX, GAPY, PADX = 46, 70, 26, 24
    wid = {n["id"]: max(96, int(_text_w(probe, n["label"], fb) / S) + 2 * PADX) for n in spec["nodes"]}
    lr = spec["direction"] == "LR"
    colw = {d: max(wid[n] for n in L) for d, L in layers.items()}
    pos = {}
    if lr:
        x = 30
        maxrows = max(len(L) for L in layers.values())
        total_h = maxrows * (BH + GAPY) - GAPY
        for d in sorted(layers):
            for i, n in enumerate(layers[d]):
                col_h = len(layers[d]) * (BH + GAPY) - GAPY
                pos[n] = (x + (colw[d] - wid[n]) / 2, 70 + (total_h - col_h) / 2 + i * (BH + GAPY))
            x += colw[d] + GAPX
        W, H = x - GAPX + 30, 70 + total_h + 40
    else:
        rowh = BH + 54
        maxw = max(sum(wid[n] for n in L) + GAPY * (len(L) - 1) for L in layers.values())
        for d in sorted(layers):
            L = layers[d]
            rw = sum(wid[n] for n in L) + GAPY * (len(L) - 1)
            x = 30 + (maxw - rw) / 2
            for n in L:
                pos[n] = (x, 70 + d * rowh)
                x += wid[n] + GAPY
        W, H = maxw + 60, 70 + len(layers) * rowh + 10
        shift = (max(W, 420) - W) / 2
        if shift:
            pos = {k: (x0 + shift, y0) for k, (x0, y0) in pos.items()}
    W, H = int(max(W, 420)), int(max(H, 220))
    legend_h = 34 if groups else 0
    img = Image.new("RGB", (W * S, (H + legend_h) * S), "#ffffff")
    d = ImageDraw.Draw(img)
    if spec["title"]:
        d.text((W * S / 2, 16 * S), spec["title"], font=ft, fill="#1a1a1a", anchor="ma")
    gcol = {g: PALETTE[i % 8] for i, g in enumerate(groups)}
    def color(n):
        return gcol.get(n["group"], "#374151")
    node = {n["id"]: n for n in spec["nodes"]}
    def anchor(nid, to_side):
        x, y = pos[nid]
        w = wid[nid]
        if lr:
            return (x + w, y + BH / 2) if to_side == "out" else (x, y + BH / 2)
        return (x + w / 2, y + BH) if to_side == "out" else (x + w / 2, y)
    for e in spec["edges"]:
        (x1, y1), (x2, y2) = anchor(e["from"], "out"), anchor(e["to"], "in")
        pts = []
        for k in range(41):
            t = k / 40
            if lr:
                c1, c2 = (x1 + (x2 - x1) * .5, y1), (x1 + (x2 - x1) * .5, y2)
            else:
                c1, c2 = (x1, y1 + (y2 - y1) * .5), (x2, y1 + (y2 - y1) * .5)
            bx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * c1[0] + 3 * (1 - t) * t ** 2 * c2[0] + t ** 3 * x2
            by = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * c1[1] + 3 * (1 - t) * t ** 2 * c2[1] + t ** 3 * y2
            pts.append((bx * S, by * S))
        d.line(pts, fill="#9ca3af", width=2 * S, joint="curve")
        ax, ay = pts[-1]
        bx_, by_ = pts[-4]
        ang = math.atan2(ay - by_, ax - bx_)
        a = 9 * S
        d.polygon([(ax, ay), (ax - a * math.cos(ang - .45), ay - a * math.sin(ang - .45)),
                   (ax - a * math.cos(ang + .45), ay - a * math.sin(ang + .45))], fill="#6b7280")
        if e["label"]:
            mx, my = pts[20]
            tw = _text_w(d, e["label"], f)
            d.rectangle([mx - tw / 2 - 4 * S, my - 9 * S, mx + tw / 2 + 4 * S, my + 9 * S], fill="#ffffff")
            d.text((mx, my), e["label"], font=f, fill="#4b5563", anchor="mm")
    for nid, (x, y) in pos.items():
        c = color(node[nid])
        d.rounded_rectangle([x * S, y * S, (x + wid[nid]) * S, (y + BH) * S], radius=10 * S, fill="#ffffff", outline=c, width=2 * S)
        d.rounded_rectangle([x * S, y * S, (x + 6) * S, (y + BH) * S], radius=3 * S, fill=c)
        d.text(((x + wid[nid] / 2 + 2) * S, (y + BH / 2) * S), node[nid]["label"], font=fb, fill="#111827", anchor="mm")
    lx = 30
    for g in groups:
        d.rectangle([lx * S, (H + 10) * S, (lx + 12) * S, (H + 22) * S], fill=gcol[g])
        d.text(((lx + 18) * S, (H + 9) * S), g, font=f, fill="#333333")
        lx += 18 + int(_text_w(d, g, f) / S) + 26
    return img