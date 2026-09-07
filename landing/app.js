/* WhisperAI landing — interactions */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const icons = () => window.lucide && window.lucide.createIcons();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  icons();

  /* ---------- header condense ---------- */
  const hdr = $('#hdr');
  const onScroll = () => {
    const s = window.scrollY > 12;
    hdr.classList.toggle('bg-ink/80', s);
    hdr.classList.toggle('backdrop-blur-xl', s);
    hdr.classList.toggle('border-[var(--line)]', s);
    hdr.style.height = s ? '56px' : '';
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------- tiny typewriter ---------- */
  function typeInto(el, text, speed, done) {
    if (reduce) {
      el.textContent = text;
      done && done();
      return () => {};
    }
    el.textContent = '';
    let i = 0;
    let alive = true;
    (function tick() {
      if (!alive) return;
      if (i <= text.length) {
        el.textContent = text.slice(0, i++);
        setTimeout(tick, speed);
      } else if (done) done();
    })();
    return () => {
      alive = false;
    };
  }

  function streamBullets(ul, items, cb) {
    ul.innerHTML = '';
    let i = 0;
    (function add() {
      if (i >= items.length) {
        cb && cb();
        return;
      }
      const li = document.createElement('li');
      li.className = 'flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-dim)]';
      li.style.opacity = '0';
      li.style.transform = 'translateY(4px)';
      li.style.transition = 'opacity .3s, transform .3s';
      li.innerHTML =
        '<span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]"></span><span>' + items[i] + '</span>';
      ul.appendChild(li);
      requestAnimationFrame(() => {
        li.style.opacity = '1';
        li.style.transform = 'none';
      });
      i++;
      setTimeout(add, reduce ? 0 : 260);
    })();
  }

  /* ---------- hero mock loop ---------- */
  const heroLine =
    "\"I'd put an async Rust or Go edge gateway in front, shard connections with a consistent-hash ring, and fan out through Redis pub/sub.\"";
  const heroPoints = [
    'Zero-copy framing with a recycled buffer pool on the hot path.',
    'Bounded per-socket ring buffers — drop stale frames instead of stalling the loop.',
    'Sticky routing so a client always lands on the same worker.',
  ];
  const heroEl = $('#heroType');
  const heroUl = $('#heroBullets');
  if (heroEl) {
    const runHero = () => {
      typeInto(heroEl, heroLine, 18, () => {
        streamBullets(heroUl, heroPoints, () => {
          setTimeout(runHero, 6000);
        });
      });
    };
    runHero();
  }

  /* ---------- interactive demo ---------- */
  const presets = {
    sys: {
      badge: 'System design',
      latency: 212,
      q: '"How would you scale a WebSocket service to 100k concurrent connections?"',
      transcript: '…your approach for scaling real-time WebSocket infrastructure',
      answer:
        "\"Async Rust/Tokio or Go edge gateways behind a load balancer, connections sharded by a consistent-hash ring, room fan-out over Redis pub/sub for sub-10ms broadcasts.\"",
      points: [
        'Zero-copy framing with a recycled buffer pool — no per-message allocation.',
        'Consistent-hash routing keeps a client pinned to one worker; no cross-talk.',
        'Bounded ring buffers apply backpressure by dropping stale telemetry.',
      ],
      code: null,
    },
    dsa: {
      badge: 'Coding',
      latency: 176,
      q: '"Implement an LRU cache with O(1) get and put."',
      transcript: '…write an LRU cache with O(1) operations',
      answer:
        '"Hash map from key to node for O(1) lookup, plus a doubly linked list for O(1) move-to-front and eviction. Sentinel head and tail kill the edge cases."',
      points: [
        'Map stores key → node so lookup is a single hash probe.',
        'On access, unlink the node and splice it behind the head.',
        'On overflow, drop tail.prev and delete its key from the map.',
      ],
      code:
        'class LRU:\n    def __init__(self, cap): self.cap, self.m = cap, {}\n    def get(self, k):\n        if k not in self.m: return -1\n        self.m[k] = self.m.pop(k)      # move to newest\n        return self.m[k]\n    def put(self, k, v):\n        if k in self.m: self.m.pop(k)\n        elif len(self.m) >= self.cap: self.m.pop(next(iter(self.m)))\n        self.m[k] = v\n# Time: O(1) | Space: O(n)',
    },
    star: {
      badge: 'Behavioral',
      latency: 233,
      q: '"Tell me about a production incident you handled under pressure."',
      transcript: '…a high-stakes production incident you resolved',
      answer:
        '"During a flash sale, our payment service started deadlocking. I rolled traffic to a read replica, added Redis-based distributed locks, and cleared every deadlock with zero lost transactions."',
      points: [
        'Situation — checkout latency spiked to 8s with recurring DB deadlocks.',
        'Task — hold availability above 99.9% without corrupting a single order.',
        'Action — atomic Lua scripts for the critical path; telemetry writes moved to a queue.',
        'Result — p99 back to 32ms, 100% consistency across 3M+ orders.',
      ],
      code: null,
    },
  };

  let current = 'sys';
  let listening = true;
  let locked = false;
  let collapsed = false;
  let timer = 0;
  let timerId = null;
  let cancelType = () => {};

  const hud = $('#hud');
  const badgeEl = $('#demoBadge');
  const qEl = $('#demoQuestion');
  const ansEl = $('#demoAnswer');
  const caretEl = $('#demoCaret');
  const bulletsEl = $('#demoBullets');
  const codeEl = $('#demoCode');
  const latEl = $('#demoLatency');
  const trEl = $('#demoTranscript');
  const wave = $('#hudWave');
  const timerEl = $('#hudTimer');

  function fmt(t) {
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }
  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      timer++;
      timerEl.textContent = fmt(timer);
    }, 1000);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }
  startTimer();

  function countUp(el, target) {
    if (reduce) {
      el.textContent = target + ' ms';
      return;
    }
    let v = 0;
    const step = Math.max(4, Math.round(target / 22));
    const id = setInterval(() => {
      v = Math.min(target, v + step);
      el.textContent = v + ' ms';
      if (v >= target) clearInterval(id);
    }, 28);
  }

  function render(key) {
    const p = presets[key];
    if (!p) return;
    current = key;
    $$('#presets .preset').forEach((b) => {
      const on = b.dataset.preset === key;
      b.classList.toggle('bg-accent', on);
      b.classList.toggle('text-[var(--accent-ink)]', on);
      b.classList.toggle('bg-white/[0.05]', !on);
      b.classList.toggle('text-[var(--text-dim)]', !on);
    });
    badgeEl.textContent = p.badge;
    qEl.textContent = p.q;
    trEl.textContent = p.transcript;
    latEl.textContent = '— ms';
    bulletsEl.innerHTML = '';
    codeEl.classList.add('hidden');
    caretEl.style.display = '';

    if (collapsed) toggleCollapse();
    if (listening) {
      wave.classList.remove('paused');
    }

    cancelType();
    cancelType = typeInto(ansEl, p.answer, 16, () => {
      countUp(latEl, p.latency);
      streamBullets(bulletsEl, p.points, () => {
        caretEl.style.display = 'none';
        if (p.code) {
          codeEl.textContent = p.code;
          codeEl.classList.remove('hidden');
        }
      });
    });
  }

  $$('#presets .preset').forEach((b) => b.addEventListener('click', () => render(b.dataset.preset)));

  $('#simBtn').addEventListener('click', () => {
    if (collapsed) toggleCollapse();
    wave.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
      duration: 500,
    });
    render(current);
  });

  $$('#chips .chip').forEach((c) =>
    c.addEventListener('click', () => {
      const t = c.dataset.chip;
      if (t === 'assist') return render(current);
      if (t === 'say') {
        caretEl.style.display = '';
        cancelType();
        cancelType = typeInto(
          ansEl,
          '"Short version: hash map for the lookup, doubly linked list for ordering — both O(1)."',
          16,
          () => (caretEl.style.display = 'none'),
        );
        return;
      }
      if (t === 'follow') {
        streamBullets(bulletsEl, [
          'Ask them: what p99 latency target are we designing to?',
          'Ask them: single region, or multi-region with eventual consistency?',
        ]);
        return;
      }
      if (t === 'recap') {
        streamBullets(bulletsEl, [
          'Recap — async gateway + consistent-hash sharding + Redis fan-out for 100k live sockets.',
        ]);
      }
    }),
  );

  /* listen toggle */
  $('#listenBtn').addEventListener('click', () => {
    listening = !listening;
    const b = $('#listenBtn');
    wave.classList.toggle('paused', !listening);
    if (listening) {
      b.className = 'rounded-lg bg-[var(--danger)]/15 px-2.5 py-1 text-[12px] font-medium text-[var(--danger)] transition-colors';
      b.innerHTML = '<span class="inline-flex items-center gap-1.5"><i data-lucide="square" class="h-3 w-3 fill-current"></i> Stop</span>';
      startTimer();
    } else {
      b.className = 'rounded-lg bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-white transition-colors';
      b.innerHTML = '<span class="inline-flex items-center gap-1.5"><i data-lucide="mic" class="h-3.5 w-3.5"></i> Listen</span>';
      stopTimer();
    }
    icons();
  });

  /* lock / click-through */
  function toggleLock() {
    locked = !locked;
    $('#lockBanner').classList.toggle('hidden', !locked);
    $('#lockBanner').classList.toggle('flex', locked);
    hud.classList.toggle('border-amber-400/40', locked);
    hud.classList.toggle('border-[var(--line-strong)]', !locked);
    $('#lockIcon').setAttribute('data-lucide', locked ? 'lock' : 'unlock');
    $('#lockIcon').classList.toggle('text-amber-400', locked);
    icons();
  }
  $('#lockBtn').addEventListener('click', toggleLock);

  /* hide -> collapse note toggle (demo can't really vanish) */
  function toggleCollapse() {
    collapsed = !collapsed;
    $('#hudBody').classList.toggle('hidden', collapsed);
    $('#hudCollapsedNote').classList.toggle('hidden', !collapsed);
    $('#collapseIcon').setAttribute('data-lucide', collapsed ? 'chevron-down' : 'chevron-up');
    icons();
  }
  $('#collapseBtn').addEventListener('click', toggleCollapse);
  $('#hideBtn').addEventListener('click', toggleCollapse);

  /* opacity */
  const pop = $('#opacityPop');
  $('#opacityBtn').addEventListener('click', () => pop.classList.toggle('hidden'));
  $('#opacityRange').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('#opacityBtn').textContent = v;
    const a = (0.55 + (v / 100) * 0.4).toFixed(3);
    hud.style.backgroundColor = `rgba(14,14,17,${a})`;
  });

  /* demo hotkeys (only while pointer is over the demo) */
  let overDemo = false;
  $('#demo').addEventListener('mouseenter', () => (overDemo = true));
  $('#demo').addEventListener('mouseleave', () => (overDemo = false));
  window.addEventListener('keydown', (e) => {
    if (!overDemo || !e.ctrlKey) return;
    if (e.key === '\\') {
      e.preventDefault();
      toggleCollapse();
    } else if (e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      toggleLock();
    } else if (e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleCollapse();
    }
  });

  render('sys');

  /* ---------- FAQ ---------- */
  $$('#faq .faq').forEach((item) =>
    item.addEventListener('click', () => {
      const open = item.classList.contains('faq-open');
      $$('#faq .faq').forEach((f) => f.classList.remove('faq-open'));
      if (!open) item.classList.add('faq-open');
    }),
  );
})();
