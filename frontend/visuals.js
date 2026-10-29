/* visuals.js - draws charts (line, bar, area, pie) and architecture diagrams under a chat reply.
   Load it AFTER home.js:  <script src="/visuals.js?v=1"></script>

   The server sends each picture as a small data spec ("visuals") with the reply and with the saved history.
   This file catches those specs, finds the reply on the page (by its message id) and draws the picture
   under it as real SVG: sharp at any size, no hover effects, "Save picture" gives a PNG.
   If a spec is broken it is skipped; the reply text always stays. */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var PAL = ["#ff7300", "#4c8dff", "#2fb36d", "#b061ff", "#e6b422", "#22b8cf", "#ef5350", "#9aa0a6"];
  var specs = {};      // message id -> [spec]

  var css = [
    ".vz-card{align-self:flex-start;margin-top:8px;width:100%;max-width:640px;box-sizing:border-box;padding:12px;",
    "border-radius:12px;background:var(--surface2,#1f1f1f);border:1px solid var(--border,#333);}",
    ".vz-card svg{display:block;width:100%;height:auto;}",
    ".vz-bar{display:flex;justify-content:flex-end;margin-top:8px;}",
    ".vz-save{font:600 12px 'Sora',sans-serif;padding:7px 12px;border-radius:8px;border:1px solid var(--border,#444);",
    "background:transparent;color:var(--text,#efefef);cursor:pointer;}"
  ].join("");
  function injectCss() {
    if (document.getElementById("vzCss")) return;
    var s = document.createElement("style"); s.id = "vzCss"; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return +(v / 1e9).toPrecision(3) + "B";
    if (a >= 1e6) return +(v / 1e6).toPrecision(3) + "M";
    if (a >= 1e4) return +(v / 1e3).toPrecision(3) + "K";
    return String(+v.toPrecision(4));
  }
  function ticks(lo, hi) {
    if (lo === hi) { hi = lo === 0 ? 1 : lo * 1.1; if (lo > 0) lo = 0; }
    var raw = (hi - lo) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = mag;
    [1, 2, 2.5, 5, 10].some(function (m) { step = m * mag; return step >= raw; });
    var out = [], v = Math.floor(lo / step) * step;
    while (v <= hi + step * 0.999 && out.length < 12) { out.push(+v.toFixed(10)); v += step; }
    return out;
  }
  function textW(t, size, bold) { return t.length * size * (bold ? 0.62 : 0.56); }

  /* ---------- charts ---------- */
  function chart(spec) {
    var W = 720, H = 420, labels = spec.labels, series = spec.series, type = spec.type;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": spec.title || "Chart" });
    var y = 14;
    if (spec.title) { svg.appendChild(el("text", { x: W / 2, y: y + 14, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 17, "font-weight": 700 }, spec.title)); y += 32; }
    var multi = series.length > 1;
    if (type === "pie") {
      var vals = series[0].data.map(function (v) { return Math.max(v || 0, 0); }), tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
      var cx = 230, cy = y + (H - y) / 2, r = Math.min(160, (H - y - 30) / 2), a0 = -Math.PI / 2;
      vals.forEach(function (v, i) {
        var a1 = a0 + 2 * Math.PI * v / tot;
        if (v > 0) {
          if (v === tot) svg.appendChild(el("circle", { cx: cx, cy: cy, r: r, fill: PAL[i % 8] }));
          else {
            var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            svg.appendChild(el("path", { d: "M" + cx + "," + cy + " L" + x0 + "," + y0 + " A" + r + "," + r + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + x1 + "," + y1 + " Z", fill: PAL[i % 8], stroke: "#1f1f1f", "stroke-width": 2 }));
          }
        }
        a0 = a1;
      });
      labels.forEach(function (lab, i) {
        var ly = y + 20 + i * 26;
        svg.appendChild(el("rect", { x: 450, y: ly - 11, width: 14, height: 14, rx: 3, fill: PAL[i % 8] }));
        svg.appendChild(el("text", { x: 472, y: ly, fill: "#dcdcdc", "font-size": 14 }, lab + "  " + (vals[i] / tot * 100).toFixed(1) + "%"));
      });
      return svg;
    }
    var L = 64, R = 24, B = 54;
    if (multi) {
      var lx = L;
      series.forEach(function (s, i) {
        svg.appendChild(el("rect", { x: lx, y: y, width: 12, height: 12, rx: 2, fill: PAL[i % 8] }));
        svg.appendChild(el("text", { x: lx + 18, y: y + 11, fill: "#dcdcdc", "font-size": 13 }, s.name));
        lx += 18 + textW(s.name, 13) + 22;
      });
      y += 26;
    }
    var top = y + 6, bottom = H - B, left = L, right = W - R;
    var all = []; series.forEach(function (s) { s.data.forEach(function (v) { if (v != null) all.push(v); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (type !== "line" || lo > 0 && lo < hi * 0.05) lo = Math.min(lo, 0);
    var tk = ticks(lo, hi); lo = Math.min(tk[0], lo); hi = Math.max(tk[tk.length - 1], hi);
    function py(v) { return bottom - (v - lo) / ((hi - lo) || 1) * (bottom - top); }
    tk.forEach(function (t) {
      svg.appendChild(el("line", { x1: left, x2: right, y1: py(t), y2: py(t), stroke: "#3a3a3a", "stroke-width": 1 }));
      svg.appendChild(el("text", { x: left - 8, y: py(t) + 4, "text-anchor": "end", fill: "#aaa", "font-size": 12 }, fmt(t)));
    });
    svg.appendChild(el("line", { x1: left, x2: right, y1: bottom, y2: bottom, stroke: "#777", "stroke-width": 1 }));
    var n = labels.length, slot = (right - left) / n, every = Math.max(1, Math.ceil(n / 12));
    function px(i) { return left + slot * (i + 0.5); }
    labels.forEach(function (lab, i) {
      if (i % every === 0) svg.appendChild(el("text", { x: px(i), y: bottom + 18, "text-anchor": "middle", fill: "#aaa", "font-size": 12 }, lab));
    });
    if (type === "bar") {
      var k = series.length, bw = Math.min(46, slot * 0.78 / k);
      series.forEach(function (s, si) {
        s.data.forEach(function (v, i) {
          if (v == null) return;
          var x0 = px(i) - bw * k / 2 + si * bw, a = py(v), b = py(Math.max(lo, 0));
          svg.appendChild(el("rect", { x: x0, y: Math.min(a, b), width: Math.max(bw - 2, 1), height: Math.max(Math.abs(a - b), 1), rx: 2, fill: PAL[si % 8] }));
        });
      });
    } else {
      series.forEach(function (s, si) {
        var pts = [];
        s.data.forEach(function (v, i) { if (v != null) pts.push([px(i), py(v)]); });
        if (!pts.length) return;
        var col = PAL[si % 8];
        if (type === "area" && pts.length > 1) {
          var base = py(Math.max(lo, 0));
          svg.appendChild(el("polygon", { points: pts.concat([[pts[pts.length - 1][0], base], [pts[0][0], base]]).map(function (p) { return p.join(","); }).join(" "), fill: col, "fill-opacity": 0.22 }));
        }
        if (pts.length > 1) svg.appendChild(el("polyline", { points: pts.map(function (p) { return p.join(","); }).join(" "), fill: "none", stroke: col, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }));
        pts.forEach(function (p) { svg.appendChild(el("circle", { cx: p[0], cy: p[1], r: 4, fill: "#1f1f1f", stroke: col, "stroke-width": 2 })); });
      });
    }
    if (spec.x_label) svg.appendChild(el("text", { x: (left + right) / 2, y: H - 12, "text-anchor": "middle", fill: "#ddd", "font-size": 13, "font-weight": 700 }, spec.x_label));
    if (spec.y_label) svg.appendChild(el("text", { x: 0, y: 0, transform: "translate(16," + ((top + bottom) / 2) + ") rotate(-90)", "text-anchor": "middle", fill: "#ddd", "font-size": 13, "font-weight": 700 }, spec.y_label));
    return svg;
  }

  /* ---------- architecture diagrams ---------- */
  function diagram(spec) {
    var nodes = spec.nodes, edges = spec.edges, lr = spec.direction !== "TB";
    var ids = nodes.map(function (n) { return n.id; }), out = {}, inc = {};
    ids.forEach(function (i) { out[i] = []; inc[i] = []; });
    edges.forEach(function (e) { out[e.from].push(e.to); inc[e.to].push(e.from); });
    var layer = {};
    function visit(n, d, stack) {
      if (stack.indexOf(n) >= 0) return;
      if ((layer[n] === undefined ? -1 : layer[n]) >= d) return;
      layer[n] = d;
      out[n].forEach(function (m) { visit(m, d + 1, stack.concat([n])); });
    }
    ids.forEach(function (n) { if (!inc[n].length) visit(n, 0, []); });
    ids.forEach(function (n) { if (layer[n] === undefined) visit(n, 0, []); });
    var layers = {}, order = {};
    ids.forEach(function (n) { (layers[layer[n]] = layers[layer[n]] || []).push(n); });
    Object.keys(layers).forEach(function (d) { layers[d].forEach(function (n, i) { order[n] = i; }); });
    for (var pass = 0; pass < 3; pass++) {
      Object.keys(layers).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
        if (!d) return;
        function avg(n) { var ps = inc[n].filter(function (p) { return layer[p] < d; }); return ps.length ? ps.reduce(function (a, p) { return a + order[p]; }, 0) / ps.length : order[n]; }
        layers[d].sort(function (a, b) { return avg(a) - avg(b) || order[a] - order[b]; });
        layers[d].forEach(function (n, i) { order[n] = i; });
      });
    }
    var groups = [];
    nodes.forEach(function (n) { if (n.group && groups.indexOf(n.group) < 0) groups.push(n.group); });
    var gcol = {}; groups.forEach(function (g, i) { gcol[g] = PAL[i % 8]; });
    var BH = 46, GX = 70, GY = 26, PX = 24, pos = {}, wid = {}, W, H;
    if (nodes.some(function (n) { return n.shape === "decision" || n.shape === "db"; })) BH = 60;                       /* ADDED */
    nodes.forEach(function (n) { if (n.fields && n.fields.length) BH = Math.max(BH, 26 + 16 * Math.max.apply(null, nodes.map(function (m) { return (m.fields || []).length; }))); });
    var node = {}; nodes.forEach(function (n) {
      node[n.id] = n;
      wid[n.id] = Math.max(96, Math.ceil(textW(n.label, 14, true)) + 2 * PX + (n.shape === "decision" || n.shape === "io" ? 40 : 0));
      (n.fields || []).forEach(function (f) { wid[n.id] = Math.max(wid[n.id], Math.ceil(textW(f, 12)) + 2 * PX); });
    });
    var keys = Object.keys(layers).map(Number).sort(function (a, b) { return a - b; });
    if (lr) {
      var x = 30, maxRows = Math.max.apply(null, keys.map(function (d) { return layers[d].length; })), totalH = maxRows * (BH + GY) - GY;
      keys.forEach(function (d) {
        var cw = Math.max.apply(null, layers[d].map(function (n) { return wid[n]; })), colH = layers[d].length * (BH + GY) - GY;
        layers[d].forEach(function (n, i) { pos[n] = [x + (cw - wid[n]) / 2, 64 + (totalH - colH) / 2 + i * (BH + GY)]; });
        x += cw + GX;
      });
      W = x - GX + 30; H = 64 + totalH + 24;
    } else {
      var rowW = function (d) { return layers[d].reduce(function (a, n) { return a + wid[n]; }, 0) + GY * (layers[d].length - 1); };
      var maxW = Math.max.apply(null, keys.map(rowW));
      W = Math.max(maxW + 60, 420);
      keys.forEach(function (d) {
        var xx = (W - rowW(d)) / 2;
        layers[d].forEach(function (n) { pos[n] = [xx, 64 + d * (BH + 54)]; xx += wid[n] + GY; });
      });
      H = 64 + keys.length * (BH + 54) - 20;
    }
    W = Math.max(W, 420);
    var legendH = groups.length ? 34 : 0;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + (H + legendH), role: "img", "aria-label": spec.title || "Diagram" });
    var defs = el("defs", {}), mk = el("marker", { id: "vzArrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9aa0a6" })); defs.appendChild(mk); svg.appendChild(defs);
    if (spec.title) svg.appendChild(el("text", { x: W / 2, y: 28, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 17, "font-weight": 700 }, spec.title));
    function anchor(id, side) {
      var p = pos[id], w = wid[id];
      return lr ? (side === "out" ? [p[0] + w, p[1] + BH / 2] : [p[0], p[1] + BH / 2]) : (side === "out" ? [p[0] + w / 2, p[1] + BH] : [p[0] + w / 2, p[1]]);
    }
    edges.forEach(function (e) {
      var a = anchor(e.from, "out"), b = anchor(e.to, "in"), c1, c2;
      if (lr) { c1 = [a[0] + (b[0] - a[0]) / 2, a[1]]; c2 = [a[0] + (b[0] - a[0]) / 2, b[1]]; }
      else { c1 = [a[0], a[1] + (b[1] - a[1]) / 2]; c2 = [b[0], a[1] + (b[1] - a[1]) / 2]; }
      svg.appendChild(el("path", { d: "M" + a + " C" + c1 + " " + c2 + " " + b, fill: "none", stroke: "#8a9099", "stroke-width": 2, "marker-end": "url(#vzArrow)" }));
      if (e.label) {
        var mx = (a[0] + 3 * c1[0] + 3 * c2[0] + b[0]) / 8, my = (a[1] + 3 * c1[1] + 3 * c2[1] + b[1]) / 8, tw = textW(e.label, 12) + 10;
        svg.appendChild(el("rect", { x: mx - tw / 2, y: my - 10, width: tw, height: 20, rx: 4, fill: "#1f1f1f" }));
        svg.appendChild(el("text", { x: mx, y: my + 4, "text-anchor": "middle", fill: "#c9c9c9", "font-size": 12 }, e.label));
      }
    });
    ids.forEach(function (id) {
      var p = pos[id], col = gcol[node[id].group] || "#8a9099", n = node[id], w = wid[id], sh = n.shape || "process";
      var x0 = p[0], y0 = p[1], x1 = p[0] + w, y1 = p[1] + BH, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, base = { fill: "#2a2a2a", stroke: col, "stroke-width": 2 };
      function mk2(name, a) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in a) o[k] = a[k]; svg.appendChild(el(name, o)); }
      if (sh === "decision") mk2("polygon", { points: [cx, y0, x1, cy, cx, y1, x0, cy].join(",").replace(/(\d+(?:\.\d+)?,\d+(?:\.\d+)?),/g, "$1 ") });
      else if (sh === "io") mk2("polygon", { points: [x0 + 16, y0, x1, y0, x1 - 16, y1, x0, y1].join(",").replace(/(\d+(?:\.\d+)?,\d+(?:\.\d+)?),/g, "$1 ") });
      else if (sh === "start" || sh === "end") mk2("rect", { x: x0, y: y0, width: w, height: BH, rx: BH / 2 });
      else if (sh === "actor") mk2("ellipse", { cx: cx, cy: cy, rx: w / 2, ry: BH / 2 });
      else if (sh === "db") {
        mk2("path", { d: "M" + x0 + "," + (y0 + 9) + " L" + x0 + "," + (y1 - 9) + " A" + w / 2 + ",9 0 0 0 " + x1 + "," + (y1 - 9) + " L" + x1 + "," + (y0 + 9) + " Z" });
        mk2("ellipse", { cx: cx, cy: y0 + 9, rx: w / 2, ry: 9 });
      }
      else if (sh === "note") mk2("rect", { x: x0, y: y0, width: w, height: BH, fill: "#3a3520" });
      else if (n.fields && n.fields.length) {
        mk2("rect", { x: x0, y: y0, width: w, height: BH });
        svg.appendChild(el("rect", { x: x0, y: y0, width: w, height: 24, fill: col }));
      }
      else { mk2("rect", { x: x0, y: y0, width: w, height: BH, rx: 10 }); svg.appendChild(el("rect", { x: x0, y: y0 + 6, width: 5, height: BH - 12, rx: 2.5, fill: col })); }
      if (n.fields && n.fields.length) {
        svg.appendChild(el("text", { x: cx, y: y0 + 17, "text-anchor": "middle", fill: "#fff", "font-size": 14, "font-weight": 700 }, n.label));
        n.fields.forEach(function (f, i) { svg.appendChild(el("text", { x: x0 + 10, y: y0 + 38 + 16 * i, fill: "#e5e5e5", "font-size": 12 }, f)); });
      } else svg.appendChild(el("text", { x: cx + (sh === "process" ? 2 : 0), y: cy + 5, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 14, "font-weight": 700 }, n.label));
    });
    var lx = 30;
    groups.forEach(function (g) {
      svg.appendChild(el("rect", { x: lx, y: H + 10, width: 12, height: 12, rx: 2, fill: gcol[g] }));
      svg.appendChild(el("text", { x: lx + 18, y: H + 21, fill: "#cfcfcf", "font-size": 13 }, g));
      lx += 18 + textW(g, 13) + 24;
    });
    svg._geo = { pos: pos, wid: wid, BH: BH };   /* ADDED: used by the draw.io export */
    return svg;
  }


  /* ---------- sequence diagrams (ADDED) ---------- */
  function sequence(spec) {
    var parts = spec.participants, msgs = spec.messages, COLW = 170, TOP = 56, ROW = 46;
    var W = Math.max(420, COLW * parts.length + 40), H = TOP + 70 + ROW * msgs.length + 20;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": spec.title || "Sequence diagram" });
    var defs = el("defs", {}), mk = el("marker", { id: "vzArrow2", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M0,0 L10,5 L0,10 z", fill: "#c9c9c9" })); defs.appendChild(mk); svg.appendChild(defs);
    if (spec.title) svg.appendChild(el("text", { x: W / 2, y: 28, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 17, "font-weight": 700 }, spec.title));
    var x = {}; parts.forEach(function (p, i) { x[p.id] = 20 + COLW * (i + 0.5); });
    parts.forEach(function (p, i) {
      var c = PAL[i % 8];
      svg.appendChild(el("line", { x1: x[p.id], x2: x[p.id], y1: TOP + 36, y2: H - 10, stroke: "#777", "stroke-width": 1, "stroke-dasharray": "5 5" }));
      svg.appendChild(el("rect", { x: x[p.id] - 70, y: TOP, width: 140, height: 36, rx: 8, fill: "#2a2a2a", stroke: c, "stroke-width": 2 }));
      svg.appendChild(el("text", { x: x[p.id], y: TOP + 23, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 14, "font-weight": 700 }, p.label));
    });
    msgs.forEach(function (m, k) {
      var y = TOP + 70 + k * ROW, a = x[m.from], b = x[m.to], dash = m.style === "return" ? "6 4" : (m.style === "async" ? "2 3" : "");
      var at = { fill: "none", stroke: "#c9c9c9", "stroke-width": 2, "marker-end": "url(#vzArrow2)" };
      if (dash) at["stroke-dasharray"] = dash;
      if (a === b) {
        at.d = "M" + a + "," + (y - 8) + " L" + (a + 34) + "," + (y - 8) + " L" + (a + 34) + "," + (y + 8) + " L" + a + "," + (y + 8);
        svg.appendChild(el("path", at));
        svg.appendChild(el("text", { x: a + 42, y: y - 3, fill: "#dcdcdc", "font-size": 13 }, m.label));
      } else {
        at.d = "M" + a + "," + y + " L" + b + "," + y;
        svg.appendChild(el("path", at));
        svg.appendChild(el("text", { x: (a + b) / 2, y: y - 8, "text-anchor": "middle", fill: "#dcdcdc", "font-size": 13 }, m.label));
      }
    });
    svg._geo = { x: x, TOP: TOP, ROW: ROW, H: H };
    return svg;
  }

  /* ---------- draw.io export (ADDED): a .drawio file that opens in draw.io / diagrams.net ---------- */
  function xe(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var DSTYLE = {
    process: "rounded=1;whiteSpace=wrap;html=1;arcSize=20;", start: "rounded=1;whiteSpace=wrap;html=1;arcSize=50;", end: "rounded=1;whiteSpace=wrap;html=1;arcSize=50;",
    decision: "rhombus;whiteSpace=wrap;html=1;", io: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;",
    db: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=10;", actor: "ellipse;whiteSpace=wrap;html=1;", note: "shape=note;whiteSpace=wrap;html=1;size=14;"
  };
  function drawioXml(spec, svg) {
    var cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'], g = svg._geo || {}, n = 2, idmap = {};
    if (spec.kind === "diagram") {
      spec.nodes.forEach(function (nd) {
        var p = g.pos[nd.id], w = g.wid[nd.id], h = g.BH, id = "n" + (n++), label = nd.label, st = DSTYLE[nd.shape || "process"] || DSTYLE.process;
        idmap[nd.id] = id;
        if (nd.fields && nd.fields.length) { label = "<b>" + xe(nd.label) + "</b><hr>" + nd.fields.map(xe).join("<br>"); st = "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=6;"; cells.push('<mxCell id="' + id + '" value="' + xe(label) + '" style="' + st + '" vertex="1" parent="1"><mxGeometry x="' + Math.round(p[0]) + '" y="' + Math.round(p[1]) + '" width="' + Math.round(w) + '" height="' + Math.round(h) + '" as="geometry"/></mxCell>'); return; }
        cells.push('<mxCell id="' + id + '" value="' + xe(label) + '" style="' + st + '" vertex="1" parent="1"><mxGeometry x="' + Math.round(p[0]) + '" y="' + Math.round(p[1]) + '" width="' + Math.round(w) + '" height="' + Math.round(h) + '" as="geometry"/></mxCell>');
      });
      spec.edges.forEach(function (e) {
        cells.push('<mxCell id="e' + (n++) + '" value="' + xe(e.label) + '" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;" edge="1" parent="1" source="' + idmap[e.from] + '" target="' + idmap[e.to] + '"><mxGeometry relative="1" as="geometry"/></mxCell>');
      });
    } else if (spec.kind === "sequence") {
      spec.participants.forEach(function (p) {
        var id = "n" + (n++); idmap[p.id] = id;
        cells.push('<mxCell id="' + id + '" value="' + xe(p.label) + '" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;" vertex="1" parent="1"><mxGeometry x="' + Math.round(g.x[p.id] - 50) + '" y="' + g.TOP + '" width="100" height="' + (g.H - g.TOP - 10) + '" as="geometry"/></mxCell>');
      });
      spec.messages.forEach(function (m, k) {
        var y = g.TOP + 70 + k * g.ROW, a = g.x[m.from], b = g.x[m.to], dash = m.style === "return" ? "dashed=1;" : "";
        cells.push('<mxCell id="e' + (n++) + '" value="' + xe(m.label) + '" style="html=1;verticalAlign=bottom;endArrow=block;' + dash + '" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="' + Math.round(a) + '" y="' + y + '" as="sourcePoint"/><mxPoint x="' + Math.round(b === a ? a + 1 : b) + '" y="' + (b === a ? y + 16 : y) + '" as="targetPoint"/></mxGeometry></mxCell>');
      });
    }
    return '<mxfile host="app.diagrams.net"><diagram name="' + xe(spec.title || "Page-1") + '" id="hepozy1"><mxGraphModel dx="1000" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850" math="0" shadow="0"><root>' + cells.join("") + '</root></mxGraphModel></diagram></mxfile>';
  }
  /* link that opens app.diagrams.net with the drawing already loaded (diagram is packed into the address after #R) */
  function drawioLink(spec, svg, done) {
    try {
      if (typeof CompressionStream === "undefined") return done(null);
      var bytes = new TextEncoder().encode(encodeURIComponent(drawioXml(spec, svg)));
      var cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter();
      w.write(bytes); w.close();
      new Response(cs.readable).arrayBuffer().then(function (buf) {
        var u = new Uint8Array(buf), bin = "";
        for (var i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
        var url = "https://app.diagrams.net/#R" + encodeURIComponent(btoa(bin));
        done(url.length < 7500 ? url : null);        /* too long for an address: the download button is used */
      }).catch(function () { done(null); });
    } catch (e) { done(null); }
  }
  function saveDrawio(spec, svg, name) {
    try {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([drawioXml(spec, svg)], { type: "application/vnd.jgraph.mxfile" }));
      a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    } catch (e) {}
  }

  /* ---------- save as PNG ---------- */
  function savePng(svg, name) {
    try {
      var vb = svg.viewBox.baseVal, scale = 2, c = document.createElement("canvas");
      c.width = vb.width * scale; c.height = vb.height * scale;
      var clone = svg.cloneNode(true);
      clone.setAttribute("xmlns", NS); clone.setAttribute("width", c.width); clone.setAttribute("height", c.height);
      clone.querySelectorAll("text").forEach(function (t) { t.setAttribute("font-family", "Arial,Helvetica,sans-serif"); });
      var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
      var img = new Image();
      img.onload = function () {
        var g = c.getContext("2d"); g.fillStyle = "#1f1f1f"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b) return;
          var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
        }, "image/png");
      };
      img.src = url;
    } catch (e) {}
  }

  function card(spec, row) {
    var svg;
    try { svg = spec.kind === "sequence" ? sequence(spec) : spec.kind === "diagram" ? diagram(spec) : chart(spec); } catch (e) { return null; }  /* CHANGED: sequence */
    var box = document.createElement("div"); box.className = "vz-card"; box.setAttribute("data-vz", "1");
    box.appendChild(svg);
    var bar = document.createElement("div"); bar.className = "vz-bar";
    var b = document.createElement("button"); b.type = "button"; b.className = "vz-save"; b.textContent = "Save picture";
    var nm = (spec.title || (spec.kind === "diagram" ? "diagram" : "chart")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    b.addEventListener("click", function () { savePng(svg, nm); });
    if (spec.kind !== "chart") {   /* ADDED: the drawing opens inside draw.io, and can be downloaded */
      var open = document.createElement("a"); open.className = "vz-save"; open.target = "_blank"; open.rel = "noopener noreferrer";
      open.textContent = "Open in draw.io"; open.style.cssText = "margin-right:8px;text-decoration:none;display:none;";
      bar.appendChild(open);
      drawioLink(spec, svg, function (url) {
        if (!url) return;
        open.href = url; open.style.display = "";
        var bub = row && row.querySelector(".msg-bubble");      /* the link is also written INSIDE the reply, in blue */
        if (bub) {
          var p = document.createElement("p"); p.style.margin = "10px 0 0";
          var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = "Open this diagram in draw.io: " + (spec.title || "your diagram");
          p.appendChild(a); bub.appendChild(p);
        }
      });
      var dbn = document.createElement("button"); dbn.type = "button"; dbn.className = "vz-save"; dbn.style.marginRight = "8px"; dbn.textContent = "Download .drawio";
      dbn.addEventListener("click", function () { saveDrawio(spec, svg, nm.replace(/\.png$/, ".drawio")); });
      bar.appendChild(dbn);
    }
    bar.appendChild(b); box.appendChild(bar);
    return box;
  }

  function attach(row) {
    var id = row.dataset && row.dataset.msgId;
    if (!id || !specs[id] || row.querySelector('[data-vz]')) return;
    injectCss();
    var bubble = row.querySelector(".msg-bubble"), anchor = bubble ? bubble.nextSibling : null;
    specs[id].forEach(function (s) {
      var c = card(s, row);
      if (c) row.insertBefore(c, anchor);
    });
    if (typeof scrollBottom === "function") scrollBottom();
  }
  function scan() {
    document.querySelectorAll(".msg-row.bot[data-msg-id]").forEach(attach);
  }

  function remember(id, list) {
    if (!id || !Array.isArray(list) || !list.length) return;
    specs[id] = list.filter(function (s) { return s && (s.kind === "chart" || s.kind === "diagram" || s.kind === "sequence"); });
    scan();
  }

  /* catch the specs the server sends */
  var realFetch = window.fetch;
  if (realFetch) {
    window.fetch = function (input) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var p = realFetch.apply(this, arguments);
      if (/\/chat(\?|$)|\/chat\/history\//.test(url)) {
        p.then(function (res) {
          if (!res || !res.ok) return;
          res.clone().json().then(function (d) {
            if (!d) return;
            if (d.assistant_message_id && d.visuals) remember(d.assistant_message_id, d.visuals);
            if (Array.isArray(d.messages)) d.messages.forEach(function (m) { if (m && m.visuals) remember(m.id, m.visuals); });
          }).catch(function () {});
        }).catch(function () {});
      }
      return p;
    };
  }

  function start() {
    var host = document.getElementById("messages") || document.body;
    new MutationObserver(scan).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-msg-id"] });
    scan();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.hpVisuals = { specs: specs, scan: scan };
})();