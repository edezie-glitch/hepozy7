(function () {
  if (window.__buddies) return;
  window.__buddies = true;

  function init() {
    var pwd = document.querySelector('input[type="password"]');
    var anchor = document.querySelector('[data-buddies]');
    var header = document.querySelector('header');
    var form = pwd && pwd.closest('form');

    var wrap = document.createElement('div');
    wrap.className = 'buddies';
    wrap.setAttribute('aria-hidden', 'true');

    /* ---------- Mount: [data-buddies] > above login form > header ---------- */
    if (anchor) {
      wrap.className += ' block';
      anchor.appendChild(wrap);
    } else if (pwd) {
      var host = form || pwd.parentNode;
      wrap.className += ' block';
      host.parentNode.insertBefore(wrap, host);
    } else if (header) {
      header.insertBefore(wrap, header.querySelector('.a145'));
    } else {
      return;
    }

    /* ---------- Styles ---------- */
    var style = document.createElement('style');
    style.textContent =
      '.buddies{flex:0 0 auto;align-self:center;height:80px;pointer-events:none}' +
      '.buddies.block{display:block;height:110px;margin:0 auto 14px;text-align:center}' +
      '.buddies svg{display:block;height:100%;width:auto;overflow:visible}' +
      '.buddies.block svg{margin:0 auto}';
    document.head.appendChild(style);

    /* ---------- Helpers ---------- */
    var W = 320, H = 270, NS = 'http://www.w3.org/2000/svg';
    var DARK = '#1a0a99', BLACK = '#111', BROWN = '#993300';

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function arc(cx, cy, rx, ry, a0, a1, n) {
      var out = [];
      for (var i = 0; i <= n; i++) {
        var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
        out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      return out;
    }

    function densify(pts, step) {
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        var k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (var j = 0; j < k; j++) {
          out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
        }
      }
      return out;
    }

    /* ---------- Characters (back to front) ---------- */
    var chars = [
      {
        top: 15, bottom: 215, color: '#ffe100', eyeColor: '#fff', mouthColor: BLACK,
        body: densify([[70, 215]].concat(arc(97, 80, 65, 65, 180, 360, 28), [[162, 215]]), 8),
        eyes: [[61, 99], [108, 77]],
        mouth: [90, 108, 20],
        k: 0.11, ph: 0
      },
      {
        top: 25, bottom: 268, color: '#ff7a1f', eyeColor: '#fff', mouthColor: BROWN,
        body: densify(arc(191.5, 96.5, 71.5, 71.5, 180, 360, 28).concat([[263, 268], [120, 268]]), 8),
        eyes: [[169, 66], [226, 67]],
        mouth: [197, 92, 16],
        k: 0.13, ph: 1.4
      },
      {
        top: 145, bottom: 268, color: '#ff9455', eyeColor: DARK, mouthColor: BROWN,
        body: densify([[3, 268]].concat(arc(121, 213, 118, 68, 180, 360, 36), [[239, 268]]), 8),
        eyes: [[82, 185], [168, 186]],
        mouth: [125, 214, 22],
        k: 0.14, ph: 4.1
      },
      {
        top: 95, bottom: 268, color: BROWN, eyeColor: '#fff', mouthColor: BLACK,
        body: densify([[211, 95], [313, 95], [313, 268], [211, 268]], 8),
        eyes: [[238, 152], [284, 153]],
        mouth: [261, 174, 19],
        k: 0.12, ph: 2.8
      }
    ];

    /* ---------- Build SVG ---------- */
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    function mk(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }

    var t0 = performance.now();
    chars.forEach(function (c, ci) {
      var xs = c.body.map(function (p) { return p[0]; });
      c.mx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
      c.my = (c.top + c.bottom) / 2;
      c.mid = c.my;
      c.bx = { p: 0, v: 0 };
      c.sy = { p: 0, v: 0 };
      c.dx = 0; c.dy = 0;
      c.smile = 0;      // -1 frown, 0 flat, 1 smile
      c.sad = 0;        // 0..1
      c.shy = 0;        // 0..1 (looking away from the password)
      c.blinking = false; c.bs = 0;
      c.nextBlink = t0 + 700 + ci * 450 + Math.random() * 1500;

      var pupilColor = c.eyeColor === '#fff' ? DARK : '#fff';
      c.elBody = mk('polygon', { fill: c.color });
      c.elEyes = c.eyes.map(function () {
        var g = mk('g', {});
        var white = mk('circle', { cx: 0, cy: 0, r: 13, fill: c.eyeColor });
        var pupil = mk('circle', { cx: 0, cy: 0, r: 6.5, fill: pupilColor });
        g.appendChild(white); g.appendChild(pupil);
        g._pupil = pupil;
        return g;
      });
      c.pp = c.eyes.map(function () { return { x: 0, y: 0 }; });
      c.elMouth = mk('path', {
        fill: c.mouthColor, stroke: c.mouthColor, 'stroke-width': 4,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      });
      svg.appendChild(c.elBody);
      c.elEyes.forEach(function (e) { svg.appendChild(e); });
      svg.appendChild(c.elMouth);
    });

    wrap.appendChild(svg);

    /* ---------- State + actions ---------- */
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var hover = false;
    var shyT = false;          // password field focused
    var sadUntil = 0, happyUntil = 0;
    var typingTimer;

    function nod(amount) {
      chars.forEach(function (c, i) {
        setTimeout(function () { c.sy.v += amount || 2.6; }, i * 70);
      });
    }
    function sad() { sadUntil = performance.now() + 3000; happyUntil = 0; }
    function happy() { happyUntil = performance.now() + 1600; sadUntil = 0; nod(3.4); }

    // manual hooks, in case your login code wants to call them directly
    window.buddies = { nod: nod, sad: sad, happy: happy };

    window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; });

    // every button / link: nod
    var touch = false;                                                // last pointer was a finger
    document.addEventListener('pointerdown', function (e) {
      touch = e.pointerType === 'touch';
      mx = e.clientX; my = e.clientY;                                 // look where you tapped
      var onBtn = e.target.closest && e.target.closest('button, a');
      if (onBtn) nod();
      if (touch && onBtn) {                                           // phones: short smile on tap, then back to normal
        hover = true;
        setTimeout(function () { hover = false; }, 700);
      }
    });
    document.addEventListener('mouseover', function (e) {
      if (touch) return;                                              // a tap fakes mouseover and would leave the smile stuck
      var el = e.target.closest && e.target.closest('button, a');
      hover = !!el;
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      nod();
    });
    document.documentElement.addEventListener('mouseleave', function () { hover = false; });

    // done typing (username or password): nod after a short pause
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      var ty = (t.type || 'text').toLowerCase();
      if (['text', 'password', 'email', 'search', 'tel'].indexOf(ty) < 0) return;
      sadUntil = 0;                                                    // typing again clears the sad face
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () { if (t.value) nod(); }, 900);
    });

    // password field focused: look away to the left
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t && t.tagName === 'INPUT') {
        if (t.type === 'password') t.setAttribute('data-bpw', '1');   // survives show/hide toggles
        shyT = t.hasAttribute('data-bpw');
        if (!shyT) {                                                  // username etc: look at the field being typed in
          var b = t.getBoundingClientRect();
          mx = b.left + b.width / 2; my = b.top + b.height / 2;
        }
      }
    });
    document.addEventListener('focusout', function () { shyT = false; });

    // login result: watch fetch calls to login/signin/auth URLs
    if (window.fetch && !window.__buddiesFetch) {
      window.__buddiesFetch = true;
      var _fetch = window.fetch;
      window.fetch = function (input) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var p = _fetch.apply(this, arguments);
        if (/login|signin|sign-in|auth/i.test(url)) {
          p.then(function (res) { res.ok ? happy() : sad(); }, function () { sad(); });
        }
        return p;
      };
    }

    /* ---------- Warp: only the upper half moves ---------- */
    function warp(c, x, y) {
      var t = clamp((c.mid - y) / (c.mid - c.top), 0, 1);
      var w = t * t * (3 - 2 * t);
      return [x + c.bx.p * w, y + c.sy.p * w];
    }

    function spring(s, target, k, f) {
      s.v += (target - s.p) * k * f;
      s.v *= Math.pow(0.84, f);
      s.p += s.v * f;
    }

    /* ---------- Loop ---------- */
    var prev = performance.now();
    function tick(now) {
      var f = Math.min((now - prev) / 16.667, 3);
      prev = now;
      var t = now / 1000;
      var r = svg.getBoundingClientRect();

      if (r.width) {
        var ux = r.width / W, uy = r.height / H;
        var sadT = now < sadUntil ? 1 : 0;
        var happyT = now < happyUntil ? 1 : 0;
        var smileT = sadT ? -1 : ((happyT || hover) ? 1 : 0);

        chars.forEach(function (c) {
          c.sad += (sadT - c.sad) * Math.min(1, 0.12 * f);
          c.shy += ((shyT ? 1 : 0) - c.shy) * Math.min(1, 0.12 * f);

          var dx0 = clamp((mx - (r.left + c.mx * ux)) / 250, -1, 1);
          var dy0 = clamp((my - (r.top + c.my * uy)) / 250, -1, 1);
          var dx = dx0 * (1 - c.shy) + (-1.2) * c.shy;                  // shy: turn to the left
          var dy = dy0 * (1 - 0.8 * c.shy);
          c.dx += (dx - c.dx) * Math.min(1, 0.2 * f);
          c.dy += (dy - c.dy) * Math.min(1, 0.2 * f);

          spring(c.bx, c.dx * 34 + Math.sin(t * 1.3 + c.ph) * 3, c.k, f);
          spring(c.sy, clamp(c.dy * 10, -14, 9) + 9 * c.sad + Math.sin(t * 2 + c.ph) * 1, c.k, f);

          c.elBody.setAttribute('points', c.body.map(function (p) {
            var q = warp(c, p[0], p[1]);
            return q[0].toFixed(1) + ',' + q[1].toFixed(1);
          }).join(' '));

          // blink
          if (!c.blinking && now >= c.nextBlink) { c.blinking = true; c.bs = now; }
          var lid = 1;
          if (c.blinking) {
            var p = (now - c.bs) / 170;
            if (p >= 1) {
              c.blinking = false;
              c.nextBlink = now + (Math.random() < 0.2 ? 200 : 2000 + Math.random() * 3500);
            } else {
              lid = 1 - 0.92 * Math.sin(p * Math.PI);
            }
          }
          lid = Math.min(lid, 1 - 0.35 * c.sad);                        // sad: heavy eyelids

          // eyes
          c.eyes.forEach(function (pt, i) {
            var q = warp(c, pt[0], pt[1]);
            var ex = q[0] + c.dx * 9 - 5 * c.shy;
            var ey = q[1] + c.dy * 7 + 4 * c.sad;                       // sad: eyes droop
            c.elEyes[i].setAttribute('transform',
              'translate(' + ex.toFixed(1) + ',' + ey.toFixed(1) + ') scale(1,' + lid.toFixed(3) + ')');

            var ddx = mx - (r.left + ex * ux), ddy = my - (r.top + ey * uy);
            var d = Math.hypot(ddx, ddy) || 1;
            var k = clamp(d / 90, 0, 1); k = k * (2 - k);
            var reach = 6 * k;
            var tx = ddx / d * reach, ty = ddy / d * reach;
            tx = tx * (1 - c.shy) + (-6) * c.shy;                       // shy: pupils hard left
            ty = ty * (1 - c.shy) + 0.5 * c.shy + 2.5 * c.sad;          // sad: look down
            var pp = c.pp[i];
            pp.x += (tx - pp.x) * Math.min(1, 0.35 * f);
            pp.y += (ty - pp.y) * Math.min(1, 0.35 * f);
            c.elEyes[i]._pupil.setAttribute('cx', pp.x.toFixed(2));
            c.elEyes[i]._pupil.setAttribute('cy', pp.y.toFixed(2));
          });

          // mouth: frown when sad, smile on buttons / success, flat otherwise
          c.smile += (smileT - c.smile) * Math.min(1, 0.18 * f);
          var mw = c.mouth[2];
          var mq = warp(c, c.mouth[0], c.mouth[1]);
          var depth = Math.max(0.01, mw * (c.smile >= 0 ? 1.05 : 0.45) * Math.abs(c.smile));   // frown is shallower so it doesn't swallow the eyes
          var sweep = c.smile >= 0 ? 0 : 1;
          c.elMouth.setAttribute('transform',
            'translate(' + (mq[0] + c.dx * 9 - 4 * c.shy).toFixed(1) + ',' + (mq[1] + c.dy * 7 + 3 * c.sad).toFixed(1) + ')');
          c.elMouth.setAttribute('d',
            'M' + (-mw) + ',0 A' + mw + ',' + depth.toFixed(2) + ' 0 0 ' + sweep + ' ' + mw + ',0 Z');
        });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();