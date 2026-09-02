// WhisperAI Landing Page Interactive Logic
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Presets Data
  const presets = {
    sysdesign: {
      category: 'Architecture / System Design',
      categoryIcon: 'layers',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      question: '"How do you design a real-time low-latency WebSocket cluster handling 100k concurrent connections?"',
      spokenAnswer: '"I\'d architect this with an asynchronous Rust Tokio or Go edge gateway using epoll multiplexing and zero-copy buffer pools, paired with a Redis Dragonfly Pub/Sub backplane for sub-10ms room broadcasts."',
      transcript: '"Can you explain your approach for scaling real-time WebSocket infrastructure?"',
      bullets: [
        '<strong>Zero-Copy I/O:</strong> Use tokio `bytes` crate recycling to eliminate heap allocation bottlenecks.',
        '<strong>State Partitioning:</strong> Consistent hashing ring to route client connections with zero cross-talk.',
        '<strong>Backpressure:</strong> Bounded per-socket RingBuffers to drop stale telemetry instead of stalling the event loop.'
      ]
    },
    leetcode: {
      category: 'Algorithm & Data Structure',
      categoryIcon: 'code-2',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      question: '"Implement an LRU Cache with strict O(1) time complexity for both get and put operations."',
      spokenAnswer: '"We combine a Hash Map for O(1) key lookups with a Doubly Linked List for O(1) node detachment and head re-insertion. Sentinel dummy head and tail nodes eliminate null edge cases."',
      transcript: '"Let\'s do a coding question: how would you write an LRU Cache with O(1) constraints?"',
      bullets: [
        '<strong>Map Lookup:</strong> Map stores Key -> ListNode pointers for direct O(1) referencing.',
        '<strong>Doubly Linked List:</strong> Node has `prev` and `next` pointers to detach and move to head in O(1).',
        '<strong>Eviction:</strong> When capacity is exceeded, remove `tail.prev` node in O(1) and delete map key.'
      ]
    },
    behavioral: {
      category: 'STAR Behavioral Method',
      categoryIcon: 'check-circle-2',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      question: '"Tell me about a time you handled a critical production outage under high pressure."',
      spokenAnswer: '"During a flash sale spike, our transaction service encountered database deadlocks. I immediately initiated read-replica fallback, introduced distributed Redis Redlock semantics, and eliminated all deadlocks with zero lost funds."',
      transcript: '"Can you describe a high-stakes production incident you resolved?"',
      bullets: [
        '<strong>Situation:</strong> Payment processor latency surged to 8 seconds with recurring lock deadlocks.',
        '<strong>Task:</strong> Prevent transaction corruption while keeping checkout availability above 99.9%.',
        '<strong>Action:</strong> Introduced atomic Lua scripts and isolated non-critical telemetry writes to async queues.',
        '<strong>Result:</strong> Reduced p99 latency to 32ms and preserved 100% data consistency across 3M+ orders.'
      ]
    }
  };

  let currentPresetKey = 'sysdesign';
  let isHidden = false;
  let isListening = true;

  // DOM Elements
  const presetButtons = document.querySelectorAll('.preset-btn');
  const simulateBtn = document.getElementById('simulateBtn');
  const demoListenBtn = document.getElementById('demoListenBtn');
  const demoHideBtn = document.getElementById('demoHideBtn');
  const demoUnhideBtn = document.getElementById('demoUnhideBtn');
  const hudBody = document.getElementById('hudBody');
  const hudMiniPill = document.getElementById('hudMiniPill');
  const hideIcon = document.getElementById('hideIcon');
  const hideText = document.getElementById('hideText');

  const demoBadge = document.getElementById('demoBadge');
  const demoQuestion = document.getElementById('demoQuestion');
  const demoAnswerText = document.getElementById('demoAnswerText');
  const demoTranscriptText = document.getElementById('demoTranscriptText');
  const demoBulletList = document.getElementById('demoBulletList');
  const audioWaveform = document.getElementById('audioWaveform');

  // Load Preset Function
  function loadPreset(key) {
    currentPresetKey = key;
    const data = presets[key];
    if (!data) return;

    presetButtons.forEach(btn => {
      if (btn.getAttribute('data-preset') === key) {
        btn.classList.add('bg-indigo-600', 'text-white');
        btn.classList.remove('bg-white/5', 'text-zinc-300');
      } else {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('bg-white/5', 'text-zinc-300');
      }
    });

    demoBadge.innerHTML = `<i data-lucide="${data.categoryIcon}" class="w-3 h-3"></i><span>${data.category}</span>`;
    demoQuestion.textContent = data.question;
    demoTranscriptText.textContent = data.transcript;

    // Typewriter effect on spoken answer
    typewriterEffect(demoAnswerText, data.spokenAnswer);

    // Bullets
    demoBulletList.innerHTML = data.bullets.map(b => `
      <li class="flex items-start gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
        <span>${b}</span>
      </li>
    `).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Typewriter Effect
  function typewriterEffect(element, text) {
    element.textContent = '';
    let i = 0;
    const speed = 12; // Fast sub-300ms feel
    function type() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(type, speed);
      }
    }
    type();
  }

  // Preset button clicks
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset');
      loadPreset(key);
    });
  });

  // Simulate Question Click
  simulateBtn.addEventListener('click', () => {
    // Pulse waveform
    audioWaveform.classList.add('scale-110');
    setTimeout(() => audioWaveform.classList.remove('scale-110'), 600);

    // If hidden, auto unhide or notify
    if (isHidden) {
      toggleHideMode();
    }

    loadPreset(currentPresetKey);
  });

  // Hide / Unhide Stealth Toggle
  function toggleHideMode() {
    isHidden = !isHidden;
    if (isHidden) {
      hudBody.classList.add('hidden');
      hudMiniPill.classList.remove('hidden');
      hideText.textContent = 'Unhide';
    } else {
      hudBody.classList.remove('hidden');
      hudMiniPill.classList.add('hidden');
      hideText.textContent = 'Hide';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  demoHideBtn.addEventListener('click', toggleHideMode);
  demoUnhideBtn.addEventListener('click', toggleHideMode);

  // Transparency Meter & Slider Interactions
  const demoOpacityBtn = document.getElementById('demoOpacityBtn');
  const demoOpacityPopover = document.getElementById('demoOpacityPopover');
  const demoOpacityRange = document.getElementById('demoOpacityRange');
  const demoOpacityText = document.getElementById('demoOpacityText');
  const demoOpacityVal = document.getElementById('demoOpacityVal');
  const demoPresetBtns = document.querySelectorAll('.demo-op-preset');
  const stealthHUDCard = document.getElementById('stealthHUD');

  function setDemoOpacity(val) {
    const percent = Math.round(val * 100);
    demoOpacityText.textContent = `${percent}%`;
    demoOpacityVal.textContent = `${percent}%`;
    if (demoOpacityRange) demoOpacityRange.value = val;
    if (stealthHUDCard) {
      stealthHUDCard.style.backgroundColor = `rgba(18, 21, 34, ${val})`;
      stealthHUDCard.style.backdropFilter = `blur(${Math.max(4, Math.round(val * 24))}px) saturate(180%)`;
    }
    demoPresetBtns.forEach((b) => {
      const op = parseFloat(b.getAttribute('data-op'));
      if (Math.abs(op - val) < 0.08) {
        b.classList.add('bg-indigo-600', 'text-white');
        b.classList.remove('bg-white/5', 'text-zinc-300');
      } else {
        b.classList.remove('bg-indigo-600', 'text-white');
        b.classList.add('bg-white/5', 'text-zinc-300');
      }
    });
  }

  if (demoOpacityBtn) {
    demoOpacityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      demoOpacityPopover.classList.toggle('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (demoOpacityPopover && !demoOpacityPopover.contains(e.target) && e.target !== demoOpacityBtn) {
      demoOpacityPopover.classList.add('hidden');
    }
  });

  if (demoOpacityRange) {
    demoOpacityRange.addEventListener('input', (e) => {
      setDemoOpacity(parseFloat(e.target.value));
    });
  }

  demoPresetBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const op = parseFloat(b.getAttribute('data-op'));
      setDemoOpacity(op);
    });
  });

  // Lock / Unlock Toggle Interactions
  let isDemoLocked = false;
  const demoLockBtn = document.getElementById('demoLockBtn');
  const demoLockIcon = document.getElementById('demoLockIcon');
  const demoLockBanner = document.getElementById('demoLockBanner');
  const demoUnlockBtn = document.getElementById('demoUnlockBtn');

  function toggleDemoLock() {
    isDemoLocked = !isDemoLocked;
    if (isDemoLocked) {
      demoLockBtn.classList.add('bg-amber-500', 'text-zinc-950', 'shadow-amber-500/40', 'animate-pulse');
      demoLockBtn.classList.remove('bg-white/5', 'text-zinc-400');
      if (demoLockIcon) demoLockIcon.setAttribute('data-lucide', 'lock');
      if (demoLockBanner) demoLockBanner.classList.remove('hidden');
      if (stealthHUDCard) stealthHUDCard.classList.add('border-amber-500/60', 'shadow-[0_0_35px_rgba(245,158,11,0.3)]');
    } else {
      demoLockBtn.classList.remove('bg-amber-500', 'text-zinc-950', 'shadow-amber-500/40', 'animate-pulse');
      demoLockBtn.classList.add('bg-white/5', 'text-zinc-400');
      if (demoLockIcon) demoLockIcon.setAttribute('data-lucide', 'unlock');
      if (demoLockBanner) demoLockBanner.classList.add('hidden');
      if (stealthHUDCard) stealthHUDCard.classList.remove('border-amber-500/60', 'shadow-[0_0_35px_rgba(245,158,11,0.3)]');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (demoLockBtn) demoLockBtn.addEventListener('click', toggleDemoLock);
  if (demoUnlockBtn) demoUnlockBtn.addEventListener('click', toggleDemoLock);

  // Toggle Listening
  demoListenBtn.addEventListener('click', () => {
    isListening = !isListening;
    if (isListening) {
      demoListenBtn.innerHTML = '<i data-lucide="square" class="w-2.5 h-2.5 fill-current"></i><span>Listening</span>';
      demoListenBtn.className = 'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all';
      audioWaveform.style.opacity = '1';
    } else {
      demoListenBtn.innerHTML = '<i data-lucide="play" class="w-2.5 h-2.5 fill-current"></i><span>Paused</span>';
      demoListenBtn.className = 'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-zinc-300 transition-all';
      audioWaveform.style.opacity = '0.3';
    }
    if (window.lucide) window.lucide.createIcons();
  });

  // Quick Assist Chip Handlers
  const demoChips = document.querySelectorAll('.demo-chip');
  demoChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const type = chip.getAttribute('data-chip');
      if (type === 'assist') {
        loadPreset('sysdesign');
      } else if (type === 'quote') {
        typewriterEffect(demoAnswerText, '"To answer your question directly: we decouple the ingestion pipeline using zero-copy ring buffers, ensuring zero heap allocation on the hot path."');
      } else if (type === 'questions') {
        demoBulletList.innerHTML = `
          <li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span><span><strong>Ask Interviewer:</strong> "What is your target p99 latency threshold under peak load?"</span></li>
          <li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span><span><strong>Ask Interviewer:</strong> "Are we optimizing for single-datacenter throughput or multi-region eventual consistency?"</span></li>
        `;
      } else if (type === 'recap') {
        demoBulletList.innerHTML = `
          <li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span><span><strong>Recap:</strong> Discussed async Rust Tokio gateway + Dragonfly Redis for 100k real-time WebSocket connections.</span></li>
        `;
      }
    });
  });

  const demoSendBtn = document.getElementById('demoSendBtn');
  if (demoSendBtn) {
    demoSendBtn.addEventListener('click', () => {
      loadPreset(currentPresetKey === 'sysdesign' ? 'leetcode' : currentPresetKey === 'leetcode' ? 'behavioral' : 'sysdesign');
    });
  }

  // Global Key Listener for Demo
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleHideMode();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      toggleDemoLock();
    }
  });

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    item.addEventListener('click', () => {
      const answer = item.querySelector('.faq-answer');
      const icon = item.querySelector('.faq-icon');
      const isClosed = answer.classList.contains('hidden');

      // Close all
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(ic => ic.classList.remove('rotate-180'));

      if (isClosed) {
        answer.classList.remove('hidden');
        icon.classList.add('rotate-180');
      }
    });
  });
});
