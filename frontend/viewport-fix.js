/* viewport-fix.js - keeps the message box fully visible on phones.
   Phone browsers have a bottom bar and an on-screen keyboard that cover the lower part of a page sized with
   100vh. This sizes the app to the part of the screen you can really see, keeps the box above the keyboard,
   and leaves room for the home indicator. It is added to the page by itself; nothing in home.html changes. */
(function () {
  var de = document.documentElement;

  /* viewport-fit=cover lets the page use (and avoid) the notch and home-indicator areas */
  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement("meta"); vp.name = "viewport"; (document.head || de).appendChild(vp); }
  var c = vp.getAttribute("content") || "width=device-width, initial-scale=1";
  if (!/viewport-fit/.test(c)) c += ", viewport-fit=cover";
  if (!/interactive-widget/.test(c)) c += ", interactive-widget=resizes-content";
  vp.setAttribute("content", c);

  var st = document.createElement("style");
  st.textContent =
    "body,.chat-area{height:var(--app-h,100dvh) !important}" +
    ".sidebar{height:var(--app-h,100dvh) !important}" +
    /* the message box FLOATS: it is pinned to the bottom of the visible screen, takes no room of its own, and the
       messages scroll behind it with enough space at the end that the last one is never hidden */
    ".chat-area{position:relative}" +
    ".input-area{position:absolute !important;left:0;right:0;bottom:0;z-index:20;background:transparent !important;" +
    "pointer-events:none;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 14px) !important}" +
    ".input-area>*{pointer-events:auto}" +
    ".messages{padding-bottom:calc(var(--input-h,96px) + 28px) !important}" +
    "@media (max-width:640px){.input-area{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px) !important}}";
  (document.head || de).appendChild(st);

  function fit() {
    var vv = window.visualViewport;
    var h = vv ? vv.height : window.innerHeight;
    de.style.setProperty("--app-h", Math.round(h) + "px");
    if (vv && vv.offsetTop > 0) window.scrollTo(0, 0);   /* iOS pushes the page up when the keyboard opens */
    var sb = document.getElementById("messages");
    if (sb && document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) {
      setTimeout(function () { sb.scrollTop = sb.scrollHeight; }, 50);
    }
  }
  /* keep the space under the messages equal to the height of the floating box */
  function measure() {
    var ia = document.querySelector(".input-area");
    if (ia) de.style.setProperty("--input-h", Math.round(ia.getBoundingClientRect().height) + "px");
  }
  function watch() {
    var ia = document.querySelector(".input-area");
    if (!ia) return setTimeout(watch, 500);
    measure();
    if (window.ResizeObserver) new ResizeObserver(measure).observe(ia);
    else setInterval(measure, 500);
  }
  watch();
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", function () { setTimeout(fit, 250); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }
  document.addEventListener("focusin", function (e) {
    if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) setTimeout(function () { fit(); try { e.target.scrollIntoView({ block: "nearest" }); } catch (x) {} }, 300);
  });
  window.hpViewport = { fit: fit };
})();