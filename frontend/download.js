/* download.js - the file download card. Load it AFTER home.js; it replaces appendDownloadLink()
   and leaves everything else in home.js untouched.

   What you get:
   - the card's BACKGROUND is a picture of the file's first page (drawn by the server from the file's own
     content), darkened so the text stays readable
   - the file-type logo (PDF, Word, Excel, CSV), the clean file name, "PDF · 1 page · 2 KB" and a Download button
   - the random part of a file name is never shown (old saved names are cleaned too)
   - clear states: Download -> Preparing -> Done, or "Expired" / "Retry"
   - works in every browser: a native download of the file (the server sends it as an attachment, clean name)
   - double clicks do nothing while it works; plain-link fallback in old browsers
   - the same file is never added twice to one message
   If the picture cannot be made, the card still works with a plain dark background. */
(function () {
  var ORIGIN = (typeof API !== "undefined" && API) ? API : "";
  var SHADE = "linear-gradient(rgba(20,20,20,.22) 0%,rgba(20,20,20,.35) 38%,rgba(20,20,20,.94) 70%,rgba(20,20,20,.98))";

  var css = [
    ".dl-card{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;align-self:flex-start;margin-top:8px;padding:12px;",
    "width:100%;max-width:380px;min-height:84px;box-sizing:border-box;border-radius:12px;overflow:hidden;",
    "background-color:var(--surface2,#2a2a2a);background-size:cover;background-position:top left;background-repeat:no-repeat;",
    "border:1px solid var(--border,#333);color:var(--text,#efefef);text-decoration:none;font-family:'Sora',sans-serif;",
    "cursor:pointer;}",
    ".dl-card:focus-visible{outline:2px solid var(--orange,#e8600a);outline-offset:2px;}",
    ".dl-card[aria-busy=true]{cursor:progress;opacity:.85;}",
    ".dl-card.has-img{min-height:190px;align-content:flex-end;border-color:rgba(255,255,255,.18);}",
    ".dl-ico{flex:0 0 auto;width:34px;height:42px;display:flex;}",
    ".dl-ico svg{width:100%;height:100%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}",
    ".dl-text{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;}",
    ".dl-name{font-size:13px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
    "text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".dl-sub{font-size:11.5px;color:var(--muted,#999);line-height:1.3;text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".dl-card.has-img .dl-sub{color:#d6d6d6;}",
    ".dl-act{flex:0 0 auto;padding:8px 12px;border-radius:8px;background:var(--orange,#e8600a);color:#fff;",
    "font-size:12px;font-weight:600;white-space:nowrap;}",
    ".dl-card.ok .dl-act{background:#2e8b57;}",
    ".dl-card.bad .dl-act{background:#8a3b3b;}",
    ".dl-card.bad .dl-sub{color:#f0a0a0;}"
  ].join("");

  function injectCss() {
    if (document.getElementById("dlCardCss")) return;
    var s = document.createElement("style");
    s.id = "dlCardCss";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }


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

  function cleanName(n) {
    return String(n || "document").replace(/-[0-9a-f]{16,}(?=\.[A-Za-z0-9]{2,5}$)/i, "");
  }
  function extOf(n) {
    var m = /\.([A-Za-z0-9]{2,5})$/.exec(n);
    return m ? m[1].toUpperCase() : "FILE";
  }
  function prettyName(n) {
    return n.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/-/g, " ");
  }
  function fetchWithTimeout(url, ms) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: "same-origin" })
      .finally(function () { clearTimeout(timer); });
  }

  window.appendDownloadLink = function (url, fileName, row) {
    if (typeof url !== "string" || url.charAt(0) !== "/" || url.indexOf("//") === 0) return;
    injectCss();

    var name = cleanName(fileName);
    var ext = extOf(name);
    var shown = prettyName(name) || "Document";
    var stored = url.split("?")[0].split("/").pop();

    var host = row || (typeof messagesEl !== "undefined" ? messagesEl : null);
    if (host && host.querySelector && host.querySelector('a[data-dl="' + url.replace(/"/g, "") + '"]')) return;

    var a = document.createElement("a");
    a.className = "dl-card";
    a.href = ORIGIN + url;
    a.setAttribute("download", name);
    a.setAttribute("data-dl", url);
    a.setAttribute("aria-label", "Download " + name);
    a.target = "_blank";
    a.rel = "noopener";

    var badge = document.createElement("span"); badge.className = "dl-ico"; badge.innerHTML = fileIconSvg(ext);
    var text = document.createElement("span"); text.className = "dl-text";
    var nm = document.createElement("span"); nm.className = "dl-name"; nm.textContent = shown; nm.title = name;
    var sub = document.createElement("span"); sub.className = "dl-sub"; sub.setAttribute("aria-live", "polite");
    var act = document.createElement("span"); act.className = "dl-act";
    text.appendChild(nm); text.appendChild(sub);
    a.appendChild(badge); a.appendChild(text); a.appendChild(act);

    var meta = ext + " file"; /* becomes "PDF · 1 page · 2 KB" once the server answers */
    var hasImg = false;
    var busy = false;
    function state(cls, subText, actText) {
      a.className = "dl-card" + (hasImg ? " has-img" : "") + (cls ? " " + cls : "");
      sub.textContent = subText;
      act.textContent = actText;
    }
    function idle() { state("", meta, "Download"); a.removeAttribute("aria-busy"); }
    idle();

    /* 1) the picture behind the card: the file's first page. Loaded first, shown only if it works. */
    try {
      var img = new Image();
      img.onload = function () {
        hasImg = true;
        a.style.backgroundImage = SHADE + ",url(" + ORIGIN + "/file-thumb/" + encodeURIComponent(stored) + ")";
        a.className = a.className.indexOf("has-img") < 0 ? a.className + " has-img" : a.className;
      };
      img.src = ORIGIN + "/file-thumb/" + encodeURIComponent(stored);
    } catch (e) {}

    /* 2) page count and size */
    try {
      fetchWithTimeout(ORIGIN + "/file-info/" + encodeURIComponent(stored), 8000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (info) {
          if (!info) return;
          var bits = [ext];
          if (info.pages) bits.push(info.pages + (info.pages === 1 ? " page" : " pages"));
          if (info.size_kb) bits.push(info.size_kb >= 1024 ? (info.size_kb / 1024).toFixed(1) + " MB" : info.size_kb + " KB");
          meta = bits.join(" · ");
          if (!busy && a.className.indexOf("ok") < 0 && a.className.indexOf("bad") < 0) sub.textContent = meta;
        })
        .catch(function () {});
    } catch (e) {}

    /* The download itself is the browser's own: a plain link to the file. The server sends the file as an
       "attachment" with its clean name, so Chrome, Edge, Firefox, Safari (Mac and iPhone), Samsung Internet
       and Android browsers all save it the same way. No in-memory copy of the file, no browser-specific tricks.
       Before it starts we only ask the server whether the file still exists, so "Expired" can be shown. */
    a.addEventListener("click", function (ev) {
      if (!window.fetch) return; /* very old browser: the plain link works by itself */
      ev.preventDefault();
      if (busy) return;
      busy = true;
      a.setAttribute("aria-busy", "true");
      state("", "Preparing your file…", "Please wait");

      function startDownload() {
        var tmp = document.createElement("a");
        tmp.href = ORIGIN + url;
        tmp.setAttribute("download", name);
        tmp.rel = "noopener";
        tmp.style.display = "none";
        document.body.appendChild(tmp);
        tmp.click();
        setTimeout(function () { tmp.remove(); }, 2000);
        state("ok", "Download started: " + name, "Done");
        setTimeout(idle, 3500);
      }
      fetchWithTimeout(ORIGIN + "/file-info/" + encodeURIComponent(stored), 8000)
        .then(function (r) { return r.ok ? r.json() : { error: "gone" }; })
        .then(function (info) {
          if (info && info.error) { var e = new Error("expired"); e.expired = true; throw e; }
          startDownload();
        }, function () { startDownload(); }) /* the check itself failed (network): still try the download */
        .catch(function (e) {
          if (e && e.expired) {
            state("bad", "This file expired. Ask Hepozy to create it again.", "Expired");
          } else {
            state("bad", "Could not download. Tap to try again.", "Retry");
            setTimeout(function () { if (!busy) idle(); }, 6000);
          }
        })
        .finally(function () { busy = false; a.removeAttribute("aria-busy"); });
    });

    if (row) row.appendChild(a);
    else if (typeof messagesEl !== "undefined" && messagesEl) {
      var d = document.createElement("div");
      d.className = "msg-row bot";
      d.appendChild(a);
      messagesEl.appendChild(d);
    }
    if (typeof scrollBottom === "function") scrollBottom();
  };
})();