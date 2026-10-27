/* pwa.js - makes the site installable as an app (Android, Windows, Mac, iPhone, iPad).
   Add ONE line to home.html (and login.html / register.html if you want):  <script src="/pwa.js?v=1"></script>
   It adds the manifest link, the icon and colour tags, registers the service worker, and shows a small
   "Install app" pill once (on iPhone it explains Share > Add to Home Screen). Nothing else on the page changes.
   Add ?nosw to any address to remove the service worker again. */
(function () {
  var head = document.head || document.documentElement;
  function add(tag, attrs) {
    var sel = tag + "[" + Object.keys(attrs)[0] + '="' + attrs[Object.keys(attrs)[0]] + '"]';
    if (document.querySelector(sel)) return;
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    head.appendChild(e);
  }
  add("link", { rel: "manifest", href: "/manifest.webmanifest" });
  add("link", { rel: "apple-touch-icon", href: "/icon-192.png" });
  add("meta", { name: "theme-color", content: "#1b1b1b" });
  add("meta", { name: "mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-title", content: "Hepozy" });
  add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });

  if ("serviceWorker" in navigator) {
    if (/[?&]nosw\b/.test(location.search)) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
    } else if (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      var reg = function () { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {}); };
      if (document.readyState === "complete") reg(); else window.addEventListener("load", reg);
    }
  }

  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  /* ADDED: once the app has been installed (or opened as an app) on this device, the install button never comes back,
     even when the site is opened in a normal browser tab afterwards. A browser only offers installation when the app is
     NOT installed, so that offer (beforeinstallprompt, below) clears this flag if the app was uninstalled. */
  function installedFlag() { try { return localStorage.getItem("hpInstalled") === "1"; } catch (e) { return false; } }
  function setInstalled() { try { localStorage.setItem("hpInstalled", "1"); } catch (e) {} }
  if (standalone) setInstalled();
  var reallyStandalone = standalone;
  standalone = standalone || installedFlag();
  function hideInstallUi() { ["hpInstallBtn", "hpInstall", "hpInstallMsg"].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); }); }
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(function (apps) {
      if (apps && apps.length) { setInstalled(); standalone = true; hideInstallUi(); }
    }).catch(function () {});
  }
  var deferred = null;
  function dismissed() { try { return localStorage.getItem("hpInstallDismissed") === "1"; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem("hpInstallDismissed", "1"); } catch (e) {} }

  /* The install button and pill float ABOVE the message box, never on top of it (on phones they used to cover the
     text area and the send button). They follow the box when it grows, when the keyboard opens and when the page resizes. */
  function inputBox() {
    var ids = ["bottomInputBox", "centerInputBox"];
    for (var i = 0; i < ids.length; i++) {
      var e = document.getElementById(ids[i]);
      if (e && e.offsetParent !== null && e.getBoundingClientRect().height > 0) return e;
    }
    return null;
  }
  function keepAbove(el, gap) {
    function place() {
      if (!el.parentNode) return;
      var box = inputBox(), vh = (window.visualViewport ? window.visualViewport.height + window.visualViewport.offsetTop : window.innerHeight);
      el.style.bottom = (box ? Math.max(12, Math.round(vh - box.getBoundingClientRect().top + gap)) : 14) + "px";
    }
    place();
    window.addEventListener("resize", place);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", place);
    var t = setInterval(function () { if (!el.parentNode) clearInterval(t); else place(); }, 400);
  }
  /* a little more room under the message box on phones, so the browser's bottom bar and the home indicator never cover it */
  (function () {
    var st = document.createElement("style");
    st.textContent = "@media (max-width:640px){.input-area{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 36px) !important}}";
    head.appendChild(st);
  })();

  function pill(text, actionText, onAction) {
    if (standalone || dismissed() || document.getElementById("hpInstall")) return;
    var s = document.createElement("style");
    s.textContent = "#hpInstall{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:900;display:flex;align-items:center;gap:12px;" +
      "max-width:calc(100vw - 24px);padding:10px 12px 10px 16px;border-radius:999px;background:#2a2a2a;color:#fff;font:500 13px 'Sora',sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45)}" +
      "#hpInstall b{font-weight:600}#hpInstall button{white-space:nowrap;font:600 12.5px 'Sora',sans-serif;border:0;border-radius:999px;cursor:pointer}" +
      "#hpInstall .go{background:#ff7300;color:#fff;padding:8px 14px}#hpInstall .x{background:transparent;color:#fff;font-size:18px;line-height:1;padding:2px 6px;opacity:.7}";
    document.head.appendChild(s);
    var box = document.createElement("div"); box.id = "hpInstall"; box.setAttribute("role", "dialog");
    var t = document.createElement("span"); t.textContent = text; box.appendChild(t);
    if (actionText) {
      var go = document.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = actionText;
      go.addEventListener("click", function () { onAction(); box.remove(); }); box.appendChild(go);
    }
    var x = document.createElement("button"); x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Close"); x.textContent = "\u00d7";
    x.addEventListener("click", function () { remember(); box.remove(); }); box.appendChild(x);
    document.body.appendChild(box);
    keepAbove(box, 12);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    /* the browser is offering to install, so the app is not installed (any older "installed" note was out of date) */
    try { localStorage.removeItem("hpInstalled"); } catch (x) {}
    standalone = reallyStandalone;
    if (!standalone) setTimeout(installButton, 300);
    setTimeout(function () {
      pill("Install Hepozy as an app", "Install", function () {
        remember();
        if (deferred) { deferred.prompt(); deferred = null; }
      });
    }, 4000);
  });
  window.addEventListener("appinstalled", function () { remember(); var b = document.getElementById("hpInstall"); if (b) b.remove(); });

  /* iPhone / iPad Safari has no install prompt: show how to do it once */
  var ua = navigator.userAgent || "";
  var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\//.test(ua);
  if (iOS && safari && !standalone) {
    window.addEventListener("load", function () {
      setTimeout(function () { pill("To install: tap Share, then Add to Home Screen", null, null); }, 5000);
    });
  }
  /* A button that is ALWAYS there until the app is installed. It installs when the browser allows it, and when the
     browser does not offer a prompt it tells the person exactly where the install item is in that browser. */
  function helpText() {
    if (iOS) return "On iPhone / iPad (Safari): tap the Share icon, then Add to Home Screen.";
    if (/Android/.test(ua)) return "Tap the browser menu (three dots), then Install app (or Add to Home screen).";
    if (/Firefox/.test(ua)) return "Firefox on a computer cannot install apps. Open Hepozy in Chrome or Edge, then click the install icon in the address bar.";
    return "Click the install icon at the right end of the address bar, or open the browser menu and choose Install Hepozy.";
  }
  function installButton() {
    if (standalone || document.getElementById("hpInstallBtn")) return;
    var st = document.createElement("style");
    st.textContent = "#hpInstallBtn{position:fixed;right:14px;bottom:14px;z-index:890;font:600 12.5px 'Sora',sans-serif;color:#fff;background:#ff7300;" +
      "border:0;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4)}" +
      "#hpInstallMsg{position:fixed;right:14px;z-index:891;max-width:min(300px,calc(100vw - 28px));padding:12px 14px;border-radius:14px;" +
      "background:#2a2a2a;color:#fff;font:500 13px/1.45 'Sora',sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45)}";
    document.head.appendChild(st);
    var b = document.createElement("button"); b.type = "button"; b.id = "hpInstallBtn"; b.textContent = "Install app";
    b.addEventListener("click", function () {
      var old = document.getElementById("hpInstallMsg"); if (old) { old.remove(); return; }
      if (deferred) { deferred.prompt(); deferred = null; return; }
      var m = document.createElement("div"); m.id = "hpInstallMsg"; m.textContent = helpText();
      document.body.appendChild(m); keepAbove(m, 56); setTimeout(function () { if (m.parentNode) m.remove(); }, 9000);
    });
    document.body.appendChild(b);
    keepAbove(b, 10);
  }
  window.addEventListener("appinstalled", function () { var b = document.getElementById("hpInstallBtn"); if (b) b.remove(); });
  window.addEventListener("appinstalled", function () { setInstalled(); standalone = true; hideInstallUi(); });  // ADDED
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(installButton, 800); });
  else setTimeout(installButton, 800);

  window.hpInstall = function () { if (deferred) { deferred.prompt(); deferred = null; } };
})();