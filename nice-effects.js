/*!
 * NiCE Designer — reusable canvas effects
 * -------------------------------------------------------------
 * Two drop-in visual effects, each applied to any container with
 * a single call. Designed to be portable into the NiCE Designer
 * plugin later — no framework, no build step.
 *
 *   NiceEffects.liquidFill(container, { color });
 *   NiceEffects.lightning(container, { color });
 *
 * liquidFill  — on hover, a pool of small particles (Matter.js physics)
 *               fills the container in `color` and sloshes with the cursor.
 *               Requires Matter.js to be loaded on the page.
 *
 * lightning   — a plasma-ball effect: filaments in `color` radiate from a
 *               central electrode, flicker, and bend toward the cursor.
 *               Optional floating light motes drift around the edges.
 *
 * Both return a handle with `.destroy()`. Both auto-pause when the
 * container scrolls off-screen.
 */
(function (global) {
  'use strict';

  var DPR = Math.min(global.devicePixelRatio || 1, 2);

  /* ---------- shared helpers ---------- */

  // Inject the metaball "goo" SVG filter once (used by liquidFill).
  function ensureGoo() {
    if (document.getElementById('nice-goo-defs')) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'nice-goo-defs');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    svg.innerHTML =
      '<filter id="nice-goo">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />' +
        '<feColorMatrix in="blur" mode="matrix" ' +
          'values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />' +
        '<feBlend in="SourceGraphic" in2="goo" />' +
      '</filter>';
    document.body.appendChild(svg);
  }

  // Make `container` a positioning context that clips, and lift its current
  // children above the effect canvases we insert as the first child.
  function prep(container) {
    var cs = getComputedStyle(container);
    if (cs.position === 'static') container.style.position = 'relative';
    if (cs.overflow === 'visible') container.style.overflow = 'hidden';
    for (var i = 0; i < container.children.length; i++) {
      var ch = container.children[i];
      var ccs = getComputedStyle(ch);
      if (ccs.position === 'static') ch.style.position = 'relative';
      if (ccs.zIndex === 'auto') ch.style.zIndex = '1';
    }
  }

  function hexToRgb(hex) {
    hex = (hex || '').trim().replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function lighten(rgb, amt) {
    return {
      r: Math.round(rgb.r + (255 - rgb.r) * amt),
      g: Math.round(rgb.g + (255 - rgb.g) * amt),
      b: Math.round(rgb.b + (255 - rgb.b) * amt)
    };
  }
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }

  // Run `fn` (a rAF loop starter) only while the element is on screen.
  function onScreen(el, start, stop) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.02 });
    io.observe(el);
    return io;
  }

  /* ---------- liquid fill ---------- */

  function liquidFill(container, opts) {
    opts = opts || {};
    var color = opts.color || '#3694FC';
    var opacity = opts.opacity != null ? opts.opacity : 0.5;
    var M = global.Matter;
    if (!M) { (global.console || {}).warn && console.warn('[NiceEffects] liquidFill requires Matter.js'); return null; }

    ensureGoo();
    prep(container);

    var fx = document.createElement('div');
    fx.className = 'nice-liquid-fx';
    var canvas = document.createElement('canvas');
    canvas.className = 'nice-liquid-canvas';
    fx.appendChild(canvas);
    container.insertBefore(fx, container.firstChild);
    var ctx = canvas.getContext('2d');

    var engine = null, particles = [], W = 0, H = 0, running = false, raf = null;

    function build() {
      W = container.clientWidth; H = container.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      engine = M.Engine.create();
      engine.gravity.y = 1;
      var wt = 60; // thick walls so fast particles can't tunnel out
      M.World.add(engine.world, [
        M.Bodies.rectangle(W / 2, H + wt / 2, W + wt * 2, wt, { isStatic: true }),
        M.Bodies.rectangle(-wt / 2, H / 2, wt, H * 4, { isStatic: true }),
        M.Bodies.rectangle(W + wt / 2, H / 2, wt, H * 4, { isStatic: true }),
        M.Bodies.rectangle(W / 2, -H * 1.5, W + wt * 2, wt, { isStatic: true })
      ]);

      var count = opts.count || Math.max(110, Math.round(W * 0.6));
      particles = [];
      for (var i = 0; i < count; i++) {
        var rad = 1.75 + Math.random() * 0.75;
        particles.push(M.Bodies.circle(
          20 + Math.random() * (W - 40),
          H - 10 - Math.random() * 70,
          rad,
          { restitution: 0.4, friction: 0.02, frictionAir: 0.008, density: 0.001 }
        ));
      }
      M.World.add(engine.world, particles);
    }

    function splash() {
      for (var i = 0; i < particles.length; i++) {
        M.Body.setVelocity(particles[i], { x: (Math.random() - 0.5) * 11, y: -6 - Math.random() * 9 });
      }
    }

    function loop() {
      M.Engine.update(engine, 1000 / 60);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      var moving = false;
      for (var i = 0; i < particles.length; i++) {
        var b = particles[i];
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
        ctx.fill();
        if (Math.abs(b.velocity.x) + Math.abs(b.velocity.y) > 0.12) moving = true;
      }
      raf = (running || moving) ? requestAnimationFrame(loop) : null;
    }

    function steer(e) {
      if (!engine) return;
      var r = container.getBoundingClientRect();
      engine.gravity.x = ((e.clientX - r.left) / r.width - 0.5) * 1.6;
    }
    function enter(e) {
      if (!engine) build();
      running = true;
      fx.style.opacity = opacity;
      steer(e);
      splash();
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function leave() {
      running = false;
      fx.style.opacity = 0;
      if (engine) engine.gravity.x = 0;
    }

    container.addEventListener('mouseenter', enter);
    container.addEventListener('mousemove', steer);
    container.addEventListener('mouseleave', leave);

    var rt = null;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!engine) return;
        M.World.clear(engine.world, false);
        M.Engine.clear(engine);
        engine = null;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        ctx.clearRect(0, 0, W, H);
      }, 200);
    }
    global.addEventListener('resize', onResize);

    return {
      destroy: function () {
        container.removeEventListener('mouseenter', enter);
        container.removeEventListener('mousemove', steer);
        container.removeEventListener('mouseleave', leave);
        global.removeEventListener('resize', onResize);
        if (raf) cancelAnimationFrame(raf);
        fx.remove();
      }
    };
  }

  /* ---------- lightning (plasma ball) ---------- */

  function lightning(container, opts) {
    opts = opts || {};
    var baseRgb = hexToRgb(opts.color || '#B98FFF');
    var glowRgb = hexToRgb(opts.glow || '#6100FF');
    var brightRgb = lighten(baseRgb, 0.55);
    var opacity = opts.opacity != null ? opts.opacity : 0.5;
    var moteCount = opts.motes != null ? opts.motes : 54;
    var followPointer = opts.followPointer !== false;

    prep(container);

    var plasma = document.createElement('canvas');
    plasma.className = 'nice-plasma-canvas';
    plasma.style.opacity = opacity;
    container.insertBefore(plasma, container.firstChild);
    var ctx = plasma.getContext('2d');

    var moteCanvas = null, mctx = null, motes = [];
    if (moteCount > 0) {
      moteCanvas = document.createElement('canvas');
      moteCanvas.className = 'nice-motes-canvas';
      container.insertBefore(moteCanvas, plasma.nextSibling);
      mctx = moteCanvas.getContext('2d');
    }

    var W = 0, H = 0, cx = 0, cy = 0;
    function resize() {
      W = container.clientWidth; H = container.clientHeight;
      cx = W / 2; cy = H / 2;
      [plasma, moteCanvas].forEach(function (c) {
        if (!c) return;
        c.width = W * DPR; c.height = H * DPR;
        c.style.width = W + 'px'; c.style.height = H + 'px';
        c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
      });
    }
    resize();
    global.addEventListener('resize', resize);

    var COUNT = 7, tendrils = [];
    for (var i = 0; i < COUNT; i++) {
      tendrils.push({
        angle: (i / COUNT) * Math.PI * 2,
        angleV: (Math.random() - 0.5) * 0.012,
        reach: 0.55 + Math.random() * 0.4,
        tx: cx, ty: cy
      });
    }
    for (var m = 0; m < moteCount; m++) {
      motes.push({
        d: Math.random(),
        speed: (Math.random() < 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.03),
        inset: 4 + Math.random() * 26,
        osc: 4 + Math.random() * 10,
        oscSpeed: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 1.0,
        tw: 0.3 + Math.random() * 0.7
      });
    }

    var pointer = { x: 0, y: 0, active: false };
    function onMove(e) {
      var r = container.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    }
    function onLeave() { pointer.active = false; }
    if (followPointer) {
      container.addEventListener('mousemove', onMove);
      container.addEventListener('mouseleave', onLeave);
    }

    function bolt(x1, y1, x2, y2, disp) {
      var pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }], d = disp;
      for (var it = 0; it < 5; it++) {
        var np = [];
        for (var i = 0; i < pts.length - 1; i++) {
          var a = pts[i], b = pts[i + 1];
          np.push(a);
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          var nx = -(b.y - a.y), ny = (b.x - a.x);
          var len = Math.hypot(nx, ny) || 1;
          var off = (Math.random() - 0.5) * d;
          np.push({ x: mx + nx / len * off, y: my + ny / len * off });
        }
        np.push(pts[pts.length - 1]);
        pts = np; d *= 0.5;
      }
      return pts;
    }
    function stroke(pts, width, style, glow, blur) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = style; ctx.lineWidth = width;
      ctx.shadowColor = glow; ctx.shadowBlur = blur;
      ctx.stroke();
    }
    function edgePoint(d, inset) {
      var w = Math.max(1, W - 2 * inset), h = Math.max(1, H - 2 * inset);
      var per = 2 * (w + h), s = (((d % 1) + 1) % 1) * per;
      if (s < w) return { x: inset + s, y: inset };
      s -= w; if (s < h) return { x: inset + w, y: inset + s };
      s -= h; if (s < w) return { x: inset + w - s, y: inset + h };
      s -= w; return { x: inset, y: inset + h - s };
    }

    var t = 0, raf = null, visible = false;
    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var rx = W * 0.46, ry = H * 0.46;

      for (var idx = 0; idx < tendrils.length; idx++) {
        var td = tendrils[idx];
        td.angle += td.angleV + Math.sin(t * 0.7 + idx) * 0.004;
        var pulse = td.reach + Math.sin(t * 1.3 + idx * 1.7) * 0.09;
        var baseX = cx + Math.cos(td.angle) * rx * pulse;
        var baseY = cy + Math.sin(td.angle) * ry * pulse;
        if (pointer.active) {
          var pull = idx < 2 ? 0.72 : 0.14;
          baseX += (pointer.x - baseX) * pull;
          baseY += (pointer.y - baseY) * pull;
        }
        td.tx += (baseX - td.tx) * 0.12;
        td.ty += (baseY - td.ty) * 0.12;
        var dist = Math.hypot(td.tx - cx, td.ty - cy);
        var pts = bolt(cx, cy, td.tx, td.ty, Math.max(18, dist * 0.32));
        stroke(pts, 3.4, rgba(baseRgb, 0.42), rgba(glowRgb, 0.9), 14);
        stroke(pts, 1.2, rgba(brightRgb, 0.75 + Math.random() * 0.25), rgba(baseRgb, 0.95), 8);
      }

      ctx.shadowBlur = 0;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55);
      g.addColorStop(0, rgba(lighten(baseRgb, 0.7), 0.9));
      g.addColorStop(0.35, rgba(baseRgb, 0.5));
      g.addColorStop(1, rgba(glowRgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      if (mctx) {
        mctx.clearRect(0, 0, W, H);
        mctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < motes.length; k++) {
          var mo = motes[k];
          var inset = mo.inset + Math.sin(t * mo.oscSpeed + mo.phase) * mo.osc;
          var p = edgePoint(mo.d + t * mo.speed, inset);
          var twinkle = mo.tw * (0.55 + 0.45 * Math.sin(t * 2.1 + mo.phase * 2));
          mctx.beginPath();
          mctx.arc(p.x, p.y, mo.r, 0, Math.PI * 2);
          mctx.fillStyle = rgba(brightRgb, twinkle);
          mctx.shadowColor = rgba(baseRgb, 0.9);
          mctx.shadowBlur = 4;
          mctx.fill();
        }
        mctx.globalCompositeOperation = 'source-over';
      }

      raf = visible ? requestAnimationFrame(frame) : null;
    }

    function start() { visible = true; if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { visible = false; }
    var io = onScreen(container, start, stop);

    return {
      destroy: function () {
        stop();
        if (raf) cancelAnimationFrame(raf);
        io.disconnect();
        global.removeEventListener('resize', resize);
        if (followPointer) {
          container.removeEventListener('mousemove', onMove);
          container.removeEventListener('mouseleave', onLeave);
        }
        plasma.remove();
        if (moteCanvas) moteCanvas.remove();
      }
    };
  }

  /* ---------- page transitions ---------- */
  // Fade the page out before navigating to another internal .html page.
  // Pairs with the `nice-page-in` load animation and `.nice-leaving` in nice-effects.css.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;         // in-page anchors
    if (a.target && a.target !== '_self') return;          // new tab / _blank
    if (!/\.html($|[?#])/.test(href)) return;              // only internal page navigations
    e.preventDefault();
    document.body.classList.add('nice-leaving');
    setTimeout(function () { global.location.href = href; }, 200);
  });
  // Clear the fade if the page is restored from the back/forward cache.
  global.addEventListener('pageshow', function () {
    if (document.body) document.body.classList.remove('nice-leaving');
  });

  global.NiceEffects = { liquidFill: liquidFill, lightning: lightning };
})(window);
