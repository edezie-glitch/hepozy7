/* logos.js - a company name in a reply gets its logo in front of it, and a link gets the logo of its site.
   Logos come from the site's own icon (Google's favicon service). If an icon cannot load it is simply hidden.
   Load it AFTER links.js. Nothing in home.js changes. */
(function () {
  var D = {
    "Google": "google.com", "Microsoft": "microsoft.com", "Apple": "apple.com", "Amazon": "amazon.com", "Meta": "meta.com",
    "Facebook": "facebook.com", "Instagram": "instagram.com", "WhatsApp": "whatsapp.com", "Tesla": "tesla.com", "Netflix": "netflix.com",
    "OpenAI": "openai.com", "Anthropic": "anthropic.com", "Nvidia": "nvidia.com", "NVIDIA": "nvidia.com", "Intel": "intel.com", "AMD": "amd.com",
    "Samsung": "samsung.com", "Sony": "sony.com", "Spotify": "spotify.com", "YouTube": "youtube.com", "LinkedIn": "linkedin.com",
    "GitHub": "github.com", "Supabase": "supabase.com", "Cloudflare": "cloudflare.com", "Groq": "groq.com", "Tavily": "tavily.com",
    "Shopee": "shopee.ph", "Lazada": "lazada.com.ph", "Grab": "grab.com", "GCash": "gcash.com", "Jollibee": "jollibee.com.ph",
    "Toyota": "toyota.com", "Honda": "honda.com", "Lenovo": "lenovo.com", "Dell": "dell.com", "ASUS": "asus.com", "Nike": "nike.com",
    "Adidas": "adidas.com", "Coca-Cola": "coca-cola.com", "Pepsi": "pepsi.com", "McDonald's": "mcdonalds.com", "Starbucks": "starbucks.com",
    "Uber": "uber.com", "Airbnb": "airbnb.com", "PayPal": "paypal.com", "Visa": "visa.com", "Mastercard": "mastercard.com", "Adobe": "adobe.com",
    "IBM": "ibm.com", "Salesforce": "salesforce.com", "Slack": "slack.com", "Zoom": "zoom.us", "Discord": "discord.com", "Telegram": "telegram.org",
    "TikTok": "tiktok.com", "Reddit": "reddit.com", "Wikipedia": "wikipedia.org", "Canva": "canva.com", "Figma": "figma.com", "Notion": "notion.so",
    "Stripe": "stripe.com", "Vercel": "vercel.com", "Netlify": "netlify.com", "Jira": "atlassian.com", "Atlassian": "atlassian.com",
    "draw.io": "draw.io", "Draw.io": "draw.io", "diagrams.net": "diagrams.net", "Mermaid": "mermaid.js.org", "PlantUML": "plantuml.com", "Gemini": "gemini.google.com", "Claude": "claude.ai",
    "ChatGPT": "chatgpt.com", "Hepozy": "hepozy.com", "Python": "python.org", "Windows": "microsoft.com"
  };
  var names = Object.keys(D).sort(function (a, b) { return b.length - a.length; }).map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
  var RE = new RegExp("(^|[^A-Za-z0-9_])(" + names.join("|") + ")(?![A-Za-z0-9_])", "g");
  var NOT_COMPANY = /^\s+(pie|juice|tree|river|rainforest|forest|cider|sauce)\b/i;   /* "apple pie" is not the company */

  var css = ".co-big .co-logo{width:44px;height:44px;border-radius:8px;padding:4px;margin-right:10px;vertical-align:-14px;}" +
            ".co-logo{width:16px;height:16px;border-radius:3px;vertical-align:-3px;margin-right:5px;background:#fff;object-fit:contain;}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var stats = { bubbles: 0, icons: 0, failed: 0 };
  function badge(host) {            /* the icon could not load: a letter badge shows instead, so something is always there */
    var b = document.createElement("span"); b.className = "co-logo";
    b.textContent = (host || "?").charAt(0).toUpperCase();
    b.style.cssText = "display:inline-block;text-align:center;font:700 11px/16px sans-serif;background:#4c8dff;color:#fff;";
    b.style.setProperty("color", "#fff", "important");
    return b;
  }
  function icon(host) {
    stats.icons++;
    var i = document.createElement("img"); i.className = "co-logo"; i.alt = ""; i.loading = "lazy"; i.decoding = "async";
    i.referrerPolicy = "no-referrer";
    i.src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=128";
    i.onerror = function () { stats.failed++; if (i.parentNode) i.parentNode.replaceChild(badge(host), i); };
    return i;
  }
  function typingNow() { try { return !!(typeof activeRun !== "undefined" && activeRun && activeRun.typing); } catch (e) { return false; } }

  function processBubble(bubble) {
    var row = bubble.closest(".msg-row"), prev = row && row.previousElementSibling;   /* "what is the logo of ..." -> big logos */
    if (prev && /\blogos?\b/i.test(prev.textContent || "")) bubble.classList.add("co-big");
    /* 1. links get their site's logo */
    bubble.querySelectorAll("a[href^='http']:not(.dl-card):not(.ap-card)").forEach(function (a) {
      if (a.getAttribute("data-co")) return;
      a.setAttribute("data-co", "1");
      try { a.insertBefore(icon(new URL(a.href).hostname), a.firstChild); } catch (e) {}
    });
    /* 2. company names in the text */
    var walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== bubble; p = p.parentNode) {
          var t = p.nodeName;
          if (t === "A" || t === "CODE" || t === "PRE" || t === "SCRIPT" || t === "STYLE" || (p.classList && p.classList.contains("co"))) return NodeFilter.FILTER_REJECT;
        }
        RE.lastIndex = 0;
        return RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var list = [], n; while ((n = walker.nextNode())) list.push(n);
    list.forEach(function (node) {
      var text = node.nodeValue, last = 0, m, frag = document.createDocumentFragment(), any = false, seen = {};
      RE.lastIndex = 0;
      while ((m = RE.exec(text))) {
        var name = m[2], start = m.index + m[1].length, end = start + name.length;
        if (NOT_COMPANY.test(text.slice(end, end + 12))) continue;
        frag.appendChild(document.createTextNode(text.slice(last, start)));
        var sp = document.createElement("span"); sp.className = "co"; sp.style.whiteSpace = "nowrap";
        sp.appendChild(icon(D[name])); sp.appendChild(document.createTextNode(name));
        frag.appendChild(sp); last = end; any = true;
      }
      if (!any) return;
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  var timer = null;
  function run() {
    timer = null;
    if (typingNow()) { timer = setTimeout(run, 600); return; }
    var bs = document.querySelectorAll(".msg-row.bot .msg-bubble:not(.typing)");
    stats.bubbles = bs.length;
    bs.forEach(function (b) { try { processBubble(b); } catch (e) { console.warn("[logos] error", e); } });
    console.log("[logos] bubbles:", stats.bubbles, "icons added:", stats.icons, "failed to load:", stats.failed);
  }
  function schedule() { if (!timer) timer = setTimeout(run, 500); }
  try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  schedule();
})();