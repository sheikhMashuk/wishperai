/* home page — the overlay mock that types out answers */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);

  const answers = [
    {
      tag: 'System design',
      ms: 209,
      q: 'How would you scale a WebSocket service to 100k connections?',
      a: 'Async edge gateways behind a load balancer, connections sharded by a consistent-hash ring, room fan-out over Redis pub/sub.',
      pts: [
        'Zero-copy framing with a recycled buffer pool — no per-message allocation.',
        'A client is pinned to one worker, so there is no cross-node chatter.',
        'Bounded per-socket queues drop stale frames instead of stalling the loop.',
      ],
    },
    {
      tag: 'Coding',
      ms: 171,
      q: 'Implement an LRU cache with O(1) get and put.',
      a: 'Hash map from key to node for the lookup, doubly linked list for ordering. Sentinel head and tail remove the edge cases.',
      pts: [
        'get: unlink the node, splice it in behind the head, return its value.',
        'put over capacity: evict tail.prev, then delete its key from the map.',
        'Both operations touch a fixed number of pointers — O(1).',
      ],
    },
    {
      tag: 'Behavioral',
      ms: 240,
      q: 'Tell me about a production incident you handled.',
      a: 'During a flash sale our payment path started deadlocking. I moved reads to a replica, added distributed locks, and cleared every deadlock with nothing lost.',
      pts: [
        'Situation — checkout latency hit 8s, deadlocks every few minutes.',
        'Action — atomic scripts on the hot path, telemetry writes moved off it.',
        'Result — p99 back to 32ms, 100% consistency across 3M+ orders.',
      ],
    },
  ];

  const aEl = $('#mockAnswer');
  const ptsEl = $('#mockPts');
  const qEl = $('#mockQ');
  const tagEl = $('#mockTag');
  const msEl = $('#mockMs');
  const liveEl = $('#mockLive');
  if (!aEl) return;

  let idx = 0;
  let cancelled = false;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function type(el, text, speed) {
    if (reduce) { el.textContent = text; return; }
    el.textContent = '';
    for (let i = 0; i <= text.length && !cancelled; i++) {
      el.textContent = text.slice(0, i);
      await wait(speed);
    }
  }

  async function bullets(items) {
    ptsEl.innerHTML = '';
    for (const it of items) {
      if (cancelled) return;
      const li = document.createElement('li');
      li.textContent = it;
      li.style.opacity = '0';
      li.style.transform = 'translateY(3px)';
      li.style.transition = 'opacity .3s, transform .3s';
      ptsEl.appendChild(li);
      await wait(20);
      li.style.opacity = '1';
      li.style.transform = 'none';
      await wait(reduce ? 0 : 230);
    }
  }

  async function loop() {
    while (!cancelled) {
      const item = answers[idx];
      tagEl.textContent = item.tag;
      qEl.textContent = `"${item.q}"`;
      msEl.textContent = '— ms';
      ptsEl.innerHTML = '';
      liveEl.textContent = item.q.toLowerCase().slice(0, 46) + '…';
      aEl.classList.add('caret');

      await type(aEl, `"${item.a}"`, 15);
      if (cancelled) return;
      msEl.textContent = item.ms + ' ms';
      await bullets(item.pts);
      aEl.classList.remove('caret');

      await wait(4200);
      idx = (idx + 1) % answers.length;
    }
  }

  // let a click on the question chips jump the loop
  document.querySelectorAll('[data-jump]').forEach((b) =>
    b.addEventListener('click', () => {
      idx = +b.dataset.jump;
      cancelled = true;
      setTimeout(() => { cancelled = false; loop(); }, 30);
      document.querySelectorAll('[data-jump]').forEach((x) => x.removeAttribute('data-on'));
      b.setAttribute('data-on', '');
    }),
  );

  loop();
})();
