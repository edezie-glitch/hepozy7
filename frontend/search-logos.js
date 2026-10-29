/* search-logos.js - every search result shows the site's logo and its domain in blue above the title.
   Load it AFTER search.js. Nothing in search.js changes. */
(function () {
  var css = ".sp-site{display:flex;align-items:center;gap:7px;margin:0 0 3px;font:500 12.5px 'Sora',sans-serif;}" +
            ".sp-site img{width:18px;height:18px;border-radius:4px;background:#fff;object-fit:contain;}" +
            ".sp-site span{color:#3b8cff !important;overflow-wrap:anywhere;}" +
            ".sp-item a.sp-title{color:#3b8cff !important;}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
  function mark(item) {
    if (item.getAttribute("data-site")) return;
    var a = item.querySelector("a.sp-title, a[href^='http']");
    if (!a || !a.href) return;
    var host; try { host = new URL(a.href).hostname.replace(/^www\./, ""); } catch (e) { return; }
    item.setAttribute("data-site", "1");
    var row = document.createElement("div"); row.className = "sp-site";
    var img = document.createElement("img"); img.alt = ""; img.referrerPolicy = "no-referrer";
    img.src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64";
    img.onerror = function () { img.remove(); };
    var t = document.createElement("span"); t.textContent = host;
    row.appendChild(img); row.appendChild(t);
    var body = item.querySelector(".sp-body") || item;
    body.insertBefore(row, body.firstChild);
  }
  function scan() { document.querySelectorAll(".sp-item").forEach(mark); }
  try { new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  scan();
})();