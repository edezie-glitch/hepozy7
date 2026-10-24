/* greeting.js - replaces the fixed "Hi, <name>" on the home screen with a greeting that follows the
   time on the user's own device, and keeps it up to date while the page stays open.
   Load it AFTER home.js (it uses the USERNAME that home.js defines).

   05:00 - 10:59  Good morning
   11:00 - 13:29  Happy lunch
   13:30 - 17:59  Good afternoon
   18:00 - 21:59  Good evening
   22:00 - 23:59  Good night
   00:00 - 04:59  Up late
   Under the greeting there is one short compliment for that part of the day. It stays the same for the
   whole hour and changes on the next hour, so it never flickers.                              */
(function () {
  function greetingFor(date) {
    var m = date.getHours() * 60 + date.getMinutes();
    if (m >= 5 * 60 && m < 11 * 60) return "Good morning";
    if (m >= 11 * 60 && m < 13 * 60 + 30) return "Happy lunch";
    if (m >= 13 * 60 + 30 && m < 18 * 60) return "Good afternoon";
    if (m >= 18 * 60 && m < 22 * 60) return "Good evening";
    if (m >= 22 * 60) return "Good night";
    return "Up late";
  }
  window.hepozyGreeting = greetingFor;

  var COMPLIMENTS = {
    "Good morning": [
      "You started early. That already puts you ahead.",
      "A clear head and a full day, a great place to begin.",
      "Whatever you build today, you will build it well.",
      "Showing up first thing says a lot about you.",
      "Today looks like a good one for you."
    ],
    "Happy lunch": [
      "You have earned a proper break. Enjoy your meal.",
      "Good work this morning. Rest, eat well, then keep going.",
      "Take your time with lunch. The work will still be great after.",
      "You are doing better than you think. Eat something good.",
      "Half the day is done and you are still going strong."
    ],
    "Good afternoon": [
      "Your focus today has been impressive.",
      "Keep going. The hard part is already behind you.",
      "You are making real progress, even when it feels slow.",
      "Steady work like yours always pays off.",
      "Great to see you pushing through the afternoon."
    ],
    "Good evening": [
      "You put in real effort today. That counts for a lot.",
      "A good evening for good ideas, and you have plenty.",
      "Proud of the work you keep showing up to do.",
      "You made it through the day. Well done.",
      "Your hard work is adding up, one day at a time."
    ],
    "Good night": [
      "You did enough today. Be proud of it.",
      "Great effort today. Rest well, you earned it.",
      "One last thing, then rest. You have done well.",
      "Your work today mattered. Sleep well soon.",
      "Finish up gently. Tomorrow is another good day."
    ],
    "Up late": [
      "Your dedication is something else. Do not forget to rest.",
      "Late nights show how much you care about your work.",
      "Brilliant minds keep odd hours. Take care of yourself too.",
      "Still going, and still sharp. Sleep when you can.",
      "The quiet hours suit you. Rest soon."
    ]
  };

  function complimentFor(date, greet) {
    var list = COMPLIMENTS[greet] || [];
    if (!list.length) return "";
    var start = new Date(date.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((date - start) / 86400000);
    return list[(dayOfYear * 7 + date.getHours()) % list.length];
  }
  window.hepozyCompliment = complimentFor;

  function name() {
    try { if (typeof USERNAME === "string" && USERNAME) return USERNAME; } catch (e) {}
    return "";
  }

  function update() {
    var el = document.getElementById("welcomeTitle");
    if (!el) return;
    var n = name();
    var now = new Date();
    var greet = greetingFor(now);
    var text = greet + (n ? ", " + n : "");
    if (el.textContent !== text) el.textContent = text;

    /* the compliment sits right under the greeting */
    var c = document.getElementById("welcomeCompliment");
    if (!c) {
      c = document.createElement("p");
      c.id = "welcomeCompliment";
      c.className = "welcome-sub";
      el.insertAdjacentElement("afterend", c);
    }
    var line = complimentFor(now, greet);
    if (c.textContent !== line) c.textContent = line;
  }

  update();
  setInterval(update, 30000);                      /* the greeting changes while the page is open */
  document.addEventListener("visibilitychange", function () { if (!document.hidden) update(); });
  window.addEventListener("focus", update);
})();