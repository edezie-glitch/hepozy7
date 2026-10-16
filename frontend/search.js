/* Search panel. Magnifier in the top bar -> panel from the right.
   GET /search?type=all|images|news&q=...  ->  {"status":"done"|"searching","results":[...]}
   all/news : {title, url, snippet}      images : {title, url, image_url, thumb_url}
   Server text is only ever inserted with textContent. */
(function () {
  "use strict";
  var topbar = document.querySelector(".topbar");
  if (!topbar) return;

  var POLL_MS = 4000, POLL_MAX_MS = 180000, MAX_RESULTS = 50;
  var tab = "all", runId = 0, timer = null, ctrl = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function safeUrl(u) { return typeof u === "string" && /^https?:\/\//i.test(u) ? u : ""; }
  function clip(s, n) { s = String(s == null ? "" : s).trim(); return s.length > n ? s.slice(0, n) + "…" : s; }

  var openBtn = el("button", "topbar-btn search-open");
  openBtn.type = "button"; openBtn.title = "Search"; openBtn.setAttribute("aria-label", "Search");
  openBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>';
  topbar.appendChild(openBtn);

  var back = el("div", "sp-back");
  var panel = el("aside", "sp");
  panel.setAttribute("aria-hidden", "true");

  /* drag the left edge to resize; drag it almost closed to hide the panel (desktop only) */
  var grip = el("div", "sp-grip"); grip.title = "Drag to resize";
  panel.appendChild(grip);
  var W_KEY = "hepozy_search_w", W_MIN = 300;
  function isMobile() { return window.innerWidth <= 640; }
  function setWidth(px) { panel.style.width = Math.round(px) + "px"; }
  try { var saved = parseInt(localStorage.getItem(W_KEY) || "", 10); if (saved >= W_MIN) setWidth(Math.min(saved, window.innerWidth * 0.9)); } catch (e) {}
  grip.addEventListener("pointerdown", function (e) {
    if (isMobile()) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    panel.style.transition = "none"; document.body.style.userSelect = "none";
    var w = panel.getBoundingClientRect().width;
    function move(ev) { w = Math.min(Math.max(window.innerWidth - ev.clientX, 120), window.innerWidth * 0.9); setWidth(w); }
    function up() {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up);
      panel.style.transition = ""; document.body.style.userSelect = "";
      if (w < 220) { panel.style.width = ""; try { localStorage.removeItem(W_KEY); } catch (x) {} closePanel(); }
      else { try { localStorage.setItem(W_KEY, String(Math.round(w))); } catch (x) {} }
    }
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });

  var form = el("form", "sp-form");
  var input = el("input", "sp-input"); input.type = "search"; input.maxLength = 200; input.autocomplete = "off"; input.placeholder = "Search";
  var go = el("button", "sp-go", "Search"); go.type = "submit";
  var closeBtn = el("button", "sp-close", "×"); closeBtn.type = "button"; closeBtn.setAttribute("aria-label", "Close");
  form.append(input, go, closeBtn);

  var tabs = el("div", "sp-tabs");
  var tabBtns = {};
  [["all", "All"], ["images", "Images"], ["news", "News"]].forEach(function (t) {
    var b = el("button", "sp-tab", t[1]); b.type = "button";
    b.addEventListener("click", function () { setTab(t[0]); });
    tabBtns[t[0]] = b; tabs.appendChild(b);
  });

  var status = el("div", "sp-status"); status.setAttribute("aria-live", "polite");
  var list = el("div", "sp-list");
  panel.append(form, tabs, status, list);
  document.body.append(back, panel);

  function openPanel() {
    panel.classList.add("show"); back.classList.add("show"); panel.setAttribute("aria-hidden", "false");
    setTimeout(function () { input.focus(); }, 200);
  }
  function stopWork() { runId++; clearTimeout(timer); if (ctrl) ctrl.abort(); }
  function closePanel() {
    panel.classList.remove("show"); back.classList.remove("show"); panel.setAttribute("aria-hidden", "true");
    stopWork(); setStatus("");
  }
  openBtn.addEventListener("click", function () { panel.classList.contains("show") ? closePanel() : openPanel(); });
  closeBtn.addEventListener("click", closePanel);
  back.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("show")) closePanel(); });

  function setTab(t) {
    tab = t;
    Object.keys(tabBtns).forEach(function (k) { tabBtns[k].setAttribute("aria-selected", String(k === t)); });
    list.classList.toggle("images", t === "images");
    stopWork(); list.replaceChildren(); setStatus("");
    if (input.value.trim().length >= 2) run();
  }

  function setStatus(text, retry) {
    status.replaceChildren();
    if (text) status.appendChild(el("span", "", text));
    if (retry) {
      var r = el("button", "sp-retry", "Try again"); r.type = "button"; r.addEventListener("click", run);
      status.appendChild(r);
    }
  }

  function renderText(r) {
    var url = safeUrl(r.url);
    var row = el("div", "sp-item");
    var t = el(url ? "a" : "div", "sp-title", clip(r.title || r.url || "Untitled", 200));
    if (url) { t.href = url; t.target = "_blank"; t.rel = "noopener noreferrer"; }
    var body = el("div", "sp-body");
    body.appendChild(t);
    if (r.snippet) body.appendChild(el("div", "sp-snip", clip(r.snippet, 400)));
    row.appendChild(body);
    var pic = safeUrl(r.thumb_url);
    if (pic) {  // same picture treatment on All and News
      var img = document.createElement("img");
      img.className = "sp-thumb"; img.src = pic; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { img.remove(); });
      row.appendChild(img);
    }
    return row;
  }
  // Picture windows: every clicked picture opens in its OWN window, in the middle of the screen. Several can be
  // open at once. Each window has its own bar on top of its picture (smaller, bigger, reset, close) that follows
  // the picture when it is moved or enlarged. Press, hold and drag a picture to move it anywhere. The window you
  // touch comes to the front. No blur and no dimming. Closing the Search panel does NOT close them: a picture goes away only when you close it.
  var wins = [], zTop = 200;
  function closeWin(w) {
    w.root.remove();
    wins = wins.filter(function (x) { return x !== w; });
  }
  function closeAllWins() { wins.slice().forEach(closeWin); }
  function toFront(w) { zTop += 2; w.root.style.zIndex = zTop; wins = wins.filter(function (x) { return x !== w; }); wins.push(w); }
  document.addEventListener("keydown", function (e) {  // Esc: the Search panel closes first; with the panel closed it closes the front picture
    if (e.key === "Escape" && wins.length && !panel.classList.contains("show")) closeWin(wins[wins.length - 1]);
  }, true);  // capture: runs before the panel's own Esc handler, so one key press closes only one thing

  function openViewer(r, thumb) {
    var full = safeUrl(r.image_url) || thumb;
    var page = safeUrl(r.url) || safeUrl(r.image_url);
    for (var i = 0; i < wins.length; i++) if (wins[i].key === full) { toFront(wins[i]); return; }  // already open: bring it forward
    var root = el("div", "sp-win");
    var box = el("div", "sp-lb-box");
    var img = document.createElement("img");
    img.className = "sp-lb-img"; img.alt = clip(r.title, 120); img.referrerPolicy = "no-referrer"; img.src = full;
    img.draggable = false;
    img.addEventListener("error", function () { if (img.src !== thumb) img.src = thumb; });  // full size failed: show the small one
    var cap = el("div", "sp-lb-cap"); cap.textContent = clip(r.title, 160);
    var meta = el("div", "sp-lb-meta");
    if (r.license) { var lic = el("span", ""); lic.textContent = clip(r.license, 60); meta.appendChild(lic); }
    if (page) {
      var open = el("a", ""); open.href = page; open.target = "_blank"; open.rel = "noopener noreferrer"; open.textContent = "Open source page";
      meta.appendChild(open);
    }
    box.appendChild(img); box.appendChild(cap); box.appendChild(meta);
    var bar = el("div", "sp-lb-bar");
    root.appendChild(box); root.appendChild(bar);

    var w = { key: full, root: root };
    var n = wins.length % 8;                      // each new window starts a little lower and to the right, so none hides another
    var tx = n * 28, ty = n * 28, sc = 1;
    function placeBar() {                         // the bar sits on top of the picture, centred, and never leaves the screen
      var rc = box.getBoundingClientRect();
      var bw = bar.offsetWidth || 150;
      var left = Math.min(Math.max(rc.left + rc.width / 2 - bw / 2, 4), window.innerWidth - bw - 4);
      var top = Math.min(Math.max(rc.top - 40, 4), window.innerHeight - 40);
      bar.style.left = left + "px"; bar.style.top = top + "px";
    }
    function apply() {
      box.style.transform = "translate(-50%,-50%) translate(" + tx + "px," + ty + "px) scale(" + sc + ")";
      placeBar();
    }
    function zoom(f) { sc = Math.min(6, Math.max(0.4, sc * f)); apply(); }
    function reset() { tx = 0; ty = 0; sc = 1; apply(); }
    function btn(label, text, fn) {
      var b = el("button", "sp-lb-btn"); b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label); b.title = label;
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      bar.appendChild(b); return b;
    }
    btn("Smaller", "\u2212", function () { zoom(1 / 1.25); });
    btn("Bigger", "+", function () { zoom(1.25); });
    btn("Reset size and position", "Reset", reset).classList.add("sp-lb-reset");
    btn("Close", "\u00d7", function () { closeWin(w); });
    bar.addEventListener("pointerdown", function () { toFront(w); });

    // press, hold and drag to move; two fingers to pinch; wheel to zoom; double click to toggle 2x
    var pts = {}, startDist = 0, startSc = 1;
    function dist() { var k = Object.keys(pts); if (k.length < 2) return 0; var p = pts[k[0]], q = pts[k[1]]; return Math.hypot(p.x - q.x, p.y - q.y); }
    box.addEventListener("pointerdown", function (e) {
      toFront(w);
      if (e.target.closest("a")) return;  // the "Open source page" link works as a link
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { box.setPointerCapture(e.pointerId); } catch (x) {}
      box.classList.add("drag");
      if (Object.keys(pts).length === 2) { startDist = dist(); startSc = sc; }
    });
    box.addEventListener("pointermove", function (e) {
      var p = pts[e.pointerId]; if (!p) return;
      var k = Object.keys(pts).length;
      if (k === 1) { tx += e.clientX - p.x; ty += e.clientY - p.y; apply(); }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (k === 2 && startDist) { sc = Math.min(6, Math.max(0.4, startSc * dist() / startDist)); apply(); }
    });
    function up(e) { delete pts[e.pointerId]; startDist = 0; if (!Object.keys(pts).length) box.classList.remove("drag"); }
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    box.addEventListener("wheel", function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    box.addEventListener("dblclick", function () { if (sc === 1) { sc = 2; apply(); } else { reset(); } });

    document.body.appendChild(root);
    wins.push(w); toFront(w);
    apply();
    img.addEventListener("load", placeBar);       // the picture's real size is known now: put the bar back on top of it
    window.addEventListener("resize", placeBar);
  }
  function renderImage(r) {
    var src = safeUrl(r.thumb_url) || safeUrl(r.image_url);
    if (!src) return null;
    var url = safeUrl(r.url) || safeUrl(r.image_url);
    var a = el(url ? "a" : "div", "sp-img");
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    var img = document.createElement("img");
    img.src = src; img.alt = clip(r.title, 120); img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () { a.remove(); });
    a.appendChild(img);
    a.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;  // open in a new tab as usual
      e.preventDefault();
      openViewer(r, src);
    });
    return a;
  }
  function render(results, images) {
    list.replaceChildren();
    if (tab === "all" && Array.isArray(images) && images.length) {  // a row of pictures above the text results
      var strip = el("div", "sp-strip");
      images.slice(0, 8).forEach(function (r) {
        if (!r || typeof r !== "object") return;
        var n = renderImage(r);
        if (n) strip.appendChild(n);
      });
      if (strip.children.length) list.appendChild(strip);
    }
    results.slice(0, MAX_RESULTS).forEach(function (r) {
      if (!r || typeof r !== "object") return;
      var node = tab === "images" ? renderImage(r) : renderText(r);
      if (node) list.appendChild(node);
    });
    return list.querySelectorAll(".sp-item,.sp-img").length;
  }

  function run() {
    var q = input.value.trim();
    if (q.length < 2) return;
    stopWork();
    var id = runId, type = tab;
    list.replaceChildren();
    setStatus("Searching…");
    ask(id, q, type, Date.now());
  }
  function ask(id, q, type, startedAt) {
    ctrl = new AbortController();
    fetch("/search?type=" + type + "&q=" + encodeURIComponent(q), { signal: ctrl.signal })
      .then(function (r) {
        if (r.status === 404) throw new Error("missing");
        if (r.status === 429) throw new Error("slow");
        if (!r.ok) throw new Error("fail");
        return r.json();
      })
      .then(function (d) {
        if (id !== runId) return;
        var n = render(Array.isArray(d.results) ? d.results : [], d.images);
        var searching = d.status === "searching";
        if (searching && Date.now() - startedAt < POLL_MAX_MS) {
          setStatus(n ? "Finding more…" : "Searching…");
          timer = setTimeout(function () { ask(id, q, type, startedAt); }, POLL_MS);
        } else {
          setStatus(n ? "" : "No results. Try different words.");
        }
      })
      .catch(function (e) {
        if (id !== runId || (e && e.name === "AbortError")) return;
        var m = e && e.message;
        if (m === "missing") setStatus("Search is not available yet.");
        else if (m === "slow") setStatus("Too many searches. Wait a moment.", true);
        else setStatus("Search failed. Try again.", true);
      });
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); run(); });

  setTab("all");
})();