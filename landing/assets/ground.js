/* Ground Station — the instrument layer.
   HUD telemetry, the receding canvas grid, hero pointer-parallax,
   scroll push-in on the 3D stage, and count-up readouts.
   Everything here is enhancement: the page is complete without it. */
(() => {
  'use strict';
  const D = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  if (!reduce) D.documentElement.classList.add('fx');

  /* ---------------- HUD frame ---------------- */
  const hud = D.createElement('div');
  hud.className = 'hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <span class="hud__bracket tl"></span><span class="hud__bracket tr"></span>
    <span class="hud__bracket bl"></span><span class="hud__bracket br"></span>
    <span class="hud__read bl"><b data-hud="clock">--:--:--</b> UTC — SIGNAL <span class="hud__live"></span> <b>LOCKED</b></span>
    <span class="hud__read br">ALT <b data-hud="alt">00</b>% <span class="hud__alt"><i></i></span></span>`;
  D.body.appendChild(hud);

  const clockEl = hud.querySelector('[data-hud="clock"]');
  const altEl = hud.querySelector('[data-hud="alt"]');
  const altBar = hud.querySelector('.hud__alt i');

  const tick = () => {
    const t = new Date();
    clockEl.textContent = [t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds()]
      .map((n) => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 1000);


  /* ---------------- scroll: progress bar + HUD altitude ---------------- */
  let bar = D.querySelector('.scroll-prog');
  if (!bar) { bar = D.createElement('div'); bar.className = 'scroll-prog'; D.body.appendChild(bar); }
  let sQ = false;
  const onScroll = () => {
    if (sQ) return; sQ = true;
    requestAnimationFrame(() => {
      const max = D.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? scrollY / max : 0;
      bar.style.width = (pct * 100).toFixed(1) + '%';
      altEl.textContent = String(Math.round(pct * 100)).padStart(2, '0');
      altBar.style.height = (pct * 100).toFixed(0) + '%';
      sQ = false;
    });
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  /* ---------------- ambient grid canvas ---------------- */
  const field = D.createElement('div');
  field.className = 'field';
  field.setAttribute('aria-hidden', 'true');
  D.body.prepend(field);

  if (!reduce) {
    const cv = D.createElement('canvas');
    field.appendChild(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 2), t0 = performance.now();

    const size = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener('resize', size, { passive: true });

    const line = '#c2cfca';
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const horizon = h * 0.42;
      const vpx = w / 2;

      // perspective floor — verticals fanning to the vanishing point
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let i = -10; i <= 10; i++) {
        const fx = vpx + i * (w / 7);
        ctx.beginPath();
        ctx.moveTo(vpx, horizon);
        ctx.lineTo(fx, h);
        ctx.stroke();
      }
      // horizontals scrolling toward the viewer
      for (let i = 0; i < 16; i++) {
        const p = ((i / 16) + (t * 0.06) % (1 / 16)) % 1;
        const y = horizon + Math.pow(p, 2.4) * (h - horizon);
        ctx.globalAlpha = 0.5 * (1 - p) + 0.06;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // horizon glow
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 2);
      g.addColorStop(0, 'rgba(51,104,160,0)');
      g.addColorStop(1, 'rgba(51,104,160,.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon - 30, w, 32);
      ctx.strokeStyle = 'rgba(51,104,160,.3)';
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    let raf = requestAnimationFrame(draw);
    D.addEventListener('visibilitychange', () => {
      if (D.hidden) cancelAnimationFrame(raf);
      else { t0 = performance.now(); raf = requestAnimationFrame(draw); }
    });
  }

  /* ---------------- hero 3D: pointer parallax + scroll push-in ---------------- */
  const world = D.querySelector('.stage__world');
  if (world && !reduce && !touch) {
    let tx = 0, ty = 0, cx = 0, cy = 0, depth = 0, running = true;
    const stage = world.closest('.stage');

    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

    let dQ = false;
    const onDepth = () => {
      if (dQ) return; dQ = true;
      requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        // 0 while the stage sits mid-viewport, ramps up as it scrolls away
        depth = Math.max(0, Math.min(1, (innerHeight * 0.5 - r.bottom) / (innerHeight * 0.8)));
        dQ = false;
      });
    };
    onDepth();
    addEventListener('scroll', onDepth, { passive: true });

    const loop = () => {
      if (!running) return;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      const rotY = cx * 7 - depth * 4;
      const rotX = -cy * 5 + depth * 8;
      const tz = -depth * 180;
      world.style.transform =
        `translateZ(${tz.toFixed(1)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      requestAnimationFrame(loop);
    };
    loop();
    D.addEventListener('visibilitychange', () => {
      running = !D.hidden;
      if (running) loop();
    });
  }

  /* ---------------- count-up readouts ---------------- */
  const counters = [...D.querySelectorAll('[data-count]')];
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    const run = (el) => {
      const raw = el.dataset.count;
      const target = parseFloat(raw);
      const suffix = raw.replace(/^[\d.]+/, '');
      const dur = 900;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        const v = target * e;
        el.textContent = (target % 1 ? v.toFixed(1) : Math.round(v)) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = raw;
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }
})();
