/* links.js - links in chat messages are highlighted in light orange (and made clickable).
   - sent messages (orange bubble): light orange highlight with dark orange text, so it stands out
   - replies (dark bubble): light orange text on a soft orange highlight
   Plain web addresses typed or pasted into a message become real links; links that already exist
   get the same highlight. Download and file cards are left alone.
   Load it AFTER home.js. Nothing in home.js is changed. */
(function () {
  var css = [
    ".msg-bubble a:not(.dl-card):not(.ap-card){color:#ffbe85;background:rgba(255,170,90,.20);border-radius:4px;",
    "padding:0 4px;text-decoration:none;overflow-wrap:anywhere;}",
    ".msg-row.user .msg-bubble a:not(.dl-card):not(.ap-card){color:#7a3000;background:#ffd9b0;text-decoration:none;}",
    ".msg-bubble a:not(.dl-card):not(.ap-card):focus-visible{outline:2px solid #ffbe85;outline-offset:1px;}"
  ].join("");
  var st = document.createElement("style");
  st.id = "hpLinksCss";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var URL_RE = /https?:\/\/[^\s<>"'`]+/g;

  function typingNow() {
    try { return !!(typeof activeRun !== "undefined" && activeRun && activeRun.typing); } catch (e) { return false; }
  }

  function linkifyBubble(bubble) {
    var walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== bubble; p = p.parentNode) {
          var tag = p.nodeName;
          if (tag === "A" || tag === "CODE" || tag === "PRE" || tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
        }
        return /https?:\/\//.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var text = node.nodeValue, last = 0, m, frag = document.createDocumentFragment(), any = false;
      URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(text))) {
        var url = m[0].replace(/[.,;:!?)\]]+$/, "");           /* trailing punctuation is not part of the address */
        if (url.length < 10) continue;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = url;
        frag.appendChild(a);
        last = m.index + url.length;
        URL_RE.lastIndex = last;
        any = true;
      }
      if (!any) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  var timer = null;
  function run() {
    timer = null;
    if (typingNow()) { timer = setTimeout(run, 500); return; }   /* wait until the reply has finished typing */
    var bubbles = document.querySelectorAll(".msg-bubble");
    for (var i = 0; i < bubbles.length; i++) {
      if (/https?:\/\//.test(bubbles[i].textContent)) { try { linkifyBubble(bubbles[i]); } catch (e) {} }
    }
  }
  function schedule() { if (!timer) timer = setTimeout(run, 350); }

  try {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch (e) {}
  schedule();
})();