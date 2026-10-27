/* upload-menu.js - on every device, the Upload button opens a small sheet with three choices:
   Take a photo / Files / Image. (On a computer, Take a photo uses the webcam.)
   Picked files go through the page's own stageFile(), so everything after that is unchanged.
   Big photos (phone cameras make 3-10 MB) are shrunk first so they pass the 5 MB limit. */
(function () {
  if (window.__hpUploadMenu) return;
  window.__hpUploadMenu = true;

  function isPhone() {
    try {
      return (window.matchMedia && matchMedia("(pointer:coarse)").matches) || window.innerWidth <= 700;
    } catch (e) { return window.innerWidth <= 700; }
  }

  var st = document.createElement("style");
  st.textContent =
    ".um-back{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}" +
    ".um-sheet{width:100%;max-width:520px;background:#1b1b1b;border-radius:18px 18px 0 0;padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 14px);" +
    "display:flex;flex-direction:column;gap:6px;animation:um-up .16s ease-out}" +
    "@keyframes um-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}" +
    ".um-grab{width:38px;height:4px;border-radius:2px;background:#555;margin:2px auto 8px}" +
    ".um-opt{display:flex;align-items:center;gap:14px;width:100%;border:0;background:#262626;border-radius:12px;padding:15px 16px;" +
    "font:inherit;font-size:15px;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}" +
    ".um-opt:active{background:#333}" +
    ".um-opt svg{flex:none;stroke:#ff7300}" +
    "@media (min-width:701px){.um-back{align-items:center}.um-sheet{max-width:360px;border-radius:18px;padding-bottom:14px}.um-grab{display:none}}" +
    ".um-cam{display:flex;flex-direction:column;gap:10px;align-items:center;background:#1b1b1b;border-radius:16px;padding:12px;max-width:94vw}" +
    ".um-cam video{max-width:100%;max-height:64vh;border-radius:10px;background:#000}" +
    ".um-cam .um-row{display:flex;gap:10px;width:100%}.um-cam .um-opt{justify-content:center;padding:12px}";
  (document.head || document.documentElement).appendChild(st);

  var ICON = {
    camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    file: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    image: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
  };

  var inputs = {};
  function makeInput(key, accept, multiple, capture) {
    var i = document.createElement("input");
    i.type = "file";
    i.accept = accept;
    if (multiple) i.multiple = true;
    if (capture) i.setAttribute("capture", capture);
    i.style.display = "none";
    i.addEventListener("change", function () { handle(i); });
    document.body.appendChild(i);
    inputs[key] = i;
    return i;
  }
  function ensureInputs() {
    if (inputs.camera) return;
    makeInput("camera", "image/*", false, "environment");
    makeInput("files", ".pdf,.docx,.txt,.md,.csv,.xlsx", true);
    makeInput("image", "image/*", true);
  }

  /* shrink a big picture so it fits the upload limit; anything that cannot be decoded is passed on untouched */
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || file.size < 1.5 * 1024 * 1024 || !window.createImageBitmap) return resolve(file);
      createImageBitmap(file).then(function (bmp) {
        var max = 2000, r = Math.min(1, max / Math.max(bmp.width, bmp.height));
        var c = document.createElement("canvas");
        c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return resolve(file);
          var name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([b], name, { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.85);
      }, function () { resolve(file); });
    });
  }

  function handle(input) {
    var list = Array.prototype.slice.call(input.files || []);
    if (!list.length) return;
    Promise.all(list.map(shrink)).then(function (done) {
      if (typeof window.stageFile === "function") window.stageFile({ files: done, value: "" });
      input.value = "";
    });
  }

  function close() {
    var b = document.getElementById("umBack");
    if (b) b.remove();
  }

  function touchDevice() {
    try { return matchMedia("(pointer:coarse)").matches; } catch (e) { return false; }
  }

  /* computers have no camera sheet of their own, so the webcam is opened here; if it is blocked, the normal picker opens */
  function webcam() {
    if (touchDevice() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { inputs.camera.click(); return; }
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
      var back = document.createElement("div"); back.className = "um-back"; back.id = "umBack"; back.style.alignItems = "center";
      var box = document.createElement("div"); box.className = "um-cam";
      var v = document.createElement("video"); v.autoplay = true; v.muted = true; v.setAttribute("playsinline", ""); v.srcObject = stream;
      var row = document.createElement("div"); row.className = "um-row";
      function stop() { stream.getTracks().forEach(function (t) { t.stop(); }); close(); }
      var snap = document.createElement("button"); snap.type = "button"; snap.className = "um-opt"; snap.textContent = "Take photo";
      snap.addEventListener("click", function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          stop();
          if (b && typeof window.stageFile === "function") window.stageFile({ files: [new File([b], "photo.jpg", { type: "image/jpeg" })], value: "" });
        }, "image/jpeg", 0.88);
      });
      var no = document.createElement("button"); no.type = "button"; no.className = "um-opt"; no.textContent = "Cancel";
      no.addEventListener("click", stop);
      row.appendChild(snap); row.appendChild(no); box.appendChild(v); box.appendChild(row); back.appendChild(box);
      back.addEventListener("click", function (e) { if (e.target === back) stop(); });
      document.body.appendChild(back);
    }, function () { inputs.camera.click(); });
  }

  function open() {
    close();
    ensureInputs();
    var back = document.createElement("div");
    back.className = "um-back"; back.id = "umBack";
    var sheet = document.createElement("div");
    sheet.className = "um-sheet";
    sheet.innerHTML = '<div class="um-grab"></div>';
    [["camera", "Take a photo"], ["files", "Files"], ["image", "Image"]].forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "um-opt";
      b.innerHTML = ICON[o[0] === "files" ? "file" : o[0]] + "<span>" + o[1] + "</span>";
      b.addEventListener("click", function () { close(); if (o[0] === "camera") webcam(); else inputs[o[0]].click(); });
      sheet.appendChild(b);
    });
    back.appendChild(sheet);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
  }

  /* capture phase: runs before the label can open the normal picker */
  document.addEventListener("click", function (e) {
    var lab = e.target.closest && e.target.closest("label.icon-btn");
    if (!lab || !lab.querySelector('input[type="file"]')) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
})();