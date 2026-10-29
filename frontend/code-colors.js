/* code-colors.js - code in a reply is coloured by its language: bash/shell green, Python blue, JavaScript yellow,
   HTML orange, CSS blue, SQL orange, JSON green, and so on. A coloured bar and a small language tag sit on the block.
   Short `inline code` is blue. The language is guessed from the code itself (the chat page does not keep the fence label).
   Load it AFTER home.js. Nothing in home.js changes. */
(function () {
  var L = {
    bash: ["Bash", "#6fd35a"], python: ["Python", "#5aa9e6"], js: ["JavaScript", "#f7df1e"], ts: ["TypeScript", "#5aa0e6"],
    html: ["HTML", "#ff7a50"], css: ["CSS", "#6aa5ff"], sql: ["SQL", "#f0a030"], json: ["JSON", "#9ad06b"], java: ["Java", "#f89820"],
    c: ["C / C++", "#6aa5e8"], go: ["Go", "#2fc8e8"], rust: ["Rust", "#dea584"], php: ["PHP", "#9aa5e0"], ruby: ["Ruby", "#e8524a"],
    xml: ["XML", "#ff9a6a"], yaml: ["YAML", "#9ad06b"], text: ["Code", "#6cb6ff"]
  };
  function guess(t) {
    var s = t.trim();
    if (/^#!.*\b(ba)?sh\b/m.test(s) || /^\s*(\$ |sudo |apt(-get)? |pip3? |npm |npx |yarn |cd |ls\b|mkdir |chmod |curl |wget |git |docker |export |echo |python3? |node |uvicorn |brew |cp |mv |rm |cat )/m.test(s) && !/[{};]\s*$/m.test(s)) return "bash";
    if (/^\s*<!doctype html|^\s*<(html|div|span|body|head|script|style|a|p|ul|form|section)\b/i.test(s)) return "html";
    if (/^\s*<\?xml|^\s*<[a-z][\w:-]*[^>]*>[\s\S]*<\/[a-z]/i.test(s) && !/[;{}]/.test(s)) return "xml";
    if (/^\s*[{\[][\s\S]*[}\]]\s*$/.test(s) && /"[^"\n]+"\s*:/.test(s) && !/\b(function|const|let|var|=>)\b/.test(s)) return "json";
    if (/^\s*(select|insert into|update|delete from|create table|alter table|with)\b[\s\S]*\b(from|into|set|table|values|where)\b/i.test(s)) return "sql";
    if (/^\s*(def |class \w+(\(.*\))?:|import \w|from \w+ import|print\(|if __name__|async def |@\w+)/m.test(s) && !/[;{]\s*$/m.test(s)) return "python";
    if (/\b(interface|type)\s+\w+\s*[={]|:\s*(string|number|boolean)\b/.test(s) && /\b(const|let|function|=>|export)\b/.test(s)) return "ts";
    if (/\b(const|let|var|function|console\.log|=>|document\.|require\(|import .* from)\b/.test(s)) return "js";
    if (/^\s*([.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*)\s*\{[^}]*:[^}]*;?[^}]*\}/m.test(s) && !/\b(function|const|let)\b/.test(s)) return "css";
    if (/^\s*package main|\bfunc \w+\(|:= /m.test(s)) return "go";
    if (/\bfn \w+\(|let mut |println!\(|impl \w+/.test(s)) return "rust";
    if (/<\?php|\$\w+\s*=/.test(s)) return "php";
    if (/\b(public|private) (static )?(class|void|int|String)\b|System\.out\./.test(s)) return "java";
    if (/#include\s*<|\bint main\s*\(|std::|printf\(/.test(s)) return "c";
    if (/^\s*[\w-]+:\s*\S+/m.test(s) && !/[;{}()]/.test(s)) return "yaml";
    return "text";
  }
  function style(el, c) { el.style.setProperty("color", c, "important"); }
  function paint(bubble) {
    bubble.querySelectorAll("pre").forEach(function (pre) {
      if (pre.getAttribute("data-lang")) return;
      var code = pre.querySelector("code") || pre, key = guess(code.textContent || ""), info = L[key] || L.text;
      pre.setAttribute("data-lang", key);
      style(code, info[1]);
      code.querySelectorAll("*").forEach(function (x) { style(x, info[1]); });
      pre.style.setProperty("border-left", "3px solid " + info[1], "important");
      var tag = pre.parentNode && pre.parentNode.parentNode && pre.parentNode.parentNode.classList.contains("box-wrap") ? pre.parentNode.parentNode.firstChild : null;
      if (tag && !tag.querySelector(".cc-tag")) {
        var s = document.createElement("span"); s.className = "cc-tag"; s.textContent = info[0];
        s.style.cssText = "margin-right:auto;font:600 11px 'Sora',sans-serif;align-self:center;";
        style(s, info[1]);
        tag.insertBefore(s, tag.firstChild);
      }
    });
    bubble.querySelectorAll("code").forEach(function (c) {          /* short inline code: blue; a command: green */
      if (c.closest("pre") || c.getAttribute("data-cc")) return;
      c.setAttribute("data-cc", "1");
      var t = c.textContent || "";
      style(c, /^(\$ |sudo |pip3? |npm |npx |cd |git |docker |python3? |node |curl |apt(-get)? |uvicorn )/.test(t) ? "#6fd35a" : "#6cb6ff");
    });
  }
  function typingNow() { try { return !!(typeof activeRun !== "undefined" && activeRun && activeRun.typing); } catch (e) { return false; } }
  var timer = null;
  function run() {
    timer = null;
    if (typingNow()) { timer = setTimeout(run, 600); return; }
    document.querySelectorAll(".msg-bubble:not(.typing)").forEach(function (b) { try { paint(b); } catch (e) {} });
  }
  function schedule() { if (!timer) timer = setTimeout(run, 400); }
  try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  schedule();
})();