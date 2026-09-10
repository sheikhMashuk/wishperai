/* shared chrome + interactions for every page */
(() => {
  'use strict';
  const D = document;
  const page = D.body.dataset.page || '';
  const YEAR = new Date().getFullYear();

  /* ---------------- header ---------------- */
  const NAV = [
    ['features', 'Features', '/features'],
    ['security', 'Stealth & privacy', '/security'],
    ['download', 'Download', '/download'],
    ['faq', 'FAQ', '/faq'],
  ];

  /* the mark: a signal — three bars, the middle one carrying */
  const markSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="6" width="3.5" height="12" fill-opacity=".45"/><rect x="10.25" y="2" width="3.5" height="20"/><rect x="16.5" y="9" width="3.5" height="6" fill-opacity=".45"/></svg>';

  const head = D.getElementById('site-head');
  if (head) {
    head.className = 'site-head';
    head.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/" aria-label="WishperAI home">
          <span class="mark">${markSvg}</span> WishperAI
        </a>
        <nav class="nav">
          ${NAV.map(([id, label, href]) =>
            `<a href="${href}"${id === page ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <div class="head-actions">
          <a class="btn btn-primary btn-sm" href="/download">Download</a>
          <button class="menu-btn" aria-label="Menu" aria-expanded="false"><span class="menu-ico"></span></button>
        </div>
      </div>
      <div class="mobile-nav" id="mnav">
        ${NAV.map(([id, label, href]) =>
          `<a href="${href}"${id === page ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        <a class="btn btn-primary" href="/download">Get WishperAI</a>
      </div>`;

    const setIco = (open) => {
      const el = head.querySelector('.menu-ico');
      el.innerHTML = open
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    };
    setIco(false);

    const mnav = head.querySelector('#mnav');
    const mbtn = head.querySelector('.menu-btn');
    mbtn.addEventListener('click', () => {
      const open = mnav.hasAttribute('data-open');
      mnav.toggleAttribute('data-open', !open);
      mbtn.setAttribute('aria-expanded', String(!open));
      setIco(!open);
    });
    mnav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        mnav.removeAttribute('data-open');
        mbtn.setAttribute('aria-expanded', 'false');
        setIco(false);
      }
    });

    let ticking = false;
    const onScroll = () => {
      head.toggleAttribute('data-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { onScroll(); ticking = false; });
    }, { passive: true });
  }

  /* ---------------- footer ---------------- */
  const foot = D.getElementById('site-foot');
  if (foot) {
    foot.className = 'site-foot';
    foot.innerHTML = `
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="brand" href="/"><span class="mark">${markSvg}</span> WishperAI</a>
            <p class="foot-note">A desktop overlay that helps in the moment and disappears from the recording. Built by one engineer, no account, no telemetry.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="/features">Features</a>
            <a href="/security">Stealth &amp; privacy</a>
            <a href="/download">Download</a>
            <a href="/faq">FAQ</a>
          </div>
          <div>
            <h4>Reference</h4>
            <a href="/security#capture">How the capture-exclusion works</a>
            <a href="/features#models">Supported providers</a>
            <a href="/download#hotkeys">Keyboard shortcuts</a>
          </div>
          <div>
            <h4>Elsewhere</h4>
            <a href="https://github.com/sheikhMashuk/wishperai" target="_blank" rel="noopener">Source on GitHub</a>
            <a href="/faq#detect">Is it detectable?</a>
          </div>
        </div>
        <div class="foot-bottom">
          <span>© ${YEAR} WishperAI</span>
          <span>Windows 10/11 · macOS · Rust + Tauri</span>
          <span>Use it honestly.</span>
        </div>
      </div>`;
  }

  /* ---------------- scroll reveal ---------------- */
  const reveals = [...D.querySelectorAll('.reveal')];
  const showAll = () => reveals.forEach((el) => el.classList.add('seen'));

  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showAll();
  } else {
    D.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -4% 0px' },
    );
    reveals.forEach((el) => io.observe(el));
    setTimeout(showAll, 3500);
    window.addEventListener('load', () => setTimeout(showAll, 1200));
  }

  /* ---------------- pinned scroll story ---------------- */
  const stepsWrap = D.querySelector('[data-pin-steps]');
  const stage = D.querySelector('[data-pin-stage]');
  if (stepsWrap && stage && !matchMedia('(max-width: 880px)').matches) {
    const steps = [...stepsWrap.querySelectorAll('.pin__step')];
    const cards = [...stage.querySelectorAll('.pin__card')];
    let current = -1;
    D.documentElement.classList.add('pin-ready');

    const activate = (i) => {
      if (i === current) return;
      current = i;
      steps.forEach((s, n) => s.toggleAttribute('data-active', n === i));
      cards.forEach((c, n) => c.toggleAttribute('data-active', n === i));
    };
    activate(0);

    const pick = () => {
      const line = innerHeight * 0.42;
      let best = 0;
      let bestDist = Infinity;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - line);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      activate(best);
    };

    // Primary driver: an IntersectionObserver watching each step cross a thin
    // band ~42% down the viewport. This fires on layout intersection, so it
    // works even where plain scroll events are throttled or suppressed.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        () => pick(),
        { rootMargin: '-42% 0px -56% 0px', threshold: [0, 1] },
      );
      steps.forEach((s) => io.observe(s));
    }
    // Fallback: also pick straight off the scroll event, lightly throttled and
    // not behind requestAnimationFrame.
    let last = 0;
    const onPin = () => {
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      pick();
    };
    pick();
    window.addEventListener('scroll', onPin, { passive: true });
    window.addEventListener('resize', onPin, { passive: true });
  } else if (stage) {
    stage.querySelectorAll('.pin__card').forEach((c) => c.setAttribute('data-active', ''));
    D.querySelectorAll('.pin__step').forEach((s) => s.setAttribute('data-active', ''));
  }

  /* ---------------- faq accordion ---------------- */
  D.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const open = item.hasAttribute('data-open');
      D.querySelectorAll('.faq-item[data-open]').forEach((o) => o.removeAttribute('data-open'));
      if (!open) item.setAttribute('data-open', '');
    });
  });
  if (location.hash) {
    const t = D.querySelector(location.hash);
    if (t && t.classList.contains('faq-item')) t.setAttribute('data-open', '');
  }

  /* ---------------- lucide icons ---------------- */
  if (window.lucide) window.lucide.createIcons();
})();
