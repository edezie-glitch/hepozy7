/* cleanurl.js - the address bar shows only the site (https://hepozy.com) while the app is open, not
   "/home.html" or "/h?u=...". Load it AFTER home.js. Reloading the page still works, because the server
   now serves the app at "/" (see main.py).
   Only the address shown changes; the page itself, its files and its login check are untouched. */
(function () {
  try {
    var p = location.pathname;
    if (/\/(home\.html|h)\/?$/.test(p) || /^\/u\/[^/]+\/?$/.test(p)) {
      history.replaceState(history.state, "", "/");
    }
  } catch (e) {}
})();