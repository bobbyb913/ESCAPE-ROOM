/**
 * 1999 Retro CRT Terminal Engine
 * State Machine Escape Room: INTRO -> PUZZLE_1 -> PUZZLE_2 -> PUZZLE_3 -> FINAL -> VICTORY
 * Pure Vanilla ES6 JavaScript
 */

(function () {
  'use strict';

  // --- Audio Synthesizer (Web Audio API & Retro Y2K Voices) ---
  class RetroAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.voiceFiles = {
        puzzle1: 'audio/puzzle1.wav',
        puzzle2: 'audio/puzzle2.wav',
        puzzle3: 'audio/puzzle3.wav',
        warning_abort: 'audio/warning_abort.wav',
        boulder_online: 'audio/boulder_online.wav',
        server_online: 'audio/server_online.wav',
        maze_unlocked: 'audio/maze_unlocked.wav',
        safe_discovered: 'audio/safe_discovered.wav',
        system_verified: 'audio/system_verified.wav',
        protocol_cancelled: 'audio/protocol_cancelled.wav',
        error_retry: 'audio/error_retry.wav'
      };
      this.clickFiles = [
        'audio/click1.wav',
        'audio/click2.wav',
        'audio/click3.wav',
        'audio/click4.wav',
        'audio/click5.wav'
      ];
      this.specialClickFiles = {
        Space: 'audio/space.wav',
        Enter: 'audio/enter.wav',
        Backspace: 'audio/click4.wav'
      };
      this.preloadedAudios = {};
      this.initPreload();
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    initPreload() {
      const allFiles = { ...this.voiceFiles, ...this.specialClickFiles };
      this.clickFiles.forEach((file, idx) => {
        allFiles[`click_${idx}`] = file;
      });

      Object.entries(allFiles).forEach(([key, src]) => {
        try {
          const a = new Audio(src);
          a.preload = 'auto';
          this.preloadedAudios[key] = a;
        } catch (e) {}
      });
    }

    playVoice(key, fallbackText) {
      if (!this.enabled) return;
      this.init();

      const src = this.voiceFiles[key];
      if (src) {
        try {
          const audio = new Audio(src);
          audio.volume = 1.0;
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              this.speakRobotic(fallbackText);
            });
          }
        } catch (e) {
          this.speakRobotic(fallbackText);
        }
      } else if (fallbackText) {
        this.speakRobotic(fallbackText);
      }
    }

    speakRobotic(text) {
      if (!this.enabled || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.pitch = 0.45;
        utter.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const retroVoice = voices.find(v => /zarvox|fred|trinoids|robot|bad news|daniel|ralph/i.test(v.name));
        if (retroVoice) {
          utter.voice = retroVoice;
        }
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }

    playKey(keyType = 'normal') {
      if (!this.enabled) return;
      this.init();

      // 1. Play real mechanical sample with randomized pitch/variant
      let sampleFile = null;
      if (keyType === 'Space') {
        sampleFile = this.specialClickFiles.Space;
      } else if (keyType === 'Enter') {
        sampleFile = this.specialClickFiles.Enter;
      } else if (keyType === 'Backspace') {
        sampleFile = this.specialClickFiles.Backspace;
      } else {
        const randIdx = Math.floor(Math.random() * this.clickFiles.length);
        sampleFile = this.clickFiles[randIdx];
      }

      if (sampleFile) {
        try {
          const a = new Audio(sampleFile);
          a.volume = keyType === 'Enter' ? 0.75 : (keyType === 'Space' ? 0.7 : 0.6);
          a.playbackRate = 0.94 + Math.random() * 0.12;
          a.play().catch(() => {});
        } catch (e) {}
      }

      // 2. Synthesize low-latency punchy mechanical transient layer via Web Audio
      if (this.ctx) {
        this.synthMechanicalClick(keyType);
      }
    }

    synthMechanicalClick(keyType) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Contact noise transient
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.005);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(keyType === 'Space' ? 1800 : (keyType === 'Enter' ? 2200 : 3600), now);
      filter.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.05, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.007);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      whiteNoise.start(now);

      // Acoustic body clack oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'triangle';
      const startFreq = keyType === 'Space' ? 900 : (keyType === 'Enter' ? 1150 : (1500 + Math.random() * 300));
      const endFreq = keyType === 'Space' ? 110 : (keyType === 'Enter' ? 180 : 200);
      const duration = keyType === 'Space' ? 0.045 : (keyType === 'Enter' ? 0.05 : 0.026);

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      oscGain.gain.setValueAtTime(keyType === 'Enter' ? 0.07 : 0.045, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    playEnter() {
      if (!this.enabled) return;
      this.playKey('Enter');
    }

    playError() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    }

    playSuccess() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const freqs = [440, 554, 659, 880];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);

        gain.gain.setValueAtTime(0.06, this.ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.06);
        osc.stop(this.ctx.currentTime + idx * 0.06 + 0.12);
      });
    }

    playChime() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.36);
      });
    }

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const melody = [
        { f: 523.25, d: 0.12 }, // C5
        { f: 659.25, d: 0.12 }, // E5
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.5, d: 0.35 }  // C6
      ];

      let t = this.ctx.currentTime;
      melody.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(note.f, t);

        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + note.d + 0.05);

        t += note.d + 0.04;
      });
    }

    playBeep(freq = 880, dur = 0.1) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    }

    toggle() {
      this.enabled = !this.enabled;
      if (this.enabled) {
        this.playBeep(1200, 0.08);
      }
      return this.enabled;
    }
  }

  // --- Countdown Timer (15:00 default) ---
  class CountdownTimer {
    constructor(displayElem, onExpire) {
      this.displayElem = displayElem;
      this.onExpire = onExpire;
      this.totalSeconds = 15 * 60; // 15:00
      this.remainingSeconds = this.totalSeconds;
      this.timerInterval = null;
      this.isRunning = false;
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.updateDisplay();
      this.timerInterval = setInterval(() => {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
          this.updateDisplay();
          if (this.remainingSeconds === 0) {
            this.pause();
            if (typeof this.onExpire === 'function') {
              this.onExpire();
            }
          }
        }
      }, 1000);
    }

    pause() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.isRunning = false;
    }

    reset(minutes = 15, seconds = 0) {
      this.pause();
      this.totalSeconds = (minutes * 60) + seconds;
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
      this.start();
    }

    set(minutes, seconds = 0) {
      this.pause();
      this.totalSeconds = (minutes * 60) + seconds;
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
    }

    updateDisplay() {
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (this.displayElem) {
        this.displayElem.textContent = formatted;
        if (this.remainingSeconds <= 60) {
          this.displayElem.classList.add('timer-pulse');
        } else {
          this.displayElem.classList.remove('timer-pulse');
        }
      }
    }

    getFormatted() {
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    getElapsedFormatted() {
      const elapsed = this.totalSeconds - this.remainingSeconds;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  // --- Matrix Rain Canvas ---
  class MatrixRain {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.active = false;
      this.animationId = null;
      this.characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';
      this.fontSize = 18;
      this.columns = 0;
      this.drops = [];

      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.columns = Math.floor(this.canvas.width / this.fontSize);
      this.drops = [];
      for (let i = 0; i < this.columns; i++) {
        this.drops[i] = Math.floor(Math.random() * -50);
      }
    }

    draw() {
      if (!this.ctx || !this.active) return;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = '#33ff33';
      this.ctx.font = `${this.fontSize}px 'VT323', monospace`;

      for (let i = 0; i < this.drops.length; i++) {
        const text = this.characters.charAt(Math.floor(Math.random() * this.characters.length));
        const x = i * this.fontSize;
        const y = this.drops[i] * this.fontSize;

        if (Math.random() > 0.85) {
          this.ctx.fillStyle = '#aaffaa';
        } else {
          this.ctx.fillStyle = '#33ff33';
        }

        this.ctx.fillText(text, x, y);

        if (y > this.canvas.height && Math.random() > 0.975) {
          this.drops[i] = 0;
        }
        this.drops[i]++;
      }

      this.animationId = requestAnimationFrame(() => this.draw());
    }

    toggle() {
      this.active = !this.active;
      if (this.active) {
        if (this.canvas) this.canvas.style.display = 'block';
        this.resize();
        this.draw();
      } else {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.canvas) {
          this.canvas.style.display = 'none';
          if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
      }
      return this.active;
    }
  }

  // --- Escape Room State Machine & Terminal Controller ---
  const GameState = {
    INTRO: 'INTRO',
    PUZZLE_1: 'PUZZLE_1',
    PUZZLE_2: 'PUZZLE_2',
    PUZZLE_3: 'PUZZLE_3',
    FINAL: 'FINAL',
    VICTORY: 'VICTORY'
  };

  // Override manual logic puzzle page number anytime via "?page=5" URL param or editing fallback below.
  const LOGIC_PUZZLE_PAGE = (new URLSearchParams(window.location.search).get('page')) || '#';

  // Authoritative 3-Phase Tiered Hint Matrix (synced with Escape Room Hint Table)
  const HINT_MATRIX = {
    [GameState.PUZZLE_1]: {
      phaseLabel: 'PHASE 1 (BEFORE OOPS)',
      promptTitle: 'Would you like help with?',
      topics: [
        {
          id: 'locks',
          key: '1',
          label: 'Locks',
          aliases: ['lock', 'locks', 'disk', 'disks', 'floppy'],
          hints: [
            { tier: 'HINT 1 (VAGUE)', text: 'Look for the disks.' },
            { tier: 'HINT 2 (LESS VAGUE)', text: 'Look through the disks.' },
            { tier: 'HINT 3 (THE ANSWER)', text: 'Align the disks to find the combination.' }
          ]
        },
        {
          id: 'terminal',
          key: '2',
          label: 'Terminal',
          aliases: ['terminal', 'date', 'dates', 'button', 'sync'],
          hints: [
            { tier: 'HINT 1 (VAGUE)', text: "You'll need to communicate." },
            { tier: 'HINT 2 (LESS VAGUE)', text: 'Learn how each input affects both terminals.' },
            { tier: 'HINT 3 (THE ANSWER)', text: 'Sync up the dates and then use the button that only controls yours to get to the correct date.' }
          ]
        },
        {
          id: 'admin_password',
          key: '3',
          label: 'Admin password',
          aliases: ['admin', 'password', 'pass', 'spot', 'code'],
          hints: [
            { tier: 'HINT 1 (VAGUE)', text: 'Remember your terminal codes with SPOT.' },
            { tier: 'HINT 2 (LESS VAGUE)', text: 'Look at the letters in SPOT.' },
            { tier: 'HINT 3 (THE ANSWER)', text: 'Match the color/shape with the letters in SPOT for the password.' }
          ]
        }
      ]
    },
    [GameState.PUZZLE_2]: {
      phaseLabel: 'PHASE 2 (AFTER OOPS, BEFORE NSYNC)',
      promptTitle: 'Would you like help with?',
      topics: [
        {
          id: 'locks',
          key: '1',
          label: 'Locks',
          aliases: ['lock', 'locks', 'bird', 'birds', 'binary'],
          hints: [
            { tier: 'HINT 1', text: 'Look for the birds.' },
            { tier: 'HINT 2', text: 'The birds encode the combination.' },
            { tier: 'HINT 3', text: 'The birds use binary to encode the combination.' }
          ]
        },
        {
          id: 'server_connections',
          key: '2',
          label: 'Server connections',
          aliases: ['server', 'connections', 'connection', 'socket', 'sockets', 'logic', 'wire', 'wires'],
          hints: [
            { tier: 'HINT 1', text: 'Use logic to connect the sockets.' },
            {
              tier: 'HINT 2',
              text: LOGIC_PUZZLE_PAGE === '#'
                ? 'Use the logic puzzle on page # (see manual table of contents) to connect the sockets.'
                : `Use the logic puzzle on page ${LOGIC_PUZZLE_PAGE} to connect the sockets.`
            },
            { tier: 'HINT 3', text: 'E goes with 5.' }
          ]
        },
        {
          id: 'admin_password',
          key: '3',
          label: 'Admin password',
          aliases: ['admin', 'password', 'pass', 'ispy', 'poster', 'grid'],
          hints: [
            { tier: 'HINT 1', text: 'I Spy a poster.' },
            { tier: 'HINT 2', text: 'The grid is in the server.' },
            { tier: 'HINT 3', text: 'Use the coordinates from the server grid to find the letters in the poster.' }
          ]
        }
      ]
    },
    [GameState.PUZZLE_3]: {
      phaseLabel: 'PHASE 3 (AFTER NSYNC)',
      promptTitle: 'Would you like help with?',
      topics: [
        {
          id: 'maze',
          key: '1',
          label: 'Maze',
          aliases: ['maze', 'directory', 'vault', 'safe', 'drive'],
          hints: [
            { tier: 'HINT 1', text: 'Explore the mainframe directory maze (type DIR or TREE to view sectors).' },
            { tier: 'HINT 2', text: 'Open the RESTRICTED directory and locate the VAULT sector.' },
            { tier: 'HINT 3', text: 'Run CD RESTRICTED, then CD VAULT, then TYPE SAFE_KEY.TXT for safe code 8492; open the safe and enter drive code ATLAS-2000.' }
          ]
        }
      ]
    }
  };

  class CRTTerminal {
    constructor() {
      this.audio = new RetroAudio();
      this.matrix = new MatrixRain('matrix-canvas');

      // Elements
      this.historyContainer = document.getElementById('terminal-history');
      this.terminalBody = document.getElementById('terminal-body');
      this.commandDisplay = document.getElementById('command-display');
      this.hiddenInput = document.getElementById('hidden-input');
      this.timerDisplay = document.getElementById('timer-display');
      this.audioStatusPill = document.getElementById('audio-status');
      this.promptSymbol = document.getElementById('prompt-symbol');
      this.stateBadge = document.getElementById('state-badge');
      this.systemStatusIndicator = document.getElementById('system-status-indicator');
      this.hintTriggerBtn = document.getElementById('hint-trigger-btn');
      this.hintModal = document.getElementById('hint-modal');
      this.hintPhaseBadge = document.getElementById('hint-phase-badge');
      this.hintDialogBody = document.getElementById('hint-dialog-body');
      this.hintDialogStatus = document.getElementById('hint-dialog-status');
      this.hintCounterBadge = document.getElementById('hint-counter-badge');
      this.hintCloseBtn = document.getElementById('hint-close-btn');

      // State Machine
      this.state = GameState.INTRO;
      this.commandPrompt = 'SYS:\\> ';
      this.history = [];
      this.historyIndex = -1;
      this.currentBuffer = '';
      this.isLocked = false;
      this.isProtocolAborted = false;
      this.activeTypewriter = null;

      // Interactive Tiered Hint State
      this.isHintModalOpen = false;
      this.activeHintTopicId = null;
      this.hintProgress = {};
      this.hintsUsedCount = 0;

      // Directory Maze Virtual Filesystem State
      this.currentPath = ['C:'];
      this.safeKeyDiscovered = false;
      this.virtualFS = this.initVirtualFS();

      // Initialize Timer (set to 15:00 as required)
      this.timer = new CountdownTimer(this.timerDisplay, () => this.handleTimerExpiry());

      this.initEvents();

      // Launch escape room progression starting at INTRO
      this.startIntro();
    }

    initEvents() {
      // Focus hidden input whenever user clicks background terminal area
      document.addEventListener('click', (e) => {
        if (this.isHintModalOpen || e.target.closest('#hint-modal, #hint-trigger-btn, #abort-button-container')) {
          return;
        }
        if (this.activeTypewriter) {
          // Fast-forward typewriter if clicked during intro/dialogue
          this.activeTypewriter.fastForward();
          return;
        }
        this.focusInput();
      });

      // Hint modal & trigger controls
      if (this.hintTriggerBtn) {
        this.hintTriggerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isHintModalOpen) {
            this.closeHintModal();
          } else {
            this.openHintModal();
          }
        });
      }

      if (this.hintCloseBtn) {
        this.hintCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeHintModal();
        });
      }

      if (this.hintModal) {
        this.hintModal.addEventListener('click', (e) => {
          if (e.target === this.hintModal) {
            this.closeHintModal();
          }
        });
      }

      window.addEventListener('keydown', (e) => {
        if (this.isHintModalOpen) {
          this.handleHintModalKeydown(e);
          return;
        }
        if (e.key === 'F1') {
          e.preventDefault();
          this.openHintModal();
        }
      });

      // Synchronize hidden input value
      this.hiddenInput.addEventListener('input', () => {
        if (this.isLocked || this.isHintModalOpen) {
          this.hiddenInput.value = '';
          return;
        }
        this.currentBuffer = this.hiddenInput.value;
        this.renderInput();
      });

      // Handle Keydown for Enter, Arrow Keys, Tabs, Backspace, Space, and characters
      this.hiddenInput.addEventListener('keydown', (e) => {
        if (this.isHintModalOpen) {
          e.preventDefault();
          return;
        }
        if (this.isLocked) {
          if (this.activeTypewriter && (e.key === 'Enter' || e.key === ' ')) {
            this.activeTypewriter.fastForward();
          }
          e.preventDefault();
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          this.audio.playKey('Enter');
          const cmd = this.hiddenInput.value;
          this.hiddenInput.value = '';
          this.currentBuffer = '';
          this.renderInput();
          this.submitCommand(cmd);
        } else if (e.key === ' ') {
          this.audio.playKey('Space');
        } else if (e.key === 'Backspace') {
          this.audio.playKey('Backspace');
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this.audio.playKey('normal');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.audio.playKey('normal');
          this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.audio.playKey('normal');
          this.navigateHistory(1);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.audio.playKey('normal');
          this.autoComplete();
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          this.clearScreen();
        }
      });

      window.addEventListener('focus', () => this.focusInput());
      this.focusInput();
    }

    focusInput() {
      if (this.hiddenInput && !this.isLocked && !this.isHintModalOpen) {
        this.hiddenInput.focus();
      }
    }

    renderInput() {
      if (this.commandDisplay) {
        this.commandDisplay.textContent = this.currentBuffer;
      }
    }

    updateStateBadge(text) {
      if (this.stateBadge) {
        this.stateBadge.textContent = text;
      }
    }

    updateSystemStatus(text) {
      if (this.systemStatusIndicator) {
        this.systemStatusIndicator.textContent = text;
      }
    }

    setPrompt(promptText) {
      this.commandPrompt = promptText;
      if (this.promptSymbol) {
        this.promptSymbol.textContent = promptText;
      }
    }

    navigateHistory(direction) {
      if (this.history.length === 0) return;

      if (direction === -1) {
        if (this.historyIndex === -1) {
          this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
          this.historyIndex--;
        }
      } else if (direction === 1) {
        if (this.historyIndex !== -1) {
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
          } else {
            this.historyIndex = -1;
            this.hiddenInput.value = '';
            this.currentBuffer = '';
            this.renderInput();
            return;
          }
        }
      }

      if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
        const item = this.history[this.historyIndex];
        this.hiddenInput.value = item;
        this.currentBuffer = item;
        this.renderInput();
        this.audio.playKey();
      }
    }

    autoComplete() {
      const input = this.currentBuffer.trim().toLowerCase();
      if (!input) return;

      const commands = [
        'help', 'hint', 'status', 'timer', 'matrix', 'scan', 'color',
        'audio', 'clear', 'reboot', 'skip', 'about'
      ];

      const matches = commands.filter(c => c.startsWith(input));
      if (matches.length === 1) {
        this.hiddenInput.value = matches[0];
        this.currentBuffer = matches[0];
        this.renderInput();
        this.audio.playKey();
      } else if (matches.length > 1) {
        this.printLine(`${this.commandPrompt}${this.currentBuffer}`, 'command-entry');
        this.printLine(`MATCHES: ${matches.join('   ')}`, 'system-dim');
      }
    }

    printLine(text, className = 'system-info') {
      if (!this.historyContainer) return null;
      const line = document.createElement('div');
      line.className = `log-entry ${className}`;
      line.textContent = text;
      this.historyContainer.appendChild(line);
      this.scrollToBottom();
      return line;
    }

    scrollToBottom() {
      if (this.terminalBody) {
        this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
      }
    }

    clearScreen() {
      if (this.historyContainer) {
        this.historyContainer.innerHTML = '';
      }
    }

    // --- Typewriter Effect with Audio & Fast-Forward Support ---
    typewriterPrint(text, speed = 25, onComplete) {
      const line = this.printLine('', 'log-entry transmission');
      let index = 0;
      let isDone = false;

      const controller = {
        timerId: null,
        fastForward: () => {
          if (isDone) return;
          isDone = true;
          if (controller.timerId) clearTimeout(controller.timerId);
          if (line) line.textContent = text;
          this.scrollToBottom();
          this.activeTypewriter = null;
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      };

      this.activeTypewriter = controller;

      const step = () => {
        if (isDone) return;
        if (index < text.length) {
          const char = text.charAt(index);
          line.textContent += char;
          index++;
          this.scrollToBottom();

          // Play click sound for typing effect
          const keyType = char === ' ' ? 'Space' : (char === '.' || char === '!' || char === '?' ? 'Enter' : 'normal');
          this.audio.playKey(keyType);

          // Varied cadence for punctuation
          let delay = speed;
          if (char === '.' || char === '!' || char === '?') delay = speed * 8;
          else if (char === ',' || char === ';' || char === ':') delay = speed * 4;

          controller.timerId = setTimeout(step, delay);
        } else {
          isDone = true;
          this.activeTypewriter = null;
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      };

      step();
      return controller;
    }

    // --- Virtual Filesystem Initialization for Directory Maze ---
    initVirtualFS() {
      return {
        name: 'C:',
        type: 'dir',
        children: {
          'README.TXT': {
            type: 'file',
            size: 1042,
            date: '12/31/1999  11:42 PM',
            content: [
              '=========================================================================',
              '  PROJECT ATLAS MAINFRAME DIRECTORY NAVIGATION GUIDE',
              '=========================================================================',
              '  Commands available in this console:',
              '    DIR / LS          - List contents of current directory',
              '    CD <folder>       - Navigate into folder (e.g. "CD RESTRICTED")',
              '    CD ..             - Move back up to parent directory',
              '    TYPE <file> / CAT - Display contents of a text file',
              '    TREE              - Print complete directory tree hierarchy',
              '    MAP / MAZE        - Display memory sector radar',
              '',
              '  MISSION DIRECTIVE:',
              '  Locate the physical safe access code. The code was archived into the',
              '  restricted vault sector prior to network desynchronization.',
              '  Find the code, unlock the physical safe, and retrieve the recovery drive.',
              '========================================================================='
            ]
          },
          'OVERRIDE.LOG': {
            type: 'file',
            size: 2180,
            date: '12/31/1999  11:44 PM',
            content: [
              '[LOG: 1999-12-31 23:44:12 UTC - DR. FERLAND]',
              'Mainframe automated failover has been suspended.',
              'The emergency override flash drive has been locked inside the reinforced',
              'security safe in the room.',
              'Authorized personnel must retrieve the physical key file from the secure vault',
              'directory to obtain the 4-digit combination.',
              'HURRY - WE HAVE LESS THAN 15 MINUTES BEFORE MIDNIGHT.'
            ]
          },
          'SYSTEM': {
            type: 'dir',
            date: '12/31/1999  11:30 PM',
            children: {
              'CONFIG.SYS': {
                type: 'file',
                size: 512,
                date: '12/31/1999  11:30 PM',
                content: [
                  'FILES=40',
                  'BUFFERS=30',
                  'DEVICE=C:\\SYSTEM\\HIMEM.SYS',
                  'DOS=HIGH,UMB',
                  'REM Y2K TEMPORAL SHIELD ACTIVE'
                ]
              },
              'DRIVERS.SYS': {
                type: 'file',
                size: 4096,
                date: '12/31/1999  11:32 PM',
                content: [
                  '[HARDWARE DRIVER REGISTRY]',
                  'DRV_01: IBM PC 300PL MOTHERBOARD (NOMINAL)',
                  'DRV_02: ESP32 SERIAL TELEMETRY BRIDGE (SYNCED)',
                  'DRV_03: RTC MILLENNIUM CENTURY REGISTER (ACTIVE)'
                ]
              },
              'RTC_CLOCK.LOG': {
                type: 'file',
                size: 1540,
                date: '12/31/1999  11:45 PM',
                content: [
                  '1999-12-31 23:45:01 [RTC] Baseline date calibrated via OOPS admin key.',
                  '1999-12-31 23:47:19 [NET] Server tower patched via NSYNC relay.',
                  '1999-12-31 23:50:00 [MAZE] Storage directory mounted for recovery agent.'
                ]
              }
            }
          },
          'ARCHIVE': {
            type: 'dir',
            date: '12/31/1999  11:35 PM',
            children: {
              'Y2K_MEMO.TXT': {
                type: 'file',
                size: 1892,
                date: '12/31/1999  11:35 PM',
                content: [
                  'MEMO // TO ALL ATLAS OPERATORS:',
                  'Do not attempt to modify the hardware clock manually.',
                  'Physical recovery media must be authenticated via the emergency flash drive.',
                  'Check the RESTRICTED folder for sector vault keys.'
                ]
              },
              'SERVER_MAP.DAT': {
                type: 'file',
                size: 3200,
                date: '12/31/1999  11:36 PM',
                content: [
                  '[SERVER TOWER CABLE PATCH MAP]',
                  'PORT A1 -> AUX B3 (CONNECTED)',
                  'PORT C2 -> RELAY D4 (CONNECTED)',
                  'I-SPY IDENTIFIER: NSYNC (CONFIRMED)'
                ]
              },
              'BACKUP_B': {
                type: 'dir',
                date: '12/31/1999  11:38 PM',
                children: {
                  'RECOVERY.DAT': {
                    type: 'file',
                    size: 8192,
                    date: '12/31/1999  11:38 PM',
                    content: [
                      '[FRAGMENTED BINARY DATA]',
                      '01010000 01010010 01001111 01001010 01000101 01000011 01010100',
                      'SECTOR EMPTY. TARGET DATA MOVED TO C:\\RESTRICTED\\VAULT\\'
                    ]
                  }
                }
              }
            }
          },
          'RESTRICTED': {
            type: 'dir',
            date: '12/31/1999  11:40 PM',
            children: {
              'ACCESS.LOG': {
                type: 'file',
                size: 980,
                date: '12/31/1999  11:40 PM',
                content: [
                  '[RESTRICTED ACCESS AUDIT LOG]',
                  'WARNING: Clearance Level 4 Required.',
                  'Facility safe combination key archived in subfolder: \\VAULT\\',
                  'Target file: SAFE_KEY.TXT'
                ]
              },
              'SECTOR_01': {
                type: 'dir',
                date: '12/31/1999  11:41 PM',
                children: {
                  'CORRUPT.BIN': {
                    type: 'file',
                    size: 2048,
                    date: '12/31/1999  11:41 PM',
                    content: [
                      'ERROR 0x80004005: SECTOR DAMAGED.',
                      'NO RECOVERY KEYS IN THIS SECTOR. CHECK VAULT.'
                    ]
                  }
                }
              },
              'VAULT': {
                type: 'dir',
                date: '12/31/1999  11:46 PM',
                children: {
                  'SAFE_KEY.TXT': {
                    type: 'file',
                    size: 1450,
                    date: '12/31/1999  11:46 PM',
                    content: [
                      '=========================================================================',
                      '  [TOP SECRET // PROJECT ATLAS CLASSIFIED ARCHIVE]',
                      '  PHYSICAL FACILITY SECURITY SAFE ACCESS CODE',
                      '=========================================================================',
                      '',
                      '    >>>>>  SAFE COMBINATION: [ 8 4 9 2 ]  <<<<<',
                      '',
                      '  LOCATION: REINFORCED SECURITY SAFE LOCATED IN THE ROOM.',
                      '  CONTENTS: EMERGENCY SYSTEM OVERRIDE FLASH DRIVE.',
                      '',
                      '  ACTION STEPS:',
                      '  1. Unlock the physical safe using combination: 8 4 9 2',
                      '  2. Retrieve the Emergency Recovery Flash Drive from inside.',
                      '  3. Enter the flash drive verification code on this terminal',
                      '     (Code on drive: ATLAS-2000 or type "MOUNT D:").',
                      '========================================================================='
                    ],
                    isSafeKey: true
                  }
                }
              }
            }
          }
        }
      };
    }

    getCurrentPathString() {
      if (this.currentPath.length === 1) {
        return `${this.currentPath[0]}\\`;
      }
      return this.currentPath.join('\\');
    }

    resolveDirNode(pathArray) {
      let curr = this.virtualFS;
      for (let i = 1; i < pathArray.length; i++) {
        const seg = pathArray[i].toUpperCase();
        if (!curr.children || !curr.children[seg] || curr.children[seg].type !== 'dir') {
          return null;
        }
        curr = curr.children[seg];
      }
      return curr;
    }

    cmdDir(arg) {
      let targetPath = [...this.currentPath];
      if (arg && arg.trim()) {
        const clean = arg.trim().replace(/\//g, '\\');
        if (clean === '\\' || clean === 'C:' || clean === 'C:\\') {
          targetPath = ['C:'];
        } else {
          const segs = clean.split('\\').filter(Boolean);
          for (const s of segs) {
            if (s === '..') {
              if (targetPath.length > 1) targetPath.pop();
            } else if (s !== '.') {
              targetPath.push(s.toUpperCase());
            }
          }
        }
      }

      const node = this.resolveDirNode(targetPath);
      if (!node || node.type !== 'dir') {
        this.printLine(`Directory not found: ${arg}`, 'system-error');
        return;
      }

      const pathStr = targetPath.length === 1 ? `${targetPath[0]}\\` : targetPath.join('\\');
      this.printLine(' Volume in drive C is ATLAS_OS', 'system-dim');
      this.printLine(' Volume Serial Number is 1999-Y2K', 'system-dim');
      this.printLine(` Directory of ${pathStr}`, 'system-highlight');
      this.printLine('', 'system-info');

      this.printLine(`12/31/1999  11:45 PM    <DIR>          .`, 'system-dim');
      this.printLine(`12/31/1999  11:45 PM    <DIR>          ..`, 'system-dim');

      let fileCount = 0;
      let byteTotal = 0;
      let dirCount = 2;

      const entries = Object.keys(node.children || {}).sort();
      for (const name of entries) {
        const item = node.children[name];
        const date = item.date || '12/31/1999  11:45 PM';
        if (item.type === 'dir') {
          dirCount++;
          this.printLine(`${date}    <DIR>          ${name}`, 'system-highlight');
        } else {
          fileCount++;
          const sz = item.size || 1024;
          byteTotal += sz;
          const szStr = sz.toLocaleString().padStart(14, ' ');
          this.printLine(`${date}    ${szStr} ${name}`, 'system-info');
        }
      }

      this.printLine(`              ${fileCount} File(s)  ${byteTotal.toLocaleString().padStart(12, ' ')} bytes`, 'system-dim');
      this.printLine(`              ${dirCount} Dir(s)    284,723,200 bytes free`, 'system-dim');
      this.printLine('', 'system-info');
      this.audio.playKey();
    }

    cmdCd(arg) {
      if (!arg || !arg.trim()) {
        this.printLine(this.getCurrentPathString(), 'system-info');
        return;
      }

      const clean = arg.trim().replace(/\//g, '\\');

      if (clean === '\\' || clean === 'C:' || clean === 'C:\\') {
        this.currentPath = ['C:'];
        this.setPrompt(`${this.getCurrentPathString()}> `);
        this.audio.playKey();
        return;
      }

      let newPath = [...this.currentPath];

      if (clean.startsWith('\\') || clean.toUpperCase().startsWith('C:\\')) {
        newPath = ['C:'];
        const stripped = clean.toUpperCase().replace(/^C:\\?/, '');
        const absSegs = stripped.split('\\').filter(Boolean);
        for (const s of absSegs) {
          newPath.push(s.toUpperCase());
        }
      } else {
        const segs = clean.split('\\').filter(Boolean);
        for (const s of segs) {
          if (s === '..') {
            if (newPath.length > 1) {
              newPath.pop();
            }
          } else if (s !== '.') {
            newPath.push(s.toUpperCase());
          }
        }
      }

      const testNode = this.resolveDirNode(newPath);
      if (!testNode || testNode.type !== 'dir') {
        this.audio.playError();
        this.printLine(`Invalid directory - "${arg}"`, 'system-error');
        return;
      }

      this.currentPath = newPath;
      this.setPrompt(`${this.getCurrentPathString()}> `);
      this.audio.playKey();
    }

    cmdType(arg) {
      if (!arg || !arg.trim()) {
        this.printLine('Syntax error: TYPE <filename>', 'system-error');
        return;
      }

      const clean = arg.trim().replace(/\//g, '\\');
      const segs = clean.split('\\').filter(Boolean);
      let fileName = segs.pop().toUpperCase();

      let targetPath = [...this.currentPath];
      if (clean.startsWith('\\') || clean.toUpperCase().startsWith('C:\\')) {
        targetPath = ['C:'];
        const stripped = clean.toUpperCase().replace(/^C:\\?/, '');
        const absSegs = stripped.split('\\').filter(Boolean);
        fileName = absSegs.pop();
        for (const s of absSegs) {
          targetPath.push(s);
        }
      } else {
        for (const s of segs) {
          if (s === '..') {
            if (targetPath.length > 1) targetPath.pop();
          } else if (s !== '.') {
            targetPath.push(s.toUpperCase());
          }
        }
      }

      const dirNode = this.resolveDirNode(targetPath);
      if (!dirNode || !dirNode.children || !dirNode.children[fileName] || dirNode.children[fileName].type !== 'file') {
        this.audio.playError();
        this.printLine(`File not found: ${arg}`, 'system-error');
        return;
      }

      const file = dirNode.children[fileName];
      this.printLine(`--- [CONTENT OF ${fileName}] ---`, 'system-dim');
      if (Array.isArray(file.content)) {
        file.content.forEach(line => {
          if (line.includes('SAFE COMBINATION')) {
            this.printLine(line, 'classified-box');
          } else if (line.startsWith('===')) {
            this.printLine(line, 'system-dim');
          } else if (line.startsWith('  [TOP SECRET') || line.startsWith('  MISSION DIRECTIVE')) {
            this.printLine(line, 'system-highlight');
          } else {
            this.printLine(line, 'system-info');
          }
        });
      }

      this.audio.playKey();

      if (file.isSafeKey) {
        this.safeKeyDiscovered = true;
        this.audio.playChime();
        this.audio.playVoice('safe_discovered', 'Facility safe combination verified. Retrieve the recovery drive.');
        this.printLine('', 'system-info');
        this.printLine('=========================================================================', 'system-dim');
        this.printLine('[!] PHYSICAL SAFE ACCESS CODE ACQUIRED: 8 4 9 2', 'system-highlight');
        this.printLine('Locate the reinforced safe in the room. Enter code 8492 to open.', 'system-info');
        this.printLine('Inside: Retrieve the Emergency Flash Drive and type its verification code', 'system-info');
        this.printLine('(Code on drive: ATLAS-2000 or type "MOUNT D:"):', 'system-highlight');
        this.printLine('=========================================================================', 'system-dim');
        this.printLine('', 'system-info');
      }
    }

    cmdTree() {
      this.printLine('Folder PATH listing for Volume ATLAS_OS', 'system-dim');
      this.printLine('Volume serial number is 1999-Y2K', 'system-dim');
      this.printLine('C:\\', 'system-highlight');

      const renderTree = (node, prefix) => {
        const keys = Object.keys(node.children || {}).sort();
        keys.forEach((key, idx) => {
          const isLast = idx === keys.length - 1;
          const pointer = isLast ? '└── ' : '├── ';
          const child = node.children[key];

          if (child.type === 'dir') {
            this.printLine(`${prefix}${pointer}${key}`, 'system-highlight');
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            renderTree(child, nextPrefix);
          } else {
            this.printLine(`${prefix}${pointer}${key}`, 'tree-view');
          }
        });
      };

      renderTree(this.virtualFS, '');
      this.printLine('', 'system-info');
      this.audio.playKey();
    }

    cmdSectorMap() {
      this.printLine('[+]==================== MAINFRAME MEMORY SECTOR RADAR ====================[+]', 'system-dim');
      this.printLine('|                                                                          |', 'sector-map');
      this.printLine('|  [ROOT: C:\\]                                                             |', 'sector-map');
      this.printLine('|      ├── [SYSTEM]     ─── [NOMINAL] (Hardware & Drivers)                 |', 'sector-map');
      this.printLine('|      ├── [ARCHIVE]    ─── [NOMINAL] (Server Routing Logs)                |', 'sector-map');
      this.printLine('|      └── [RESTRICTED] ─── [SHIELDED VAULT SECTOR]                        |', 'sector-map');
      this.printLine('|              ├── [SECTOR_01] ─── [CORRUPTED MEMORY]                      |', 'sector-map');
      this.printLine('|              └── [VAULT]     ─── [TARGET: SAFE_KEY.TXT]                  |', 'sector-map');
      this.printLine('|                                            ▲                             |', 'sector-map');
      this.printLine('|                                     SAFE CODE LOCATED                    |', 'sector-map');
      this.printLine('|                                                                          |', 'sector-map');
      this.printLine('|  NAVIGATION: "CD RESTRICTED", "CD VAULT", "TYPE SAFE_KEY.TXT"            |', 'system-highlight');
      this.printLine('[+]========================================================================[+]', 'system-dim');
      this.audio.playKey();
    }

    // --- State 1: INTRO ---
    startIntro() {
      this.closeHintModal(true);
      this.state = GameState.INTRO;
      this.isLocked = true;
      this.isProtocolAborted = false;
      this.hintProgress = {};
      this.hintsUsedCount = 0;
      this.updateHintTriggerState();
      document.body.classList.remove('theme-white', 'theme-amber', 'theme-cyan');

      const abortContainer = document.getElementById('abort-button-container');
      if (abortContainer) {
        abortContainer.style.display = 'none';
      }
      const cmdWrapper = document.querySelector('.command-line-wrapper');
      if (cmdWrapper) {
        cmdWrapper.style.display = 'flex';
      }

      this.updateStateBadge('INTRO');
      this.updateSystemStatus('[EMERGENCY PROTOCOL ARMED]');
      this.setPrompt('SYSTEM:\\> ');
      this.clearScreen();

      // 1. Auto-start the 15:00 countdown timer immediately
      this.timer.reset(15, 0);

      // 2. Display initial required text
      this.printLine('PROJECT ATLAS. Y2K RECOVERY FAILURE DETECTED. EMERGENCY PROTOCOL ARMED.', 'emergency-banner');

      // Subtle audio alert
      this.audio.playError();

      // Brief pause before incoming transmission
      setTimeout(() => {
        this.printLine('[INCOMING SECURE TRANSMISSION // ORIGIN: CHEYENNE MOUNTAIN MAINFRAME]', 'system-dim');
        this.printLine('TRANSMISSION HEADER: DR. FERLAND [CHIEF DEFENSE ARCHITECT]', 'transmission-sender');

        const ferlandParagraph =
          'Attention Project Atlas recovery team. Our automated Y2K stabilization patches have suffered catastrophic failure across all sectors. In less than 15 minutes, the midnight rollover will corrupt date registers worldwide, triggering cascading failures across the electrical grid and communications network. Your first task is to align the recovery disks, synchronize the dual date terminals, and match the SPOT codes to unlock Phase 1 with the Admin Password. If you get stuck at any stage, type "HINT" or press [ ? HINT ] for tiered guidance. Calibrate temporal registers now.';

        // Typewriter effect character by character
        this.typewriterPrint(ferlandParagraph, 22, () => {
          // Display skip hint momentarily then proceed
          this.printLine('', 'system-info');
          this.printLine('[TRANSMISSION TERMINATED // TRANSFERRING CONTROL TO TERMINAL CONSOLE...]', 'system-highlight');

          setTimeout(() => {
            // Once text finishes typing: change state to PUZZLE_1, clear screen, display STEP 1
            this.transitionToPuzzle1();
          }, 1400);
        });
      }, 700);
    }

    // --- State 2: PUZZLE_1 (Phase 1: Before OOPS) ---
    transitionToPuzzle1() {
      this.closeHintModal(true);
      this.state = GameState.PUZZLE_1;
      this.updateHintTriggerState();
      this.updateStateBadge('PHASE 1');
      this.updateSystemStatus('[T-MINUS ROLLOVER // LOCK 1 OF 3]');
      this.setPrompt('ENTER ADMIN PASSWORD> ');

      // Clear the screen as required
      this.clearScreen();

      // Display STEP 1: VERIFY SYSTEM DATE
      this.printLine('STEP 1: VERIFY SYSTEM DATE // PHASE 1', 'puzzle-header');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('TEMPORAL ANOMALY: Hardware RTC century register desynchronized.', 'system-info');
      this.printLine('1. LOCKS    : Search for the disks and align them for the combination.', 'system-info');
      this.printLine('2. TERMINAL : Communicate to sync both date terminals to the target date.', 'system-info');
      this.printLine('3. PASSWORD : Match your terminal color/shape codes with SPOT.', 'system-highlight');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('Enter Phase 1 Admin Password below:', 'system-highlight');
      this.printLine('Need help? Type "HINT" or click [ ? HINT ] for Locks, Terminal, or Password hints.', 'skip-hint');
      this.printLine('', 'system-info');

      // Input field is now active and waiting for password
      this.isLocked = false;
      this.focusInput();
      this.audio.playBeep(880, 0.15);
      // Play Y2K robotic voice prompt: "Please add password 1."
      this.audio.playVoice('puzzle1', 'Please add password 1.');
    }

    validatePuzzle1(input) {
      const clean = input.trim().toUpperCase();

      // Canonical Phase 1 Admin Password from Hint Table: OOPS
      const validAnswers = ['OOPS', 'OOPS!'];

      if (validAnswers.includes(clean)) {
        this.closeHintModal(true);
        this.audio.playSuccess();
        this.audio.playVoice('system_verified', 'System date verified. Recovery 1 of 3 complete.');
        // Exact requested message
        this.printLine('SYSTEM DATE VERIFIED. RECOVERY 1 OF 3 COMPLETE.', 'system-success');

        this.isLocked = true;
        setTimeout(() => {
          this.printLine('[INCOMING TRANSMISSION: DR. FERLAND]', 'transmission-sender');
          const dialogue2 =
            'Great job! Phase 1 Admin access confirmed and system date registers are stabilized. Now for Phase 2: mainframe server connections are offline. Decode the binary birds to unlock the manual, use the logic puzzle to patch the server sockets, and read the server grid coordinates against the I-Spy poster to reveal the Phase 2 Admin Password.';

          this.typewriterPrint(dialogue2, 22, () => {
            this.printLine('', 'system-info');
            this.printLine('[TRANSMISSION PAUSED // PROCEEDING TO PHASE 2...]', 'system-highlight');
            setTimeout(() => {
              this.transitionToPuzzle2();
            }, 1200);
          });
        }, 600);
      } else {
        this.audio.playError();
        this.audio.playVoice('error_retry', 'Error. Invalid entry. Retry.');
        // Exact requested error message in red; prompt returns to green for next attempt
        this.printLine('ERR: INVALID SYSTEM DATE - RETRY', 'system-error');
        this.printLine('Tip: Type "hint" or click [ ? HINT ] for help with Locks, Terminal, or Admin password.', 'skip-hint');
      }
    }

    // --- State 3: PUZZLE_2 (Phase 2: After OOPS, Before NSYNC) ---
    transitionToPuzzle2() {
      this.closeHintModal(true);
      this.state = GameState.PUZZLE_2;
      this.updateHintTriggerState();
      this.updateStateBadge('PHASE 2');
      this.updateSystemStatus('[SERVER TELEMETRY OFFLINE // LOCK 2 OF 3]');
      this.setPrompt('ENTER ADMIN PASSWORD> ');
      this.clearScreen();

      this.printLine('STEP 2: MAINFRAME SERVER CONNECTIONS // PHASE 2', 'puzzle-header');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('MAINFRAME TELEMETRY OFFLINE: Local server sockets disconnected.', 'system-info');
      this.printLine('1. LOCKS      : Decode the binary birds poster for the lock combination.', 'system-info');
      this.printLine('2. SERVER     : Solve the manual logic puzzle to wire the sockets.', 'system-info');
      this.printLine('3. PASSWORD   : Use server grid coordinates on the I-Spy poster.', 'system-highlight');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('Enter Phase 2 Admin Password below:', 'system-highlight');
      this.printLine('Need help? Type "HINT" or click [ ? HINT ] for Locks, Server, or Password hints.', 'skip-hint');
      this.printLine('', 'system-info');

      this.isLocked = false;
      this.focusInput();
      this.audio.playBeep(980, 0.15);
      // Play Y2K robotic voice prompt: "Please add password 2."
      this.audio.playVoice('puzzle2', 'Please add password 2.');
      // Timer continues running uninterrupted
    }

    validatePuzzle2(input) {
      const clean = input.trim().toUpperCase();

      // Canonical Phase 2 Admin Password from Hint Table & I-Spy Grid: NSYNC
      const validAnswers = [
        'NSYNC',
        "'N SYNC",
        "N'SYNC",
        'N-SYNC',
        'NSINC',
        'NSYNC!',
        '*NSYNC'
      ];

      if (validAnswers.includes(clean)) {
        this.closeHintModal(true);
        this.audio.playSuccess();
        this.audio.playVoice('server_online', 'Server connections synchronized. Emergency directory unlocked.');
        this.printLine('SERVER CONNECTIONS SYNCHRONIZED. EMERGENCY STORAGE BUFFER UNLOCKED.', 'system-success');

        this.isLocked = true;
        setTimeout(() => {
          this.printLine('[INCOMING TRANSMISSION: DR. FERLAND]', 'transmission-sender');
          const dialogue3 =
            'Server tower online! Phase 2 cleared and all telemetry nodes are communicating. For Phase 3, our automated master recovery archive is locked inside the mainframe directory maze. Navigate the maze to uncover the physical safe combination, retrieve the emergency flash drive, and initiate the final abort sequence!';

          this.typewriterPrint(dialogue3, 22, () => {
            this.printLine('', 'system-info');
            this.printLine('[TRANSMISSION TERMINATED // INITIALIZING PHASE 3 MAZE CONSOLE...]', 'system-highlight');
            setTimeout(() => {
              this.transitionToPuzzle3();
            }, 1200);
          });
        }, 600);
      } else {
        this.audio.playError();
        this.audio.playVoice('error_retry', 'Error. Invalid entry. Retry.');
        this.printLine('ERR: INVALID ADMIN PASSWORD - CHECK SERVER GRID & I-SPY POSTER', 'system-error');
        this.printLine('Tip: Type "hint" or click [ ? HINT ] for help with Locks, Server connections, or Admin password.', 'skip-hint');
      }
    }

    // --- State 4: PUZZLE_3 (Phase 3: After NSYNC - Maze & Physical Safe/Drive) ---
    transitionToPuzzle3() {
      this.closeHintModal(true);
      this.state = GameState.PUZZLE_3;
      this.updateHintTriggerState();
      this.updateStateBadge('PHASE 3: MAZE');
      this.updateSystemStatus('[DIRECTORY VAULT LOCKED // LOCK 3 OF 3]');
      this.currentPath = ['C:'];
      this.safeKeyDiscovered = false;
      this.setPrompt('C:\\> ');
      this.clearScreen();

      this.printLine('STEP 3: MAINFRAME DIRECTORY MAZE // PHASE 3', 'puzzle-header');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('MAINFRAME VIRTUAL STORAGE MOUNTED AT C:\\', 'system-info');
      this.printLine('The physical safe combination is hidden inside the mainframe directory maze.', 'system-info');
      this.printLine('Navigate the maze to read the safe combination, open the safe, and mount the drive.', 'system-highlight');
      this.printLine('=========================================================================', 'system-dim');
      this.printLine('COMMANDS: DIR (list files) | CD <dir> (change folder) | TYPE <file> (view file)', 'system-highlight');
      this.printLine('          TREE (show folder tree) | MAP (show memory radar) | HINT', 'system-highlight');
      this.printLine('Type "DIR" to explore, "MAP" for sector radar, or "HINT" for Maze help.', 'skip-hint');
      this.printLine('', 'system-info');

      this.isLocked = false;
      this.focusInput();
      this.audio.playBeep(1100, 0.15);
      // Play Y2K robotic voice prompt
      this.audio.playVoice('maze_unlocked', 'Mainframe directory maze unlocked. Locate the safe combination.');
      // Timer continues running uninterrupted
    }

    validatePuzzle3(input) {
      const raw = input.trim();
      const cleanUpper = raw.toUpperCase();
      const parts = raw.split(/\s+/);
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      // 1. Directory Maze Navigation Commands:
      if (command === 'dir' || command === 'ls') {
        this.cmdDir(arg);
        return;
      }
      if (command === 'cd' || command === 'chdir') {
        this.cmdCd(arg);
        return;
      }
      if (command === 'type' || command === 'cat' || command === 'view' || command === 'read') {
        this.cmdType(arg);
        return;
      }
      if (command === 'tree') {
        this.cmdTree();
        return;
      }
      if (command === 'map' || command === 'maze' || command === 'radar') {
        this.cmdSectorMap();
        return;
      }
      if (command === 'pwd') {
        this.printLine(`CURRENT DIRECTORY: ${this.getCurrentPathString()}`, 'system-info');
        return;
      }

      // 2. Safe Code / Flash Drive Verification:
      const validCodes = [
        'ATLAS-2000',
        'ATLAS 2000',
        'ATLAS2000',
        '8492',
        'FLASH',
        'FLASHDRIVE',
        'FLASH DRIVE',
        'USB',
        'USB DRIVE',
        'MOUNT',
        'MOUNT D:',
        'MOUNT D',
        'MOUNT A:',
        'DRIVE',
        'FLOPPY',
        'RECOVERY-01',
        'RECOVERY'
      ];

      if (validCodes.includes(cleanUpper)) {
        if (cleanUpper === '8492') {
          this.printLine('=========================================================================', 'system-dim');
          this.printLine('SAFE CODE 8492 CONFIRMED: Opening physical safe in the room now!', 'system-highlight');
          this.printLine('Retrieve the Emergency Flash Drive and enter its verification code.', 'system-info');
          this.printLine('=========================================================================', 'system-dim');
        }

        this.audio.playError();
        this.audio.playVoice('warning_abort', 'Emergency recovery drive detected. Final authorization required.');
        // Flashing red warning
        this.printLine('EMERGENCY RECOVERY DRIVE DETECTED. FINAL AUTHORIZATION REQUIRED.', 'flashing-red-warning');

        // Replace standard text input with clickable ASCII-styled button
        this.showAbortButton();
      } else {
        this.audio.playError();
        this.audio.playVoice('error_retry', 'Error. Invalid entry. Retry.');
        this.printLine(`ERR: BAD COMMAND OR UNRECOGNIZED DRIVE CODE: "${raw}"`, 'system-error');
        this.printLine('Type "DIR", "CD <dir>", "TYPE <file>", "TREE", or "MAP" to navigate maze.', 'skip-hint');
      }
    }

    // --- Interactive Tiered Hint System (Synced with HINT_MATRIX) ---
    getHintPhaseConfig(state = this.state) {
      return HINT_MATRIX[state] || null;
    }

    getHintUnlockedTier(state, topicId) {
      return (this.hintProgress[state] && this.hintProgress[state][topicId]) || 0;
    }

    updateHintTriggerState() {
      if (!this.hintTriggerBtn) return;
      const canUseHints = Boolean(this.getHintPhaseConfig(this.state)) && !this.isProtocolAborted;
      this.hintTriggerBtn.disabled = !canUseHints;
      this.hintTriggerBtn.textContent = canUseHints ? '[ ? HINT ]' : '[ HINT: N/A ]';
    }

    findHintTopicByQuery(cfg, query) {
      if (!cfg || !query) return null;
      const clean = query.trim().toLowerCase();
      if (!clean) return null;
      return cfg.topics.find((t) =>
        t.key === clean ||
        t.id === clean ||
        t.label.toLowerCase() === clean ||
        t.label.toLowerCase().includes(clean) ||
        (t.aliases && t.aliases.some((a) => clean.includes(a)))
      ) || null;
    }

    openHintModal(topicQuery = '') {
      if (this.state === GameState.INTRO) {
        this.printLine('[!] BRIEFING IN PROGRESS: Click screen or press Enter to proceed to Phase 1 before using hints.', 'skip-hint');
        return;
      }
      const cfg = this.getHintPhaseConfig(this.state);
      if (!cfg || this.isProtocolAborted || this.state === GameState.VICTORY || this.state === GameState.FINAL) {
        this.printLine('[!] NO HINTS REQUIRED FOR THIS STAGE.', 'system-dim');
        return;
      }

      if (!this.hintProgress[this.state]) {
        this.hintProgress[this.state] = {};
      }

      const matchedTopic = this.findHintTopicByQuery(cfg, topicQuery);
      this.isHintModalOpen = true;
      if (this.hiddenInput) {
        this.hiddenInput.blur();
      }
      if (this.hintModal) {
        this.hintModal.hidden = false;
      }
      this.audio.playBeep(920, 0.08);

      if (matchedTopic) {
        this.activeHintTopicId = matchedTopic.id;
        this.revealNextHint(matchedTopic.id, true);
      } else {
        this.activeHintTopicId = null;
        this.renderHintModal();
      }
    }

    closeHintModal(silent = false) {
      if (!this.isHintModalOpen && (!this.hintModal || this.hintModal.hidden)) {
        return;
      }
      this.isHintModalOpen = false;
      this.activeHintTopicId = null;
      if (this.hintModal) {
        this.hintModal.hidden = true;
      }
      if (!silent) {
        this.audio.playKey('Escape');
      }
      this.focusInput();
    }

    selectHintTopic(topicId) {
      const cfg = this.getHintPhaseConfig(this.state);
      if (!cfg) return;
      const topic = cfg.topics.find((t) => t.id === topicId);
      if (!topic) return;

      this.activeHintTopicId = topic.id;
      const currentTier = this.getHintUnlockedTier(this.state, topic.id);
      if (currentTier === 0) {
        this.revealNextHint(topic.id, true);
      } else {
        this.audio.playKey();
        this.renderHintModal();
      }
    }

    revealNextHint(topicId, fromUserAction = false) {
      const cfg = this.getHintPhaseConfig(this.state);
      if (!cfg) return;
      const topic = cfg.topics.find((t) => t.id === topicId);
      if (!topic) return;

      if (!this.hintProgress[this.state]) {
        this.hintProgress[this.state] = {};
      }

      const currentTier = this.getHintUnlockedTier(this.state, topic.id);
      if (currentTier < topic.hints.length) {
        const nextTier = currentTier + 1;
        this.hintProgress[this.state][topic.id] = nextTier;
        this.hintsUsedCount++;

        const hintObj = topic.hints[nextTier - 1];
        const logStyle = nextTier === 3 ? 'system-highlight' : 'system-info';
        this.printLine(
          `[HINT // ${topic.label.toUpperCase()} (${nextTier}/${topic.hints.length})]: ${hintObj.text}`,
          logStyle
        );

        if (fromUserAction) {
          this.audio.playBeep(nextTier === 3 ? 1140 : 880, 0.09);
        }
      }

      this.renderHintModal();
    }

    formatHintPips(unlocked, total) {
      const filled = '\u25A0'.repeat(unlocked);
      const empty = '\u25A1'.repeat(Math.max(0, total - unlocked));
      return `[${filled}${empty}] ${unlocked}/${total}`;
    }

    renderHintModal() {
      const cfg = this.getHintPhaseConfig(this.state);
      if (!cfg || !this.hintDialogBody) return;

      if (this.hintPhaseBadge) {
        this.hintPhaseBadge.textContent = cfg.phaseLabel;
      }
      if (this.hintCounterBadge) {
        this.hintCounterBadge.textContent = `HINTS USED: ${this.hintsUsedCount}`;
      }

      this.hintDialogBody.textContent = '';

      if (!this.activeHintTopicId) {
        if (this.hintDialogStatus) {
          this.hintDialogStatus.textContent = cfg.topics.length > 1
            ? `KEYS [1-${cfg.topics.length}] SELECT TOPIC | [ESC] CLOSE`
            : 'KEY [1] SELECT MAZE HELP | [ESC] CLOSE';
        }

        const heading = document.createElement('h2');
        heading.id = 'hint-modal-question';
        heading.className = 'hint-question';
        heading.textContent = cfg.promptTitle;

        const subnote = document.createElement('div');
        subnote.className = 'hint-subnote';
        subnote.textContent = 'Select a category below. Hints reveal step-by-step without spoiling the answer.';

        const grid = document.createElement('div');
        grid.className = 'hint-topic-grid';

        cfg.topics.forEach((topic, index) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'hint-topic-btn';
          btn.dataset.topicId = topic.id;

          const left = document.createElement('span');
          left.className = 'hint-topic-left';

          const keycap = document.createElement('span');
          keycap.className = 'hint-keycap';
          keycap.textContent = topic.key;

          const labelSpan = document.createElement('span');
          labelSpan.textContent = topic.label.toUpperCase();

          left.appendChild(keycap);
          left.appendChild(labelSpan);

          const pips = document.createElement('span');
          pips.className = 'hint-pips';
          const unlocked = this.getHintUnlockedTier(this.state, topic.id);
          pips.textContent = this.formatHintPips(unlocked, topic.hints.length);

          btn.appendChild(left);
          btn.appendChild(pips);

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectHintTopic(topic.id);
          });

          grid.appendChild(btn);
          if (index === 0) {
            requestAnimationFrame(() => btn.focus());
          }
        });

        this.hintDialogBody.appendChild(heading);
        this.hintDialogBody.appendChild(subnote);
        this.hintDialogBody.appendChild(grid);
        return;
      }

      // Render Topic Detail & Progressive Hint Cards
      const topic = cfg.topics.find((t) => t.id === this.activeHintTopicId);
      if (!topic) {
        this.activeHintTopicId = null;
        this.renderHintModal();
        return;
      }

      const unlocked = this.getHintUnlockedTier(this.state, topic.id);

      if (this.hintDialogStatus) {
        this.hintDialogStatus.textContent = unlocked < topic.hints.length
          ? '[N / ENTER] NEXT HINT | [B] TOPICS | [ESC] CLOSE'
          : '[B] OTHER TOPICS | [ESC] RETURN TO CONSOLE';
      }

      const headerRow = document.createElement('div');
      headerRow.className = 'hint-topic-header';

      const title = document.createElement('h2');
      title.id = 'hint-modal-question';
      title.className = 'hint-topic-title';
      title.textContent = `HELP // ${topic.label.toUpperCase()}`;

      const tierPips = document.createElement('span');
      tierPips.className = 'hint-pips';
      tierPips.textContent = this.formatHintPips(unlocked, topic.hints.length);

      headerRow.appendChild(title);
      headerRow.appendChild(tierPips);

      const ladder = document.createElement('div');
      ladder.className = 'hint-ladder';

      for (let i = 0; i < unlocked; i++) {
        const item = topic.hints[i];
        const card = document.createElement('div');
        card.className = `hint-card tier-${i + 1}`;

        const badge = document.createElement('div');
        badge.className = 'hint-tier-badge';
        badge.textContent = item.tier;

        const textEl = document.createElement('div');
        textEl.className = 'hint-card-text';
        textEl.textContent = item.text;

        card.appendChild(badge);
        card.appendChild(textEl);
        ladder.appendChild(card);
      }

      const actions = document.createElement('div');
      actions.className = 'hint-actions';

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'hint-action-btn primary';
      if (unlocked < topic.hints.length) {
        const nextTierNum = unlocked + 1;
        const nextLabel = nextTierNum === 3 ? 'SHOW HINT 3 (THE ANSWER)' : `SHOW HINT ${nextTierNum}`;
        nextBtn.textContent = `[ N ] ${nextLabel}`;
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.revealNextHint(topic.id, true);
        });
      } else {
        nextBtn.textContent = '[ ALL 3 HINTS REVEALED ]';
        nextBtn.disabled = true;
      }

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'hint-action-btn';
      backBtn.textContent = '[ B ] TOPICS';
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.playKey();
        this.activeHintTopicId = null;
        this.renderHintModal();
      });

      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'hint-action-btn';
      doneBtn.textContent = '[ ESC ] BACK TO CONSOLE';
      doneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeHintModal();
      });

      actions.appendChild(nextBtn);
      actions.appendChild(backBtn);
      actions.appendChild(doneBtn);

      this.hintDialogBody.appendChild(headerRow);
      this.hintDialogBody.appendChild(ladder);
      this.hintDialogBody.appendChild(actions);

      requestAnimationFrame(() => {
        if (!nextBtn.disabled) {
          nextBtn.focus();
        } else {
          doneBtn.focus();
        }
      });
    }

    handleHintModalKeydown(e) {
      if (e.key === 'Escape' || e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        this.closeHintModal();
        return;
      }

      const cfg = this.getHintPhaseConfig(this.state);
      if (!cfg) return;

      if (!this.activeHintTopicId) {
        const matched = cfg.topics.find((t) => t.key === e.key);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          this.selectHintTopic(matched.id);
        }
        return;
      }

      const keyLower = e.key.toLowerCase();
      if (keyLower === 'b' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        this.audio.playKey();
        this.activeHintTopicId = null;
        this.renderHintModal();
      } else if (keyLower === 'n') {
        e.preventDefault();
        e.stopPropagation();
        this.revealNextHint(this.activeHintTopicId, true);
      }
    }

    showAbortButton() {
      this.closeHintModal(true);
      this.isLocked = true;
      this.isProtocolAborted = true;
      this.updateHintTriggerState();

      // Hide standard command line input wrapper
      const cmdWrapper = document.querySelector('.command-line-wrapper');
      if (cmdWrapper) {
        cmdWrapper.style.display = 'none';
      }

      // Check if button container already exists, or create one in terminal-footer
      const footer = document.querySelector('.terminal-footer');
      let abortContainer = document.getElementById('abort-button-container');
      if (!abortContainer && footer) {
        abortContainer = document.createElement('div');
        abortContainer.id = 'abort-button-container';
        abortContainer.className = 'abort-button-wrapper';

        const btn = document.createElement('button');
        btn.id = 'abort-button';
        btn.className = 'ascii-abort-button';
        btn.textContent = '[ ABORT EMERGENCY PROTOCOL ]';
        btn.setAttribute('aria-label', 'Abort Emergency Protocol');

        abortContainer.appendChild(btn);
        footer.insertBefore(abortContainer, footer.firstChild);
      }

      if (abortContainer) {
        abortContainer.style.display = 'flex';
      }

      const abortBtn = document.getElementById('abort-button');
      if (abortBtn) {
        abortBtn.focus();

        const triggerAbort = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (abortBtn.disabled) return;
          abortBtn.disabled = true;
          this.executeAbortEmergencyProtocol();
        };

        abortBtn.onclick = triggerAbort;

        // Also allow Enter / Space key anywhere after a short delay so the Enter that submitted the code does not fire it
        this.abortKeyHandler = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            triggerAbort(e);
          }
        };
        setTimeout(() => {
          window.addEventListener('keydown', this.abortKeyHandler, { once: true });
        }, 300);
      }

      this.scrollToBottom();
    }

    executeAbortEmergencyProtocol() {
      if (this.abortKeyHandler) {
        window.removeEventListener('keydown', this.abortKeyHandler);
        this.abortKeyHandler = null;
      }

      // 1. Stop countdown timer immediately
      this.timer.pause();
      this.audio.playBeep(600, 0.1);

      // 2. Clear the screen
      this.clearScreen();

      this.updateStateBadge('PROTOCOL ABORTED');
      this.updateSystemStatus('[SYSTEM NOMINAL]');

      // 3. Print sequence of system checks
      const checks = [
        'INITIATING EMERGENCY OVERRIDE SEQUENCE...',
        'BOULDER NODE - ONLINE',
        'POWER SYSTEMS - STABLE',
        'REGIONAL ELECTRICAL GRIDS - SYNCHRONIZED',
        'AIR TRAFFIC CONTROL RADAR - NOMINAL',
        'GLOBAL TELECOMMUNICATIONS - RESTORED',
        'CENTURY CLOCK REGISTERS - 2000 AD SYNCHRONIZED'
      ];

      let checkIdx = 0;
      const checkInterval = setInterval(() => {
        if (checkIdx < checks.length) {
          const text = checks[checkIdx];
          if (text.includes('ONLINE') || text.includes('STABLE') || text.includes('SYNCHRONIZED') || text.includes('NOMINAL') || text.includes('RESTORED')) {
            this.printLine(text, 'system-success');
          } else {
            this.printLine(text, 'system-info');
          }
          this.audio.playKey();
          checkIdx++;
        } else {
          clearInterval(checkInterval);

          setTimeout(() => {
            // 4. Change text color to calm terminal white
            document.body.classList.remove('theme-amber', 'theme-cyan');
            document.body.classList.add('theme-white');

            // 5. Display 'PROJECT ATLAS: EMERGENCY PROTOCOL CANCELLED'
            this.printLine('', 'system-info');
            this.printLine('=========================================================================', 'system-dim');
            this.printLine('PROJECT ATLAS: EMERGENCY PROTOCOL CANCELLED', 'system-highlight');
            this.printLine('=========================================================================', 'system-dim');
            this.printLine('', 'system-info');
            this.audio.playVoice('protocol_cancelled', 'Project Atlas. Emergency protocol cancelled.');

            // 6. Print final Dr. Ferland text via typewriter
            this.printLine('[INCOMING AUDIO TRANSMISSION: DR. FERLAND]', 'transmission-sender');
            const finalSpeech =
              'We did it. The emergency recovery drive successfully halted the cascade. The rollover has passed with zero catastrophic failures. All civilian, military, and energy infrastructures are operating in nominal parameters. Project Atlas is officially standing down. Welcome to the 21st century.';

            this.typewriterPrint(finalSpeech, 22, () => {
              this.printLine('', 'system-info');

              // 7. Display large 'JANUARY 1, 2000 - 00:00:00'
              this.printLine('JANUARY 1, 2000 - 00:00:00', 'large-millennium-date');

              const millenniumBanner = [
                '=========================================================================',
                '                                                                         ',
                '    ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗   ██████╗ ██╗ ',
                '    ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║   ██╔══██╗██║ ',
                '    ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║   ██████╔╝██║ ',
                '    ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║   ██╔═══╝ ██║ ',
                '    ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║██╗██║     ██║ ',
                '    ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝╚═╝     ╚═╝ ',
                '                                                                         ',
                '             ALL GLOBAL SYSTEMS NOMINAL // MIDNIGHT RESOLVED             ',
                `             COUNTDOWN FROZEN AT : [ ${this.timer.getFormatted()} ]                    `,
                `             TOTAL TIME ELAPSED  : [ ${this.timer.getElapsedFormatted()} ]                    `,
                `             HINTS REVEALED      : [ ${String(this.hintsUsedCount).padStart(2, '0')} ]                                  `,
                '========================================================================='
              ];

              millenniumBanner.forEach((line) => {
                if (line.includes('██')) {
                  this.printLine(line, 'ascii-art');
                } else if (line.includes('NOMINAL') || line.includes('COUNTDOWN') || line.includes('TOTAL TIME') || line.includes('HINTS REVEALED')) {
                  this.printLine(line, 'system-highlight');
                } else {
                  this.printLine(line, 'system-info');
                }
              });

              // Play celebratory fanfare
              this.audio.playVictory();

              // Restore footer controls so user can explore or reboot
              const abortContainer = document.getElementById('abort-button-container');
              if (abortContainer) {
                abortContainer.style.display = 'none';
              }
              const cmdWrapper = document.querySelector('.command-line-wrapper');
              if (cmdWrapper) {
                cmdWrapper.style.display = 'flex';
              }
              this.state = GameState.VICTORY;
              this.setPrompt('STANDDOWN:\\> ');
              this.isLocked = false;
              this.focusInput();
            });
          }, 800);
        }
      }, 260);
    }

    // --- State 6: VICTORY ---
    transitionToVictory() {
      this.state = GameState.VICTORY;
      this.updateStateBadge('VICTORY');
      this.updateSystemStatus('[Y2K THREAT NEUTRALIZED]');
      this.setPrompt('COMPLETED:\\> ');
      this.clearScreen();

      // Pause/freeze countdown timer upon victory
      this.timer.pause();
      const timeRemaining = this.timer.getFormatted();
      const timeTaken = this.timer.getElapsedFormatted();

      // Play triumphant retro victory fanfare
      this.audio.playVictory();

      const victoryBanner = [
        '=========================================================================',
        '      * * * PROJECT ATLAS: MISSION ACCOMPLISHED * * *                    ',
        '                                                                         ',
        '      ██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗            ',
        '      ██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝            ',
        '      ██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝             ',
        '      ╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝              ',
        '       ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║               ',
        '        ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝               ',
        '                                                                         ',
        '=========================================================================',
        `[>>>] MILLENNIUM BUG NEUTRALIZED BEFORE MIDNIGHT ROLLOVER.              `,
        `[>>>] GLOBAL POWER GRIDS, FINANCIAL SYSTEMS & RADAR ARRAYS SAVED.        `,
        `[>>>] REMAINING TIME ON CLOCK : [ ${timeRemaining} ]                               `,
        `[>>>] TIME TAKEN TO DECRYPT   : [ ${timeTaken} ]                               `,
        `[>>>] SYSTEM DATE TRANSITION  : 2000-01-01 00:00:01 NOMINAL.             `,
        '=========================================================================',
        'You have successfully escaped the Y2K crisis!                            ',
        'Commands available: "reboot", "status", "matrix", "color", "about"       ',
        '========================================================================='
      ];

      victoryBanner.forEach((lineText, idx) => {
        if (lineText.includes('██')) {
          this.printLine(lineText, 'ascii-art');
        } else if (lineText.includes('MISSION ACCOMPLISHED') || lineText.includes('REMAINING TIME')) {
          this.printLine(lineText, 'system-highlight');
        } else if (lineText.includes('NEUTRALIZED') || lineText.includes('SAVED')) {
          this.printLine(lineText, 'system-success');
        } else {
          this.printLine(lineText, 'system-info');
        }
      });

      this.isLocked = false;
      this.focusInput();
    }

    // --- Command Processing & State Dispatcher ---
    submitCommand(rawCmd) {
      const cmdTrimmed = rawCmd.trim();
      this.audio.playEnter();

      // Print prompt and typed command
      this.printLine(`${this.commandPrompt}${rawCmd}`, 'command-entry');

      if (!cmdTrimmed) {
        return;
      }

      this.history.push(rawCmd);
      this.historyIndex = -1;

      const parts = cmdTrimmed.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      // 1. Check for universal system commands
      if (this.isUniversalCommand(command)) {
        this.executeUniversalCommand(command, args, cmdTrimmed);
        return;
      }

      // 2. Dispatch to current puzzle state validator
      switch (this.state) {
        case GameState.PUZZLE_1:
          this.validatePuzzle1(cmdTrimmed);
          break;

        case GameState.PUZZLE_2:
          this.validatePuzzle2(cmdTrimmed);
          break;

        case GameState.PUZZLE_3:
          this.validatePuzzle3(cmdTrimmed);
          break;

        case GameState.FINAL:
          this.validateFinal(cmdTrimmed);
          break;

        case GameState.VICTORY:
          this.printLine(`System in steady state (2000 AD). Type 'reboot' to run simulation again.`, 'system-info');
          break;

        default:
          this.printLine(`Terminal locked in state: ${this.state}`, 'system-dim');
          break;
      }
    }

    isUniversalCommand(cmd) {
      const universal = [
        'help', 'hint', 'hints', '?', 'status', 'timer', 'matrix', 'scan',
        'color', 'theme', 'audio', 'sound', 'date', 'time',
        'clear', 'cls', 'reboot', 'restart', 'about', 'skip',
        'dir', 'ls', 'cd', 'chdir', 'type', 'cat', 'view', 'read',
        'tree', 'map', 'maze', 'radar', 'pwd'
      ];
      return universal.includes(cmd);
    }

    executeUniversalCommand(cmd, args, raw) {
      switch (cmd) {
        case 'help':
          this.cmdHelp();
          break;

        case 'hint':
        case 'hints':
        case '?':
          this.cmdHint(args);
          break;

        case 'status':
          this.cmdStatus();
          break;

        case 'timer':
          this.cmdTimer(args);
          break;

        case 'matrix':
          this.cmdMatrix();
          break;

        case 'scan':
          this.cmdScan();
          break;

        case 'color':
        case 'theme':
          this.cmdColor(args);
          break;

        case 'audio':
        case 'sound':
          this.cmdAudio();
          break;

        case 'date':
        case 'time':
          this.cmdDate();
          break;

        case 'clear':
        case 'cls':
          this.clearScreen();
          break;

        case 'reboot':
        case 'restart':
          this.cmdReboot();
          break;

        case 'about':
          this.cmdAbout();
          break;

        case 'skip':
          this.cmdSkip();
          break;

        case 'dir':
        case 'ls':
          if (this.state === GameState.PUZZLE_3) {
            this.cmdDir(args.join(' '));
          } else {
            this.printLine('[!] STORAGE ACCESS LOCKED: Mainframe directory is encrypted until server restoration (Stage 3).', 'system-dim');
          }
          break;

        case 'cd':
        case 'chdir':
          if (this.state === GameState.PUZZLE_3) {
            this.cmdCd(args.join(' '));
          } else {
            this.printLine('[!] STORAGE ACCESS LOCKED: Path navigation unavailable in current state.', 'system-dim');
          }
          break;

        case 'type':
        case 'cat':
        case 'view':
        case 'read':
          if (this.state === GameState.PUZZLE_3) {
            this.cmdType(args.join(' '));
          } else {
            this.printLine('[!] STORAGE ACCESS LOCKED: File viewing unavailable in current state.', 'system-dim');
          }
          break;

        case 'tree':
          if (this.state === GameState.PUZZLE_3) {
            this.cmdTree();
          } else {
            this.printLine('[!] STORAGE ACCESS LOCKED: Directory tree encrypted until Stage 3.', 'system-dim');
          }
          break;

        case 'map':
        case 'maze':
        case 'radar':
          if (this.state === GameState.PUZZLE_3) {
            this.cmdSectorMap();
          } else {
            this.printLine('[!] MEMORY RADAR OFFLINE: Requires server telemetry synchronization.', 'system-dim');
          }
          break;

        case 'pwd':
          if (this.state === GameState.PUZZLE_3) {
            this.printLine(`CURRENT DIRECTORY: ${this.getCurrentPathString()}`, 'system-info');
          } else {
            this.printLine('C:\\', 'system-info');
          }
          break;
      }
    }

    cmdHelp() {
      this.printLine('=============================================================', 'system-dim');
      this.printLine(`  PROJECT ATLAS TERMINAL // STATE: [${this.state}]`, 'system-highlight');
      this.printLine('=============================================================', 'system-dim');
      this.printLine('  HINT [topic]   : Open interactive tiered hint menu ("Would you like help with?")', 'system-info');
      this.printLine('  STATUS         : View system diagnostics and mission timeline', 'system-info');
      this.printLine('  SCAN           : Run port and hardware telemetry scanner', 'system-info');
      this.printLine('  MATRIX         : Toggle falling digital phosphor rain background', 'system-info');
      this.printLine('  COLOR <tint>   : Switch phosphor color: green | amber | cyan | white', 'system-info');
      this.printLine('  AUDIO          : Toggle synthesized mechanical sound effects', 'system-info');
      this.printLine('  TIMER <cmd>    : Inspect or manage the 15:00 countdown timer', 'system-info');
      this.printLine('  CLEAR          : Clear the log screen (Ctrl+L)', 'system-info');
      this.printLine('  REBOOT         : Restart simulation from INTRO state', 'system-info');
      this.printLine('  SKIP           : Developer bypass for current stage', 'system-info');

      if (this.state === GameState.PUZZLE_3) {
        this.printLine('-------------------------------------------------------------', 'system-dim');
        this.printLine('  STAGE 3 DIRECTORY MAZE COMMANDS:', 'system-highlight');
        this.printLine('  DIR [folder]   : List files and subfolders in directory', 'system-info');
        this.printLine('  CD <folder>    : Change directory (e.g. "CD RESTRICTED", "CD ..", "CD \\")', 'system-info');
        this.printLine('  TYPE <file>    : View text file content (e.g. "TYPE SAFE_KEY.TXT")', 'system-info');
        this.printLine('  TREE           : Display complete directory tree hierarchy', 'system-info');
        this.printLine('  MAP / MAZE     : Display memory sector radar visualization', 'system-info');
        this.printLine('  PWD            : Print current working directory path', 'system-info');
      }

      this.printLine('=============================================================', 'system-dim');
      this.printLine('To submit a password or answer, simply type it and press Enter.', 'system-dim');
    }

    cmdHint(args = []) {
      const query = Array.isArray(args) ? args.join(' ') : '';
      this.openHintModal(query);
    }

    cmdStatus() {
      this.printLine('--- PROJECT ATLAS MISSION TELEMETRY ---', 'system-highlight');
      this.printLine(`CURRENT STATE  : ${this.state}`, 'system-success');
      this.printLine(`COUNTDOWN      : [${this.timer.getFormatted()}] REMAINING UNTIL MIDNIGHT`, 'system-highlight');
      this.printLine(`ELAPSED TIME   : [${this.timer.getElapsedFormatted()}]`, 'system-info');
      this.printLine(`RTC CLOCK      : 1999-12-31 23:45:00 UTC`, 'system-info');
      this.printLine(`CENTURY GUARD  : ACTIVE`, 'system-info');
    }

    cmdSkip() {
      this.printLine('[!] DEVELOPER OVERRIDE TRIGGERED: SKIPPING STAGE...', 'system-highlight');
      this.audio.playSuccess();
      switch (this.state) {
        case GameState.INTRO:
          if (this.activeTypewriter) this.activeTypewriter.fastForward();
          this.transitionToPuzzle1();
          break;
        case GameState.PUZZLE_1:
          this.transitionToPuzzle2();
          break;
        case GameState.PUZZLE_2:
          this.transitionToPuzzle3();
          break;
        case GameState.PUZZLE_3:
          this.validatePuzzle3('ATLAS-2000');
          break;
        default:
          this.printLine('Already at final state.', 'system-dim');
          break;
      }
    }

    cmdTimer(args) {
      const sub = args[0] ? args[0].toLowerCase() : 'status';

      if (sub === 'status') {
        this.printLine(`TIMER STATUS: ${this.timer.isRunning ? 'RUNNING' : 'PAUSED'} [${this.timer.getFormatted()}]`, 'system-highlight');
      } else if (sub === 'pause' || sub === 'stop') {
        this.timer.pause();
        this.printLine(`COUNTDOWN TIMER PAUSED AT [${this.timer.getFormatted()}].`, 'system-highlight');
      } else if (sub === 'start' || sub === 'resume') {
        this.timer.start();
        this.printLine(`COUNTDOWN TIMER RESUMED AT [${this.timer.getFormatted()}].`, 'system-success');
      } else if (sub === 'reset') {
        const mins = parseInt(args[1], 10) || 15;
        this.timer.reset(mins, 0);
        this.printLine(`COUNTDOWN TIMER RESET TO [${this.timer.getFormatted()}] AND STARTED.`, 'system-success');
      } else {
        this.printLine(`USAGE: timer status | timer pause | timer start | timer reset [min]`, 'system-dim');
      }
    }

    cmdMatrix() {
      const active = this.matrix.toggle();
      if (active) {
        this.printLine('[*] PHOSPHOR MATRIX STREAM ACTIVATED. (Type "matrix" again to disable)', 'system-success');
      } else {
        this.printLine('[*] PHOSPHOR MATRIX STREAM DEACTIVATED.', 'system-dim');
      }
    }

    cmdScan() {
      this.isLocked = true;
      this.printLine('>>> SCANNING LOCAL NETWORK PORTS...', 'system-highlight');

      const ports = [
        'PORT 21   [FTP]      : FILE TRANSFER PROTOCOL ... OPEN',
        'PORT 22   [SSH]      : SECURE REMOTE SHELL ...... ACTIVE',
        'PORT 23   [TELNET]   : UNENCRYPTED DAEMON ....... BLOCKED',
        'PORT 25   [SMTP]     : SENDMAIL RELAY ........... OPEN',
        'PORT 53   [DNS]      : DOMAIN NAME SERVICE ...... ONLINE',
        'PORT 80   [HTTP]     : WEB DAEMON ............... ACTIVE'
      ];

      let i = 0;
      const timer = setInterval(() => {
        if (i < ports.length) {
          this.printLine(`  ${ports[i]}`, 'system-info');
          this.audio.playKey();
          i++;
        } else {
          clearInterval(timer);
          this.printLine('>>> SCAN COMPLETE. PORT 22 VERIFIED FOR SECURE SATELLITE LINK.', 'system-success');
          this.isLocked = false;
          this.focusInput();
        }
      }, 180);
    }

    cmdColor(args) {
      const color = args[0] ? args[0].toLowerCase() : '';
      const valid = ['green', 'amber', 'cyan', 'white'];

      if (!valid.includes(color)) {
        this.printLine(`USAGE: color <green | amber | cyan | white>`, 'system-dim');
        return;
      }

      document.body.classList.remove('theme-amber', 'theme-cyan', 'theme-white');
      if (color !== 'green') {
        document.body.classList.add(`theme-${color}`);
      }

      this.printLine(`CRT PHOSPHOR SPECTRUM CONFIGURED TO: [${color.toUpperCase()}]`, 'system-success');
      this.audio.playBeep(900, 0.1);
    }

    cmdAudio() {
      const active = this.audio.toggle();
      if (this.audioStatusPill) {
        if (active) {
          this.audioStatusPill.classList.add('active');
          this.audioStatusPill.textContent = 'SND: ON';
        } else {
          this.audioStatusPill.classList.remove('active');
          this.audioStatusPill.textContent = 'SND: OFF';
        }
      }
      this.printLine(`SYNTHESIZED AUDIO SOUND FX: ${active ? 'ENABLED' : 'MUTED'}`, active ? 'system-success' : 'system-dim');
    }

    cmdDate() {
      this.printLine(`CURRENT SYSTEM DATE : Fri Dec 31 1999 23:45:00 UTC`, 'system-highlight');
      this.printLine(`COUNTDOWN TIMER     : [${this.timer.getFormatted()}] REMAINING UNTIL MIDNIGHT`, 'system-info');
    }

    cmdReboot() {
      this.clearScreen();
      this.startIntro();
    }

    cmdAbout() {
      this.printLine('=====================================================', 'system-dim');
      this.printLine('       PROJECT ATLAS // Y2K CRT TERMINAL SIMULATOR   ', 'system-highlight');
      this.printLine('=====================================================', 'system-dim');
      this.printLine('State Machine: INTRO -> PUZZLE_1 -> PUZZLE_2 -> PUZZLE_3 -> FINAL -> VICTORY', 'system-info');
      this.printLine('15:00 Digital Countdown Timer with Y2K Rollover Engine', 'system-info');
      this.printLine('Dr. Elena Ferland Transmission Typewriter Driver', 'system-info');
      this.printLine('Web Audio API 8-Bit Synthesizer Sound Core', 'system-info');
      this.printLine('=====================================================', 'system-dim');
    }

    handleTimerExpiry() {
      this.audio.playError();
      this.printLine('', 'system-info');
      this.printLine('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', 'system-error');
      this.printLine(' [!] CRITICAL ALERT: COUNTDOWN REACHED 00:00 - MIDNIGHT HIT', 'system-error');
      this.printLine(' [!] Y2K CASCADE FAILURE DETECTED ACROSS ALL TELEMETRY NODES', 'system-error');
      this.printLine(' [!] TYPE "REBOOT" TO RETRY THE EMERGENCY SEQUENCE.', 'system-highlight');
      this.printLine('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', 'system-error');
      this.printLine('', 'system-info');
    }
  }

  // Launch on DOM ready
  window.addEventListener('DOMContentLoaded', () => {
    window.terminalApp = new CRTTerminal();
  });
})();
