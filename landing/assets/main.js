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

  const markSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  const head = D.getElementById('site-head');
  if (head) {
    head.className = 'site-head';
    head.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/" aria-label="WhisperAI home">
          <span class="mark">${markSvg}</span> WhisperAI
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
        <a class="btn btn-primary" href="/download">Download for Windows</a>
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

    const prog = D.createElement('div');
    prog.className = 'scroll-prog';
    D.body.appendChild(prog);

    let ticking = false;
    const onScroll = () => {
      head.toggleAttribute('data-scrolled', window.scrollY > 8);
      if (!ticking) {
        requestAnimationFrame(() => {
          const max = D.documentElement.scrollHeight - window.innerHeight;
          prog.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  /* ---------------- footer ---------------- */
  const foot = D.getElementById('site-foot');
  if (foot) {
    foot.className = 'site-foot';
    foot.innerHTML = `
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="brand" href="/"><span class="mark">${markSvg}</span> WhisperAI</a>
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
          <span>© ${YEAR} WhisperAI</span>
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
    // failsafe — never leave anything stuck invisible
    setTimeout(showAll, 3500);
    window.addEventListener('load', () => setTimeout(showAll, 1200));
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
  // open a FAQ if the URL points at it
  if (location.hash) {
    const t = D.querySelector(location.hash);
    if (t && t.classList.contains('faq-item')) t.setAttribute('data-open', '');
  }

  /* ---------------- lucide icons ---------------- */
  if (window.lucide) window.lucide.createIcons();
})();
