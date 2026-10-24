/* attach-preview.js - shows a PICTURE of the file's contents when the user attaches a document in the chat:
     1) in the box before sending (the small chip under the input),
     2) in the chat right after sending,
     3) when an old conversation is opened.
   The picture is the file's first page, drawn by the server from the file's own text (PDF, Word, Excel,
   CSV, TXT, MD). Pictures (jpg, png...) already show as pictures and are left alone. If a picture cannot be
   made, the old plain "file name" look is used, so nothing breaks.

   Load it AFTER home.js. It wraps renderStagedPreview() and replaces appendImageMessages() and
   appendStoredAttachment(); everything else in home.js stays untouched. */
(function () {
  var ORIGIN = (typeof API !== "undefined" && API) ? API : "";
  var SHADE = "linear-gradient(rgba(20,20,20,.15) 0%,rgba(20,20,20,.30) 40%,rgba(20,20,20,.92) 78%,rgba(20,20,20,.97))";

  /* Clean look: the page picture on top with no dark overlay (the text stays sharp), the file logo and name in a
     plain bar under it. No border, no shadow. */
  var BAR = "var(--surface2,#262626)";
  var css = [
    ".ap-card{display:flex;flex-direction:column;width:min(250px,72vw);box-sizing:border-box;border-radius:14px;",
    "overflow:hidden;text-decoration:none;color:#f2f2f2;background:" + BAR + ";font-family:'Sora',sans-serif;border:0;}",
    ".ap-page{display:block;width:100%;height:156px;background-color:#fff;background-size:100% auto;",
    "background-position:top center;background-repeat:no-repeat;}",
    ".ap-card:not(.ap-has) .ap-page,.ap-chip:not(.ap-has) .ap-page{display:none;}",
    ".ap-foot{display:flex;align-items:center;gap:9px;padding:9px 12px;min-width:0;}",
    ".ap-ico{flex:0 0 auto;width:20px;height:25px;display:flex;}",
    ".ap-ico svg{width:100%;height:100%;}",
    ".ap-meta{display:flex;flex-direction:column;min-width:0;gap:1px;}",
    ".ap-name{min-width:0;font-size:12.5px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".ap-type{font-size:11px;line-height:1.2;opacity:.6;}",
    ".ap-chip{position:relative;display:inline-flex;flex-direction:column;width:172px;box-sizing:border-box;margin:2px;",
    "border-radius:12px;overflow:hidden;background:" + BAR + ";color:#f2f2f2;border:0;vertical-align:top;}",
    ".ap-chip .ap-page{height:92px;}",
    ".ap-chip .ap-foot{padding:7px 9px;gap:7px;}",
    ".ap-chip .ap-ico{width:15px;height:19px;}",
    ".ap-chip .ap-name{font-size:11px;}",
    ".ap-chip .ap-type{font-size:10px;}",
    ".ap-chip button{position:absolute;top:5px;right:5px;width:20px;height:20px;line-height:18px;padding:0;border:none;",
    "border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:14px;cursor:pointer;}",
    /* home.css sizes every chip in the strip at 56 x 56; these are more specific, so the picture chip wins */
    ".staged-preview-strip>.ap-chip{width:172px;height:auto;display:inline-flex;}",
    ".staged-preview-strip .ap-chip button{top:5px;right:5px;width:20px;height:20px;background:rgba(0,0,0,.6);color:#fff;}"
  ].join("");

  function injectCss() {
    if (document.getElementById("apCss")) return;
    var s = document.createElement("style");
    s.id = "apCss";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  function token() { try { return TOKEN; } catch (e) { return ""; } }
  function extOf(n) { var m = /\.([A-Za-z0-9]{2,5})$/.exec(n || ""); return m ? m[1].toUpperCase() : "FILE"; }

  /* File-type logo: a paper sheet with a folded corner and a coloured band carrying the format name. */
  var ICON_COLORS = { PDF: "#E5322D", DOC: "#2B579A", DOCX: "#2B579A", XLS: "#1D6F42", XLSX: "#1D6F42", CSV: "#1D6F42",
                      TXT: "#6B7280", MD: "#6B7280" };
  var ICON_LABELS = { DOCX: "DOC", XLSX: "XLS" };
  function fileIconSvg(ext) {
    ext = String(ext || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    var color = ICON_COLORS[ext] || "#6B7280";
    var label = ICON_LABELS[ext] || ext || "FILE";
    return '<svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M5 1h16l8 8v28a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="#fff"/>' +
      '<path d="M21 1v6a2 2 0 0 0 2 2h6z" fill="#d4d4d4"/>' +
      '<rect x="8" y="12" width="12" height="1.6" rx=".8" fill="#c8c8c8"/>' +
      '<rect x="8" y="16" width="16" height="1.6" rx=".8" fill="#c8c8c8"/>' +
      '<rect x="3" y="23" width="26" height="12" rx="2" fill="' + color + '"/>' +
      '<text x="16" y="32" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8.5" ' +
      'font-weight="700" fill="#fff">' + label + '</text></svg>';
  }

  function isImage(t) { return String(t || "").indexOf("image/") === 0; }

  /* ---- pictures from the server (cached, so a file is only drawn once) ---- */
  var fileCache = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  var pathCache = {};

  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function blobUrl(res) {
    if (!res || !res.ok) return null;
    return res.blob().then(function (b) { return b && b.size ? URL.createObjectURL(b) : null; });
  }
  function thumbForFile(file) {
    if (fileCache && fileCache.has(file)) return fileCache.get(file);
    var p = (file.size > 5 * 1024 * 1024) ? Promise.resolve(null)
      : toBase64(file).then(function (b64) {
          return fetch(ORIGIN + "/attachment-thumb", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
            body: JSON.stringify({ name: file.name, data: b64 })
          });
        }).then(blobUrl).catch(function () { return null; });
    if (fileCache) fileCache.set(file, p);
    return p;
  }
  function thumbForPath(path) {
    if (!path) return Promise.resolve(null);
    if (pathCache[path]) return pathCache[path];
    var p = fetch(ORIGIN + "/attachment-thumb?path=" + encodeURIComponent(path), {
      headers: { Authorization: "Bearer " + token() }
    }).then(blobUrl).catch(function () { return null; });
    pathCache[path] = p;
    return p;
  }
  function paint(el, promise) {
    promise.then(function (u) {
      if (!u) return;
      var pg = el.querySelector(".ap-page");
      if (!pg) return;
      pg.style.backgroundImage = "url(" + u + ")";
      el.classList.add("ap-has");
    });
  }
  function typeLabel(name) {
    var e = extOf(name);
    return ({ PDF: "PDF document", DOCX: "Word document", DOC: "Word document", XLSX: "Excel spreadsheet", CSV: "CSV file",
              TXT: "Text file", MD: "Text file" })[e] || (e + " file");
  }
  /* page picture + bar (logo, name, type) */
  function fillCard(el, name) {
    var pg = document.createElement("span"); pg.className = "ap-page";
    var foot = document.createElement("span"); foot.className = "ap-foot";
    var ic = document.createElement("span"); ic.className = "ap-ico"; ic.innerHTML = fileIconSvg(extOf(name));
    var meta = document.createElement("span"); meta.className = "ap-meta";
    var nm = document.createElement("span"); nm.className = "ap-name"; nm.textContent = name; nm.title = name;
    var ty = document.createElement("span"); ty.className = "ap-type"; ty.textContent = typeLabel(name);
    meta.appendChild(nm); meta.appendChild(ty);
    foot.appendChild(ic); foot.appendChild(meta);
    el.appendChild(pg); el.appendChild(foot);
  }

  /* ---- the card used in the chat ---- */
  function makeCard(name, tag) {
    injectCss();
    var el = document.createElement(tag || "div");
    el.className = "ap-card";
    fillCard(el, name);
    return el;
  }

  /* 1) before sending: the chip above the text box.
     Two ways to find it, so it works even if home.js builds the chip differently:
     - a watcher on the page that notices any new item inside .staged-preview-strip
     - a wrapper around renderStagedPreview()
     Files are remembered by name from the file inputs and from home.js's stagedFiles list. */
  var known = {};  /* file name -> File */
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "INPUT" && t.type === "file" && t.files) {
      for (var i = 0; i < t.files.length; i++) known[t.files[i].name] = t.files[i];
    }
  }, true);
  document.addEventListener("drop", function (ev) {
    var fl = ev.dataTransfer && ev.dataTransfer.files;
    if (fl) for (var i = 0; i < fl.length; i++) known[fl[i].name] = fl[i];
  }, true);
  document.addEventListener("paste", function (ev) {
    var fl = ev.clipboardData && ev.clipboardData.files;
    if (fl) for (var i = 0; i < fl.length; i++) known[fl[i].name] = fl[i];
  }, true);

  function findFile(text) {
    var list = [];
    try { list = stagedFiles || []; } catch (e) {}
    for (var i = 0; i < list.length; i++) if (list[i] && text.indexOf(list[i].name) !== -1) return list[i];
    for (var n in known) if (known.hasOwnProperty(n) && text.indexOf(n) !== -1) return known[n];
    return null;
  }

  function decorateChip(chip) {
    if (!chip || chip.nodeType !== 1 || chip.classList.contains("ap-chip")) return;
    var file = findFile(chip.textContent || "") || findFile(chip.getAttribute("title") || "");
    if (!file || isImage(file.type)) return;       /* pictures already show as pictures */
    injectCss();
    /* Whatever home.js drew inside the chip (a generic file icon, a wrapped name, the x button) is replaced
       by: file logo + file name. Only the remove (x) button is kept. */
    var keep = [];
    for (var i = 0; i < chip.children.length; i++) {
      var c = chip.children[i], t = (c.textContent || "").trim();
      if (c.tagName === "BUTTON" || /^[\u00d7xX\u2715\u2716\u2a2f]$/.test(t)) keep.push(c);
    }
    while (chip.firstChild) chip.removeChild(chip.firstChild);
    chip.classList.add("ap-chip");
    chip.style.cssText = "";
    fillCard(chip, file.name);
    keep.forEach(function (k) { chip.appendChild(k); });
    paint(chip, thumbForFile(file));
  }

  /* A document the user just sent shows up in the chat as a message like "<file sign> name". Whatever way
     home.js draws it, it is swapped for the picture card (file logo, name, picture of the first page). */
  var SIGN = /^\s*\uD83D\uDCC4\s*/;
  function decorateSent(bubble) {
    if (!bubble || bubble.nodeType !== 1 || bubble.getAttribute("data-ap-done")) return;
    if (bubble.querySelector(".ap-card, img, video")) return;
    var raw = (bubble.textContent || "");
    if (!SIGN.test(raw)) return;
    var name = raw.replace(SIGN, "").trim();
    var file = known[name];
    if (!file || isImage(file.type)) return;
    bubble.setAttribute("data-ap-done", "1");
    injectCss();
    var card = makeCard(name);
    paint(card, thumbForFile(file));
    bubble.textContent = "";
    bubble.classList.add("img-bubble");
    bubble.appendChild(card);
  }

  function scanStrips() {
    var strips = document.querySelectorAll(".staged-preview-strip");
    for (var i = 0; i < strips.length; i++)
      for (var j = 0; j < strips[i].children.length; j++) decorateChip(strips[i].children[j]);
    var sent = document.querySelectorAll(".msg-row.user .msg-bubble");
    for (var k = 0; k < sent.length; k++) decorateSent(sent[k]);
  }
  try {
    new MutationObserver(function () { scanStrips(); }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  var origStaged = window.renderStagedPreview;
  if (typeof origStaged === "function") {
    window.renderStagedPreview = function (file) {
      var out = origStaged.apply(this, arguments);
      try { if (file && !isImage(file.type)) known[file.name] = file; scanStrips(); } catch (e) {}
      return out;
    };
  }

  /* Run apDebug() in the browser console if the picture does not show: it says which part is missing. */
  window.apDebug = function () {
    var f = new File(["Hello from the Hepozy test file.\nSecond line."], "apdebug.txt", { type: "text/plain" });
    var report = {
      scriptLoaded: true,
      hasToken: !!token(),
      renderStagedPreviewWrapped: typeof origStaged === "function",
      stagedFilesVisible: (function () { try { return Array.isArray(stagedFiles); } catch (e) { return false; } })()
    };
    return toBase64(f).then(function (b64) {
      return fetch(ORIGIN + "/attachment-thumb", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({ name: f.name, data: b64 })
      });
    }).then(function (r) {
      report.serverStatus = r.status;
      report.serverHint = r.status === 200 ? "OK, the server draws pictures"
        : r.status === 404 ? "route missing: main.py is the OLD one (replace it and restart)"
        : r.status === 401 || r.status === 403 ? "login/token problem"
        : r.status === 405 ? "route missing: main.py is the OLD one (replace it and restart)"
        : "see server log";
      console.log("[attach-preview]", report);
      return report;
    }).catch(function (e) { report.error = String(e); console.log("[attach-preview]", report); return report; });
  };
  console.log("[attach-preview] loaded. If a file picture does not show, run apDebug() in this console.");

  /* 2) right after sending */
  window.appendImageMessages = function (t) {
    stagedFiles.forEach(function (e) {
      if (!isImage(e.type)) {
        var row = document.createElement("div");
        row.className = "msg-row user attach-row";
        var bubble = document.createElement("div");
        bubble.className = "msg-bubble img-bubble";
        var card = makeCard(e.name);
        paint(card, thumbForFile(e));  /* already drawn when it was staged, so this is instant */
        bubble.appendChild(card);
        row.appendChild(bubble);
        messagesEl.appendChild(row);
        return;
      }
      var o = document.createElement("div");
      o.className = "msg-row user attach-row";
      var n = document.createElement("div");
      n.className = "msg-bubble img-bubble";
      o.appendChild(n);
      messagesEl.appendChild(o);
      var s = new FileReader();
      s.onload = function (i) {
        var a = document.createElement("img");
        a.src = i.target.result;
        a.style.cssText = "max-width:220px;border-radius:10px;display:block;";
        n.appendChild(a);
      };
      s.readAsDataURL(e);
    });
    clearStagedPreviews();
  };

  /* 3) an old conversation */
  window.appendStoredAttachment = function (t) {
    var e = document.createElement("div");
    e.className = "msg-row user";
    var o = document.createElement("div");
    if ((t.type || "").indexOf("image/") === 0) {
      o.className = "msg-bubble img-bubble";
      e.classList.add("attach-row");
      var n = document.createElement("img");
      n.src = /^https?:\/\//i.test(t.url) ? t.url : "";
      n.style.maxWidth = "220px"; n.style.borderRadius = "10px"; n.style.display = "block";
      o.appendChild(n);
    } else {
      o.className = "msg-bubble img-bubble";
      e.classList.add("attach-row");
      var a = makeCard(t.name || "file", "a");
      a.href = /^https?:\/\//i.test(t.url) ? t.url : "#";
      a.target = "_blank"; a.rel = "noopener";
      paint(a, thumbForPath(t.path));
      o.appendChild(a);
    }
    e.appendChild(o);
    messagesEl.appendChild(e);
  };
})();