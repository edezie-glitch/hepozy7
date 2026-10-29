/* status-ticker.js - while Hepozy is working on an answer, the waiting bubble shows a changing status word
   ("Reading your question...", "Searching...", "Checking sources...") that changes every ~1.4 seconds.
   Load it AFTER home.js. It only adds a line inside the existing waiting bubble (.msg-bubble.typing); nothing in home.js changes. */
(function () {
  var css = ".hp-status{display:block;margin-top:6px;font:500 12.5px 'Sora',sans-serif;opacity:.75;white-space:nowrap;transition:opacity .25s;}" +
            ".hp-status.fade{opacity:0;}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var BASE = ["Reading your question", "Searching", "Checking sources", "Putting it together", "Almost there"];
  var VISUAL = ["Reading your request", "Planning the layout", "Drawing it", "Adding the labels", "Almost there"];
  var VIS_RE = /\b(diagram|flow ?chart|chart|graph|plot|draw|mind ?map|uml|erd|sequence|draw\.?io)\b/i;

  function lastUserText() {
    var rows = document.querySelectorAll(".msg-row.user .msg-bubble");
    return rows.length ? rows[rows.length - 1].textContent || "" : "";
  }
  function attach(bubble) {
    if (bubble.querySelector(".hp-status")) return;
    var words = VIS_RE.test(lastUserText()) ? VISUAL : BASE, i = 0;
    var s = document.createElement("span"); s.className = "hp-status"; s.textContent = words[0] + "…";
    bubble.appendChild(s);
    var t = setInterval(function () {
      if (!document.body.contains(s)) { clearInterval(t); return; }
      i = Math.min(i + 1, words.length - 1);              /* stays on the last word until the answer arrives */
      s.classList.add("fade");
      setTimeout(function () { s.textContent = words[i] + "…"; s.classList.remove("fade"); }, 220);
    }, 1400);
  }
  function scan() { document.querySelectorAll(".msg-bubble.typing").forEach(attach); }
  try { new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  scan();
})();