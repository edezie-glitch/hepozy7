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
    var node = {}; nodes.forEach(function (n) { node[n.id] = n; wid[n.id] = Math.max(96, Math.ceil(textW(n.label, 14, true)) + 2 * PX); });
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
      var p = pos[id], col = gcol[node[id].group] || "#8a9099";
      svg.appendChild(el("rect", { x: p[0], y: p[1], width: wid[id], height: BH, rx: 10, fill: "#2a2a2a", stroke: col, "stroke-width": 2 }));
      svg.appendChild(el("rect", { x: p[0], y: p[1] + 6, width: 5, height: BH - 12, rx: 2.5, fill: col }));
      svg.appendChild(el("text", { x: p[0] + wid[id] / 2 + 2, y: p[1] + BH / 2 + 5, "text-anchor": "middle", fill: "#f2f2f2", "font-size": 14, "font-weight": 700 }, node[id].label));
    });
    var lx = 30;
    groups.forEach(function (g) {
      svg.appendChild(el("rect", { x: lx, y: H + 10, width: 12, height: 12, rx: 2, fill: gcol[g] }));
      svg.appendChild(el("text", { x: lx + 18, y: H + 21, fill: "#cfcfcf", "font-size": 13 }, g));
      lx += 18 + textW(g, 13) + 24;
    });
    return svg;
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

  function card(spec) {
    var svg;
    try { svg = spec.kind === "diagram" ? diagram(spec) : chart(spec); } catch (e) { return null; }
    var box = document.createElement("div"); box.className = "vz-card"; box.setAttribute("data-vz", "1");
    box.appendChild(svg);
    var bar = document.createElement("div"); bar.className = "vz-bar";
    var b = document.createElement("button"); b.type = "button"; b.className = "vz-save"; b.textContent = "Save picture";
    var nm = (spec.title || (spec.kind === "diagram" ? "diagram" : "chart")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    b.addEventListener("click", function () { savePng(svg, nm); });
    bar.appendChild(b); box.appendChild(bar);
    return box;
  }

  function attach(row) {
    var id = row.dataset && row.dataset.msgId;
    if (!id || !specs[id] || row.querySelector('[data-vz]')) return;
    injectCss();
    var bubble = row.querySelector(".msg-bubble"), anchor = bubble ? bubble.nextSibling : null;
    specs[id].forEach(function (s) {
      var c = card(s);
      if (c) row.insertBefore(c, anchor);
    });
    if (typeof scrollBottom === "function") scrollBottom();
  }
  function scan() {
    document.querySelectorAll(".msg-row.bot[data-msg-id]").forEach(attach);
  }

  function remember(id, list) {
    if (!id || !Array.isArray(list) || !list.length) return;
    specs[id] = list.filter(function (s) { return s && (s.kind === "chart" || s.kind === "diagram"); });
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