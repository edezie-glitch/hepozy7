/* image-viewer.js - tap a picture in the chat and it opens full size in the centre of the screen.
   - only the picture on a plain dark screen (no blur), tap anywhere outside the picture, the x or Esc to close
   - if several pictures were sent together (also in an old chat) there are left and right buttons, a counter,
     the arrow keys and swipe left / right
   Works for pictures you just sent and for pictures loaded from an old conversation.
   Load it after home.js. It only listens for taps, nothing else in the page changes. */
(function () {
  var css =
    ".iv-back{position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;" +
    "touch-action:pan-y}" +
    ".iv-img{max-width:92vw;max-height:86vh;max-height:86dvh;object-fit:contain;display:block;user-select:none;-webkit-user-select:none}" +
    ".iv-btn{position:absolute;display:flex;align-items:center;justify-content:center;width:46px;height:46px;border:0;border-radius:50%;" +
    "background:rgba(255,255,255,.16);color:#fff;font:400 26px/1 'Sora',sans-serif;cursor:pointer;padding:0}" +
    ".iv-prev{left:max(12px,env(safe-area-inset-left,0px));top:50%;margin-top:-23px}" +
    ".iv-next{right:max(12px,env(safe-area-inset-right,0px));top:50%;margin-top:-23px}" +
    ".iv-close{top:max(12px,env(safe-area-inset-top,0px));right:max(12px,env(safe-area-inset-right,0px));font-size:24px}" +
    ".iv-count{position:absolute;bottom:max(16px,env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);color:#fff;" +
    "font:500 13px 'Sora',sans-serif;background:rgba(0,0,0,.45);padding:6px 12px;border-radius:999px}" +
    ".img-bubble img,.attach-row img{cursor:zoom-in}";
  function injectCss() {
    if (document.getElementById("ivCss")) return;
    var s = document.createElement("style"); s.id = "ivCss"; s.textContent = css; document.head.appendChild(s);
  }

  function rowImg(row) {
    if (!row || !row.classList || !row.classList.contains("attach-row")) return null;
    if (row.querySelector(".ap-card")) return null;           /* documents are not pictures */
    return row.querySelector("img");
  }
  /* the pictures sent together = the pictures in neighbouring attachment rows */
  function groupOf(img) {
    var row = img.closest(".msg-row");
    var rows = [row], p = row.previousElementSibling, n = row.nextElementSibling;
    while (p && rowImg(p)) { rows.unshift(p); p = p.previousElementSibling; }
    while (n && rowImg(n)) { rows.push(n); n = n.nextElementSibling; }
    var imgs = rows.map(rowImg).filter(Boolean);
    return { imgs: imgs, index: Math.max(0, imgs.indexOf(img)) };
  }

  var open = null;
  function close() {
    if (!open) return;
    document.removeEventListener("keydown", open.key, true);
    open.back.remove();
    document.body.style.overflow = open.prevOverflow;
    open = null;
  }
  function show(list, start) {
    injectCss();
    close();
    var i = start, many = list.length > 1;
    var back = document.createElement("div"); back.className = "iv-back"; back.setAttribute("role", "dialog"); back.setAttribute("aria-modal", "true");
    var im = document.createElement("img"); im.className = "iv-img"; im.alt = "";
    var x = document.createElement("button"); x.type = "button"; x.className = "iv-btn iv-close"; x.setAttribute("aria-label", "Close"); x.textContent = "×";
    var count = document.createElement("div"); count.className = "iv-count";
    var prev, next;
    function paint() {
      im.src = list[i].currentSrc || list[i].src;
      count.textContent = (i + 1) + " / " + list.length;
    }
    function go(d) { i = (i + d + list.length) % list.length; paint(); }
    back.appendChild(im); back.appendChild(x);
    if (many) {
      prev = document.createElement("button"); prev.type = "button"; prev.className = "iv-btn iv-prev"; prev.setAttribute("aria-label", "Previous picture"); prev.textContent = "‹";
      next = document.createElement("button"); next.type = "button"; next.className = "iv-btn iv-next"; next.setAttribute("aria-label", "Next picture"); next.textContent = "›";
      prev.addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
      next.addEventListener("click", function (e) { e.stopPropagation(); go(1); });
      back.appendChild(prev); back.appendChild(next); back.appendChild(count);
    }
    x.addEventListener("click", function (e) { e.stopPropagation(); close(); });
    back.addEventListener("click", function (e) { if (e.target !== im) close(); });
    var sx = null;
    back.addEventListener("touchstart", function (e) { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    back.addEventListener("touchend", function (e) {
      if (sx === null || !many) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (many && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (many && e.key === "ArrowRight") { e.preventDefault(); go(1); }
    }
    document.addEventListener("keydown", key, true);
    open = { back: back, key: key, prevOverflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
    document.body.appendChild(back);
    paint();
  }

  document.addEventListener("click", function (e) {
    var img = e.target && e.target.tagName === "IMG" ? e.target : null;
    if (!img || img.closest(".iv-back") || img.closest(".staged-preview-strip")) return;
    var row = img.closest(".msg-row.user");
    if (!row || !row.classList.contains("attach-row") || img.closest(".ap-card")) return;
    e.preventDefault(); e.stopPropagation();
    var g = groupOf(img);
    show(g.imgs, g.index);
  }, true);
  window.hpViewer = { close: close };
})();