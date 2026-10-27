/* history-toggle.js - the "Read whole history" switch in Settings.
   When it is ON, every message you send also lets Hepozy read short excerpts of your OTHER chats (the whole
   history in the sidebar: newest 40 chats, the last 6 messages of each), so it can answer things like
   "what did we talk about yesterday". When it is OFF (the default) Hepozy reads only the current chat.
   The choice is saved on this device. It is added to the Settings window by itself, nothing in home.html changes. */
(function () {
  var KEY = "hp_read_all_history";
  function on() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function set(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }

  /* tell the server with every chat message */
  var realFetch = window.fetch;
  if (realFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if (method === "POST" && /\/chat(\?|$)/.test(url) && init && typeof init.body === "string" && on()) {
          var b = JSON.parse(init.body);
          b.use_all_history = true;
          init = Object.assign({}, init, { body: JSON.stringify(b) });
          return realFetch.call(this, input, init);
        }
      } catch (e) {}
      return realFetch.apply(this, arguments);
    };
  }

  var css = ".hp-mem-row{align-items:center;gap:12px}.hp-mem-text{display:flex;flex-direction:column;gap:3px;min-width:0}" +
    ".hp-mem-sub{font-size:11.5px;opacity:.6;line-height:1.35}" +
    ".hp-mem-btn{flex:0 0 auto;font:600 12.5px 'Sora',sans-serif;border:0;border-radius:999px;padding:8px 14px;cursor:pointer;" +
    "background:#3a3a3a;color:#fff}.hp-mem-btn.is-on{background:#ff7300}";

  function build() {
    var bodies = document.querySelectorAll(".modal-body");
    for (var i = 0; i < bodies.length; i++) {
      var body = bodies[i];
      if (body.querySelector(".hp-mem") || !/Delete account|Log out/i.test(body.textContent || "")) continue;
      if (!document.getElementById("hpMemCss")) {
        var st = document.createElement("style"); st.id = "hpMemCss"; st.textContent = css; document.head.appendChild(st);
      }
      var sec = document.createElement("div"); sec.className = "settings-section hp-mem";
      var lab = document.createElement("div"); lab.className = "settings-label"; lab.textContent = "Memory";
      var row = document.createElement("div"); row.className = "settings-row hp-mem-row";
      var tx = document.createElement("div"); tx.className = "hp-mem-text";
      var t1 = document.createElement("span"); t1.textContent = "Read whole history";
      var t2 = document.createElement("span"); t2.className = "hp-mem-sub";
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "hp-mem-btn";
      function paint() {
        btn.textContent = on() ? "On" : "Off"; btn.classList.toggle("is-on", on());
        btn.setAttribute("aria-pressed", on() ? "true" : "false");
        t2.textContent = on() ? "Hepozy reads your other chats too when you send a message."
                              : "Off: Hepozy reads only the chat you are in. Tap to let it read every chat in your sidebar.";
      }
      btn.addEventListener("click", function () { set(!on()); paint(); });
      paint();
      tx.appendChild(t1); tx.appendChild(t2); row.appendChild(tx); row.appendChild(btn);
      sec.appendChild(lab); sec.appendChild(row);
      body.insertBefore(sec, body.firstChild);
    }
  }
  function start() {
    build();
    new MutationObserver(build).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.hpHistory = { isOn: on, set: set };
})();