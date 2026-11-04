/**
 * Super Mario Motion - Smart TV Motion Game Engine
 * Retro NES Platformer with Full Body Motion & Handheld IMU Controls
 * 
 * Powered by:
 * - HTML5 Canvas 2D Crisp Pixel Renderer (NES 256x240 internal palette)
 * - Procedural 8-Bit Web Audio Synthesizer (Overworld BGM + Authentic SFX)
 * - WebSocket Motion Capture Relay (Optical Pose & IMU Accelerometer)
 */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIZER (No External Assets Required) ---
  class MarioAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.bgmPlaying = false;
      this.bgmTimeout = null;
      this.currentNoteIndex = 0;
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

    playTone(freq, type, duration, gain = 0.15, slideTo = null) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo !== null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), this.ctx.currentTime + duration);
        }
        gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playJump(isSuper = false) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        const start = isSuper ? 180 : 150;
        const end = isSuper ? 660 : 540;
        osc.frequency.setValueAtTime(start, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(end, this.ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } catch (e) {}
    }

    playCoin() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(987.77, now); // B5
        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain2.gain.setValueAtTime(0.25, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.35);
      } catch (e) {}
    }

    playStomp() {
      this.playTone(180, 'triangle', 0.1, 0.3, 60);
    }

    playBump() {
      this.playTone(110, 'triangle', 0.09, 0.25, 45);
    }

    playPowerup() {
      const notes = [330, 392, 659, 523, 587, 784];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'square', 0.1, 0.18);
        }, idx * 70);
      });
    }

    playFireball() {
      this.playTone(880, 'triangle', 0.12, 0.2, 220);
    }

    playDie() {
      this.stopBGM();
      const notes = [500, 480, 450, 420, 380, 300, 200];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'square', 0.14, 0.25);
        }, idx * 110);
      });
    }

    playStageClear() {
      this.stopBGM();
      const fanfare = [
        { f: 392, d: 0.12 }, { f: 523, d: 0.12 }, { f: 659, d: 0.12 },
        { f: 784, d: 0.12 }, { f: 1046, d: 0.25 }, { f: 784, d: 0.25 }
      ];
      fanfare.forEach((n, idx) => {
        setTimeout(() => {
          this.playTone(n.f, 'square', n.d, 0.22);
        }, idx * 130);
      });
    }

    // Authentic NES Super Mario Overworld Melody Loop
    startBGM() {
      if (this.bgmPlaying || this.muted) return;
      this.init();
      this.bgmPlaying = true;
      this.currentNoteIndex = 0;
      this.loopBGM();
    }

    stopBGM() {
      this.bgmPlaying = false;
      if (this.bgmTimeout) {
        clearTimeout(this.bgmTimeout);
        this.bgmTimeout = null;
      }
    }

    loopBGM() {
      if (!this.bgmPlaying || this.muted || !this.ctx) return;

      // Classic Mario theme notes (frequency in Hz and duration in 16th steps)
      const E5 = 659.25, C5 = 523.25, G5 = 783.99, G4 = 392.00, A4 = 440.00, B4 = 493.88, AS4 = 466.16, F5 = 698.46, D5 = 587.33;
      const melody = [
        { f: E5, d: 0.12 }, { f: E5, d: 0.12 }, { f: 0, d: 0.12 }, { f: E5, d: 0.12 },
        { f: 0, d: 0.12 }, { f: C5, d: 0.12 }, { f: E5, d: 0.12 }, { f: 0, d: 0.12 },
        { f: G5, d: 0.24 }, { f: 0, d: 0.24 }, { f: G4, d: 0.24 }, { f: 0, d: 0.24 },

        { f: C5, d: 0.18 }, { f: 0, d: 0.12 }, { f: G4, d: 0.18 }, { f: 0, d: 0.12 },
        { f: E4, d: 0.18 }, { f: 0, d: 0.12 }, { f: A4, d: 0.14 }, { f: B4, d: 0.14 },
        { f: AS4, d: 0.12 }, { f: A4, d: 0.14 }, { f: G4, d: 0.14 }, { f: E5, d: 0.14 },
        { f: G5, d: 0.14 }, { f: A5, d: 0.2 }, { f: F5, d: 0.12 }, { f: G5, d: 0.14 },
        { f: 0, d: 0.1 }, { f: E5, d: 0.14 }, { f: C5, d: 0.12 }, { f: D5, d: 0.12 },
        { f: B4, d: 0.2 }
      ];

      const note = melody[this.currentNoteIndex % melody.length];
      if (note.f > 0) {
        this.playTone(note.f, 'square', note.d * 0.9, 0.08);
      }
      this.currentNoteIndex++;
      const delayMs = note.d * 1000;
      this.bgmTimeout = setTimeout(() => this.loopBGM(), delayMs);
    }
  }

  const audio = new MarioAudio();

  // --- GAME CONFIG & CONSTANTS ---
  const V_WIDTH = 512;
  const V_HEIGHT = 288;
  const GRAVITY = 0.58;
  const JUMP_FORCE = -11.8;
  const MOVE_SPEED = 3.6;
  const FRICTION = 0.82;
  const TILE_SIZE = 16;

  // Level Definition for World 1-1
  const LEVEL_WIDTH = 3400;
  const GROUND_Y = V_HEIGHT - TILE_SIZE * 2;

  // --- ENTITIES & SYSTEM STATE ---
  let canvas, ctx;
  let score = 0;
  let coins = 0;
  let lives = 3;
  let timeLeft = 400;
  let timeTicker = 0;
  let defeatedCount = 0;
  let gameRunning = false;
  let gameWon = false;
  let gameOver = false;
  let lastTime = performance.now();
  let cameraX = 0;

  // Keys & TV Remote State
  const keys = {
    left: false,
    right: false,
    jump: false,
    duck: false,
    fire: false
  };

  // Motion Sensor State
  const motionInput = {
    bodyX: 0.5,
    bodyY: 0.5,
    isJumping: false,
    isDucking: false,
    isPunching: false,
    tiltGamma: 0,
    linearAccel: 0,
    lastJumpTime: 0,
    lastFireTime: 0
  };

  // Mario Object
  const mario = {
    x: 40,
    y: GROUND_Y - 24,
    vx: 0,
    vy: 0,
    w: 14,
    h: 16,
    state: 'small', // 'small', 'super', 'fire'
    facing: 'right',
    grounded: false,
    ducking: false,
    invulnerable: 0,
    dead: false,
    dyingVy: 0,
    animFrame: 0,
    animTimer: 0,

    reset(keepState = false) {
      this.x = Math.max(40, cameraX - 20);
      this.y = GROUND_Y - (this.h);
      this.vx = 0;
      this.vy = 0;
      this.grounded = true;
      this.ducking = false;
      this.dead = false;
      this.dyingVy = 0;
      this.invulnerable = 90;
      timeLeft = 400;
      const timeVal = document.getElementById('time-val');
      if (timeVal) timeVal.textContent = '400';
      if (!keepState) {
        this.state = 'small';
        this.h = 16;
      }
    },

    grow() {
      if (this.state === 'small') {
        this.state = 'super';
        this.y -= 16;
        this.h = 28;
      } else if (this.state === 'super') {
        this.state = 'fire';
      }
      audio.playPowerup();
      addFloatingText(this.x, this.y - 10, 'POWER UP!', '#00ff88');
    },

    shrink() {
      if (this.invulnerable > 0) return;
      if (this.state === 'fire') {
        this.state = 'super';
        this.invulnerable = 120;
        audio.playBump();
      } else if (this.state === 'super') {
        this.state = 'small';
        this.h = 16;
        this.invulnerable = 120;
        audio.playBump();
      } else {
        this.die();
      }
    },

    die() {
      if (this.dead) return;
      this.dead = true;
      this.dyingVy = -11;
      lives--;
      updateHUD();
      audio.playDie();
      setTimeout(() => {
        if (lives <= 0) {
          triggerGameOver();
        } else {
          mario.reset();
        }
      }, 2600);
    }
  };

  // World Elements
  let blocks = [];
  let enemies = [];
  let fireballs = [];
  let floatingTexts = [];
  let particles = [];
  let flagPole = { x: 3000, y: GROUND_Y - 160, flagY: GROUND_Y - 150, reached: false };
  let castle = { x: 3100, y: GROUND_Y - 80 };

  // Generate World 1-1
  function buildLevel() {
    blocks = [];
    enemies = [];
    fireballs = [];
    floatingTexts = [];
    particles = [];
    cameraX = 0;

    // Ground & Gaps
    for (let x = 0; x < LEVEL_WIDTH; x += TILE_SIZE) {
      // Pit 1: x between 1100 and 1150
      if (x >= 1120 && x <= 1180) continue;
      // Pit 2: x between 1900 and 1980
      if (x >= 1920 && x <= 2000) continue;

      blocks.push({
        x: x,
        y: GROUND_Y,
        w: TILE_SIZE,
        h: TILE_SIZE * 2,
        type: 'ground'
      });
    }

    // Mystery [?] and Brick Blocks Setup
    function addBlock(tileX, tileY, type, content = null) {
      blocks.push({
        x: tileX * TILE_SIZE,
        y: GROUND_Y - tileY * TILE_SIZE,
        w: TILE_SIZE,
        h: TILE_SIZE,
        type: type, // 'mystery', 'brick', 'used'
        content: content, // 'coin', 'mushroom', 'fireflower'
        bumpY: 0,
        bumpTimer: 0
      });
    }

    // First Mystery block: tileX 16
    addBlock(16, 4, 'mystery', 'coin');
    // Bricks & mystery row: tileX 20..24
    addBlock(20, 4, 'brick');
    addBlock(21, 4, 'mystery', 'mushroom');
    addBlock(22, 4, 'brick');
    addBlock(23, 4, 'mystery', 'coin');
    addBlock(24, 4, 'brick');
    addBlock(22, 8, 'mystery', 'coin'); // High mystery block

    // Pipes: function to add iconic green warp pipes
    function addPipe(tileX, heightTiles) {
      const px = tileX * TILE_SIZE;
      const py = GROUND_Y - heightTiles * TILE_SIZE;
      blocks.push({
        x: px,
        y: py,
        w: TILE_SIZE * 2,
        h: heightTiles * TILE_SIZE,
        type: 'pipe'
      });
    }

    addPipe(28, 2);
    addPipe(38, 3);
    addPipe(46, 4);
    addPipe(58, 4);

    // Mid-level platforms
    for (let i = 0; i < 6; i++) {
      addBlock(64 + i, 4, i === 2 ? 'mystery' : 'brick', i === 2 ? 'fireflower' : null);
    }
    for (let i = 0; i < 4; i++) {
      addBlock(80 + i, 8, 'brick');
    }
    addBlock(84, 8, 'mystery', 'coin');
    addBlock(85, 8, 'mystery', 'coin');

    // Staircase before pits & castle
    for (let step = 1; step <= 5; step++) {
      for (let h = 1; h <= step; h++) {
        addBlock(100 + step, h, 'stair');
      }
    }
    for (let step = 1; step <= 5; step++) {
      for (let h = 1; h <= (6 - step); h++) {
        addBlock(115 + step, h, 'stair');
      }
    }

    // High Flagpole Staircase
    for (let step = 1; step <= 8; step++) {
      for (let h = 1; h <= step; h++) {
        addBlock(165 + step, h, 'stair');
      }
    }

    // Enemies (Goombas & Koopas)
    function addGoomba(gx) {
      enemies.push({
        x: gx,
        y: GROUND_Y - 16,
        w: 16,
        h: 16,
        vx: -0.85,
        type: 'goomba',
        squashed: false,
        squashTimer: 0,
        dead: false
      });
    }

    function addKoopa(kx) {
      enemies.push({
        x: kx,
        y: GROUND_Y - 24,
        w: 16,
        h: 24,
        vx: -0.75,
        type: 'koopa',
        shell: false,
        kicked: false,
        dead: false
      });
    }

    addGoomba(360);
    addGoomba(620);
    addGoomba(660);
    addKoopa(820);
    addGoomba(980);
    addGoomba(1020);
    addGoomba(1320);
    addKoopa(1450);
    addGoomba(1720);
    addGoomba(1760);
    addKoopa(2200);
    addGoomba(2400);

    // Flagpole and Castle
    flagPole.x = 2850;
    flagPole.y = GROUND_Y - 144;
    flagPole.flagY = flagPole.y + 10;
    flagPole.reached = false;

    castle.x = 2960;
    castle.y = GROUND_Y - 80;
  }

  function addFloatingText(x, y, text, color = '#ffffff') {
    floatingTexts.push({ x, y, text, color, life: 40, vy: -1.2 });
  }

  function spawnDebris(x, y) {
    const velocities = [
      { vx: -2.2, vy: -5 },
      { vx: 2.2, vy: -5 },
      { vx: -1.5, vy: -3 },
      { vx: 1.5, vy: -3 }
    ];
    velocities.forEach(v => {
      particles.push({
        x: x + 8,
        y: y + 8,
        vx: v.vx,
        vy: v.vy,
        size: 5,
        color: '#b84418',
        life: 30
      });
    });
  }

  // --- WEBSOCKET CLIENT & MOTION PARSING ---
  let ws = null;
  const urlParams = new URLSearchParams(window.location.search);
  const ROOM_ID = urlParams.get('room') || localStorage.getItem('mario_room_id') || 'TV-' + Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem('mario_room_id', ROOM_ID);

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}`;
    
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const badge = document.getElementById('motion-badge');
        const bulb = document.getElementById('mario-bulb');
        const text = document.getElementById('motion-mode-text');
        if (bulb) {
          bulb.className = 'pulse-dot connected';
        }
        if (text) text.textContent = 'ONLINE - ROOM: ' + ROOM_ID;

        // Register as TV
        ws.send(JSON.stringify({
          type: 'register',
          role: 'tv',
          roomId: ROOM_ID
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleSocketMessage(msg);
        } catch (e) {}
      };

      ws.onclose = () => {
        const bulb = document.getElementById('mario-bulb');
        const text = document.getElementById('motion-mode-text');
        if (bulb) bulb.className = 'pulse-dot disconnected';
        if (text) text.textContent = 'DISCONNECTED - RETRYING';
        setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    } catch (e) {
      setTimeout(connectWebSocket, 3000);
    }
  }

  function handleSocketMessage(msg) {
    if (!msg) return;

    // Pairing status
    if (msg.type === 'peer_status') {
      const bulb = document.getElementById('mario-bulb');
      const text = document.getElementById('motion-mode-text');
      if (msg.phoneConnected) {
        if (bulb) bulb.className = 'pulse-dot connected';
        if (text) text.textContent = 'PHONE LINKED ⚡ BODY TRACKING READY';
        // Auto-dismiss lobby on phone connection if waiting!
        const lobby = document.getElementById('mario-lobby');
        if (lobby && lobby.classList.contains('active')) {
          startGame();
        }
      } else {
        if (bulb) bulb.className = 'pulse-dot disconnected';
        if (text) text.textContent = 'PHONE DISCONNECTED';
      }
      return;
    }

    // Auto-wake/restart from lobby or game over modal on any input
    const lobby = document.getElementById('mario-lobby');
    const endModal = document.getElementById('mario-end-modal');
    if ((lobby && lobby.classList.contains('active')) || (endModal && endModal.classList.contains('active'))) {
      if (msg.type === 'start_game' || msg.type === 'pose' || msg.type === 'motion' || msg.type === 'key_press' || msg.type === 'swing' || msg.type === 'punch') {
        if (gameOver || lives <= 0 || mario.dead) {
          restartGame();
        } else {
          startGame();
        }
      }
    }

    if (msg.type === 'start_game') {
      if (gameOver || lives <= 0) restartGame();
      else startGame();
      return;
    }

    // Direct Key Press Relay (from Phone Touch Gamepad or Remote)
    if (msg.type === 'key_press') {
      if (msg.key === 'left') keys.left = true;
      if (msg.key === 'right') keys.right = true;
      if (msg.key === 'jump') {
        highlightActionTag('tag-jump');
        triggerMarioJump();
      }
      if (msg.key === 'duck') keys.duck = true;
      if (msg.key === 'fire') {
        highlightActionTag('tag-fire');
        triggerMarioFireball();
      }
      return;
    }

    if (msg.type === 'key_release') {
      if (msg.key === 'left') keys.left = false;
      if (msg.key === 'right') keys.right = false;
      if (msg.key === 'duck') keys.duck = false;
      return;
    }

    // Optical Pose Track (From Phone Camera via MediaPipe / Optical Flow)
    if (msg.type === 'pose') {
      if (typeof msg.bodyX === 'number') {
        motionInput.bodyX = msg.bodyX;
      } else if (msg.lane === 'left') {
        motionInput.bodyX = 0.20;
      } else if (msg.lane === 'right') {
        motionInput.bodyX = 0.80;
      } else if (msg.lane === 'center') {
        motionInput.bodyX = 0.50;
      }
      if (typeof msg.bodyY === 'number') {
        motionInput.bodyY = msg.bodyY;
      }

      // Check Jump: physical jump, arm raise, or isSwinging
      const now = performance.now();
      if ((msg.jump || msg.isSwinging) && (now - motionInput.lastJumpTime > 300)) {
        motionInput.isJumping = true;
        motionInput.lastJumpTime = now;
        highlightActionTag('tag-jump');
        triggerMarioJump();
      }

      // Check Duck: crouching down
      if (msg.isDucking || msg.bodyY > 0.68) {
        motionInput.isDucking = true;
        highlightActionTag('tag-duck');
      } else {
        motionInput.isDucking = false;
      }

      // Check Punch: fireball attack or sprint
      if (msg.isPunching && (now - motionInput.lastFireTime > 250)) {
        motionInput.isPunching = true;
        motionInput.lastFireTime = now;
        highlightActionTag('tag-fire');
        triggerMarioFireball();
      }

      updateMotionTrackerUI();
      return;
    }

    // Handheld Motion Mode (IMU Tilt & Accelerometer)
    if (msg.type === 'motion' || msg.type === 'tilt') {
      const now = performance.now();
      if (typeof msg.gamma === 'number') {
        motionInput.tiltGamma = msg.gamma;
      }
      if (typeof msg.tiltX === 'number') {
        motionInput.tiltGamma = msg.tiltX * 25;
      }

      // Swing / upward acceleration triggers Jump
      const isStrongAccel = (msg.linearAccel && msg.linearAccel > 7.0) || (msg.totalMag && msg.totalMag > 1.4);
      if ((msg.isSwinging || msg.jump || isStrongAccel) && (now - motionInput.lastJumpTime > 300)) {
        motionInput.isJumping = true;
        motionInput.lastJumpTime = now;
        highlightActionTag('tag-jump');
        triggerMarioJump();
      }

      // Shake or punch triggers Fireball
      if (msg.isPunching && (now - motionInput.lastFireTime > 250)) {
        motionInput.isPunching = true;
        motionInput.lastFireTime = now;
        highlightActionTag('tag-fire');
        triggerMarioFireball();
      }

      updateMotionTrackerUI();
      return;
    }

    if (msg.type === 'punch') {
      highlightActionTag('tag-fire');
      triggerMarioFireball();
    }

    if (msg.type === 'swing') {
      highlightActionTag('tag-jump');
      triggerMarioJump();
    }
  }

  function highlightActionTag(tagId) {
    const el = document.getElementById(tagId);
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => {
      el.classList.remove('active');
    }, 250);
  }

  function updateMotionTrackerUI() {
    const fillLeft = document.getElementById('fill-left');
    const fillRight = document.getElementById('fill-right');
    const centerMarker = document.getElementById('center-marker');

    let x = motionInput.bodyX;
    // Or if tilt mode is dominating
    if (Math.abs(motionInput.tiltGamma) > 5) {
      x = 0.5 + (motionInput.tiltGamma / 60);
      x = Math.max(0, Math.min(1, x));
    }

    const center = 0.5;
    const offset = x - center;

    if (centerMarker) {
      centerMarker.style.transform = `translateX(${offset * 120}px)`;
    }

    if (offset < -0.06) {
      const pct = Math.min(100, Math.abs(offset) * 220);
      if (fillLeft) fillLeft.style.width = pct + '%';
      if (fillRight) fillRight.style.width = '0%';
    } else if (offset > 0.06) {
      const pct = Math.min(100, Math.abs(offset) * 220);
      if (fillRight) fillRight.style.width = pct + '%';
      if (fillLeft) fillLeft.style.width = '0%';
    } else {
      if (fillLeft) fillLeft.style.width = '0%';
      if (fillRight) fillRight.style.width = '0%';
    }
  }

  // --- CONTROLS ACTIONS ---
  function triggerMarioJump() {
    if (!gameRunning || mario.dead) return;
    if (mario.grounded) {
      mario.vy = JUMP_FORCE;
      mario.grounded = false;
      // Preserve & carry directional jump momentum forward
      if (Math.abs(mario.vx) > 0.4) {
        mario.vx = (mario.facing === 'right' ? 1 : -1) * MOVE_SPEED * 1.05;
      }
      audio.playJump(mario.state !== 'small');
    }
  }

  function triggerMarioFireball() {
    if (!gameRunning || mario.dead) return;
    if (mario.state === 'fire' && fireballs.length < 2) {
      const dir = mario.facing === 'left' ? -1 : 1;
      fireballs.push({
        x: mario.x + (dir === 1 ? mario.w + 2 : -6),
        y: mario.y + 8,
        vx: dir * 5.5,
        vy: 2.0,
        bounces: 0,
        dead: false
      });
      audio.playFireball();
    } else if (mario.grounded) {
      // Small/Super Mario sprinting boost forward
      const dir = mario.facing === 'left' ? -1 : 1;
      mario.vx = dir * (MOVE_SPEED * 1.35);
    }
  }

  // --- KEYBOARD & TV REMOTE LISTENER ---
  window.addEventListener('keydown', (e) => {
    // TV Remote DPAD & standard keys
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = true;
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.code === 'Space') {
      keys.jump = true;
      triggerMarioJump();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      keys.duck = true;
    } else if (e.key === 'x' || e.key === 'X' || e.key === 'z' || e.key === 'Z' || e.key === 'Shift') {
      keys.fire = true;
      triggerMarioFireball();
    } else if (e.key === 'Enter') {
      if (!gameRunning) {
        startGame();
      } else if (gameOver || gameWon) {
        restartGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.code === 'Space') keys.jump = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.duck = false;
    if (e.key === 'x' || e.key === 'X' || e.key === 'z' || e.key === 'Z' || e.key === 'Shift') keys.fire = false;
  });

  // --- HTML5 GAMEPAD SUPPORT (ActionAndLink / Bluetooth Controllers) ---
  let gpPrevJump = false;
  let gpPrevFire = false;

  function pollGamepads() {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      // Left Stick X-axis
      const ax = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
      if (ax < -0.35) keys.left = true;
      else if (ax > 0.35) keys.right = true;

      // D-Pad: Down (13), Left (14), Right (15)
      if (gp.buttons[14] && gp.buttons[14].pressed) keys.left = true;
      if (gp.buttons[15] && gp.buttons[15].pressed) keys.right = true;
      if (gp.buttons[13] && gp.buttons[13].pressed) keys.duck = true;

      // Jump: A (0), B (1), D-Pad Up (12)
      const isJump = (gp.buttons[0] && gp.buttons[0].pressed) || 
                     (gp.buttons[1] && gp.buttons[1].pressed) ||
                     (gp.buttons[12] && gp.buttons[12].pressed);
      if (isJump) {
        if (!gpPrevJump) triggerMarioJump();
        gpPrevJump = true;
      } else {
        gpPrevJump = false;
      }

      // Fireball / Sprint: X (2), Y (3), Triggers (5, 7)
      const isFire = (gp.buttons[2] && gp.buttons[2].pressed) || 
                     (gp.buttons[3] && gp.buttons[3].pressed) ||
                     (gp.buttons[5] && gp.buttons[5].pressed) ||
                     (gp.buttons[7] && gp.buttons[7].pressed);
      if (isFire) {
        if (!gpPrevFire) triggerMarioFireball();
        gpPrevFire = true;
      } else {
        gpPrevFire = false;
      }
    }
  }

  // --- GAMEPLAY LOOP & PHYSICS ---
  function update() {
    if (!gameRunning) return;
    pollGamepads();

    // Time ticker
    timeTicker++;
    if (timeTicker % 60 === 0 && timeLeft > 0 && !mario.dead && !gameWon) {
      timeLeft--;
      const timeVal = document.getElementById('time-val');
      if (timeVal) timeVal.textContent = String(timeLeft).padStart(3, '0');
      if (timeLeft === 0) mario.die();
    }

    // Dying animation
    if (mario.dead) {
      mario.y += mario.dyingVy;
      mario.dyingVy += 0.45;
      return;
    }

    // Winning flag-pole animation
    if (gameWon) {
      if (flagPole.flagY < GROUND_Y - 24) {
        flagPole.flagY += 2;
      }
      if (mario.x < castle.x + 30) {
        mario.x += 1.2;
        mario.animTimer++;
        if (mario.animTimer % 8 === 0) mario.animFrame = (mario.animFrame + 1) % 3;
      } else {
        showStageClearModal();
      }
      return;
    }

    // Invulnerability Blink Counter
    if (mario.invulnerable > 0) mario.invulnerable--;

    // 1. Horizontal Motion Input Integration
    let moveIntent = 0;

    // Keyboard takes direct input
    if (keys.left) moveIntent = -1;
    if (keys.right) moveIntent = 1;

    // Body Motion Camera takes continuous lane steering
    if (moveIntent === 0) {
      const bx = motionInput.bodyX;
      if (bx < 0.45) {
        // Leaning / stepping left
        const strength = Math.min(1.0, (0.45 - bx) / 0.16);
        moveIntent = -strength;
      } else if (bx > 0.55) {
        // Leaning / stepping right
        const strength = Math.min(1.0, (bx - 0.55) / 0.16);
        moveIntent = strength;
      }
    }

    // Handheld Tilt IMU
    if (moveIntent === 0 && Math.abs(motionInput.tiltGamma) > 4) {
      const sign = motionInput.tiltGamma > 0 ? 1 : -1;
      const mag = Math.min(1.0, (Math.abs(motionInput.tiltGamma) - 4) / 16);
      moveIntent = sign * mag;
    }

    // Ducking
    mario.ducking = (keys.duck || motionInput.isDucking) && mario.grounded && mario.state !== 'small';

    // Apply Acceleration & Mid-Air Jump Directional Control
    if (!mario.ducking) {
      if (moveIntent !== 0) {
        // Full steering speed both on the ground and while in the air!
        mario.vx = moveIntent * MOVE_SPEED;
        mario.facing = moveIntent > 0 ? 'right' : 'left';
        if (mario.grounded) {
          mario.animTimer++;
          if (mario.animTimer % 6 === 0) {
            mario.animFrame = (mario.animFrame + 1) % 3;
          }
        }
      } else {
        // Low air friction (0.97) preserves jump arc momentum; ground friction (0.82) stops on ground
        const currentFriction = mario.grounded ? FRICTION : 0.97;
        mario.vx *= currentFriction;
        if (Math.abs(mario.vx) < 0.1) mario.vx = 0;
        if (mario.grounded) mario.animFrame = 0;
      }
    } else {
      mario.vx *= 0.6;
    }

    // Apply Gravity
    mario.vy += GRAVITY;
    if (mario.vy > 9.0) mario.vy = 9.0;

    // Move Horizontally & Collide with Blocks
    mario.x += mario.vx;
    // Don't let Mario scroll past screen left border
    if (mario.x < cameraX) mario.x = cameraX;

    handleHorizontalBlockCollisions();

    // Move Vertically & Collide with Blocks
    mario.grounded = false;
    mario.y += mario.vy;
    handleVerticalBlockCollisions();

    // Pit fall death
    if (mario.y > V_HEIGHT + 30) {
      mario.die();
      return;
    }

    // Update Camera (NES Smooth forward scrolling)
    const targetCamX = mario.x - V_WIDTH * 0.38;
    if (targetCamX > cameraX) {
      cameraX = targetCamX;
    }

    // Flagpole collision check
    if (!flagPole.reached && mario.x >= flagPole.x - 6 && mario.x <= flagPole.x + 12) {
      flagPole.reached = true;
      gameWon = true;
      mario.vx = 0;
      mario.vy = 0;
      score += Math.max(1000, timeLeft * 50);
      updateHUD();
      audio.playStageClear();
      addFloatingText(mario.x, mario.y - 10, 'STAGE CLEAR! +5000', '#ffd700');
    }

    // Update Enemies
    updateEnemies();

    // Update Fireballs
    updateFireballs();

    // Update Particles & Floating Text
    updateParticles();
  }

  // --- COLLISION RESOLUTION ---
  function handleHorizontalBlockCollisions() {
    const mh = mario.ducking ? 16 : mario.h;
    for (const b of blocks) {
      if (mario.x + mario.w > b.x && mario.x < b.x + b.w &&
          mario.y + mh > b.y && mario.y < b.y + b.h) {
        if (mario.vx > 0) {
          mario.x = b.x - mario.w;
          mario.vx = 0;
        } else if (mario.vx < 0) {
          mario.x = b.x + b.w;
          mario.vx = 0;
        }
      }
    }
  }

  function handleVerticalBlockCollisions() {
    const mh = mario.ducking ? 16 : mario.h;
    for (const b of blocks) {
      if (mario.x + mario.w > b.x && mario.x < b.x + b.w &&
          mario.y + mh > b.y && mario.y < b.y + b.h) {
        
        // Falling down onto block top
        if (mario.vy > 0 && (mario.y + mh - mario.vy) <= b.y + 4) {
          mario.y = b.y - mh;
          mario.vy = 0;
          mario.grounded = true;
        }
        // Jumping up into block bottom
        else if (mario.vy < 0) {
          mario.y = b.y + b.h;
          mario.vy = 0;
          bumpBlock(b);
        }
      }
    }
  }

  function bumpBlock(b) {
    if (b.type === 'mystery') {
      b.type = 'used';
      b.bumpY = -6;
      audio.playCoin();
      if (b.content === 'coin') {
        coins++;
        score += 200;
        addFloatingText(b.x, b.y - 14, '+200', '#ffd700');
      } else if (b.content === 'mushroom' || b.content === 'fireflower') {
        mario.grow();
      }
      updateHUD();
    } else if (b.type === 'brick') {
      if (mario.state !== 'small') {
        // Smash brick!
        audio.playStomp();
        spawnDebris(b.x, b.y);
        score += 50;
        updateHUD();
        // Remove block
        const idx = blocks.indexOf(b);
        if (idx !== -1) blocks.splice(idx, 1);
      } else {
        b.bumpY = -4;
        audio.playBump();
      }
    } else {
      audio.playBump();
    }
  }

  // --- ENEMIES SYSTEM ---
  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      // Only activate when in screen view + margin
      if (e.x > cameraX + V_WIDTH + 60 || e.x < cameraX - 100) continue;

      if (e.squashed) {
        e.squashTimer++;
        if (e.squashTimer > 25) enemies.splice(i, 1);
        continue;
      }

      if (e.dead) {
        e.y += 3;
        if (e.y > V_HEIGHT + 20) enemies.splice(i, 1);
        continue;
      }

      // Move enemy
      e.x += e.vx;

      // Enemy block collision (reverse at obstacles or pipe edges)
      for (const b of blocks) {
        if (b.type === 'pipe' || b.type === 'stair') {
          if (e.x + e.w > b.x && e.x < b.x + b.w && e.y + e.h > b.y && e.y < b.y + b.h) {
            e.vx = -e.vx;
            e.x += e.vx;
          }
        }
      }

      // Check collision with Mario
      const mh = mario.ducking ? 16 : mario.h;
      if (mario.x + mario.w > e.x && mario.x < e.x + e.w &&
          mario.y + mh > e.y && mario.y < e.y + e.h) {
        
        // Stomp from above!
        if (mario.vy > 0 && (mario.y + mh - mario.vy) <= e.y + 6) {
          mario.vy = -7.5; // Bounce Mario up
          audio.playStomp();
          score += 100;
          defeatedCount++;
          updateHUD();
          addFloatingText(e.x, e.y - 10, '+100', '#ffd700');

          if (e.type === 'goomba') {
            e.squashed = true;
          } else if (e.type === 'koopa') {
            if (!e.shell) {
              e.shell = true;
              e.vx = 0;
              e.h = 16;
              e.y = GROUND_Y - 16;
            } else if (!e.kicked) {
              e.kicked = true;
              e.vx = (mario.x < e.x) ? 4.5 : -4.5;
            }
          }
        } else {
          // Hurt Mario
          if (e.type === 'koopa' && e.shell && !e.kicked) {
            // Kick the idle shell!
            e.kicked = true;
            e.vx = (mario.x < e.x) ? 5.0 : -5.0;
            audio.playStomp();
          } else {
            mario.shrink();
          }
        }
      }

      // Kicked shell destroys other enemies!
      if (e.type === 'koopa' && e.kicked) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          if (i === j) continue;
          const other = enemies[j];
          if (e.x + e.w > other.x && e.x < other.x + other.w &&
              e.y + e.h > other.y && e.y < other.y + other.h) {
            other.dead = true;
            score += 200;
            defeatedCount++;
            audio.playStomp();
            addFloatingText(other.x, other.y - 10, '+200', '#ffd700');
          }
        }
      }
    }
  }

  // --- FIREBALL SYSTEM ---
  function updateFireballs() {
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const fb = fireballs[i];
      fb.x += fb.vx;
      fb.y += fb.vy;
      fb.vy += GRAVITY * 0.8;

      // Bounce on ground or blocks
      if (fb.y >= GROUND_Y - 8) {
        fb.y = GROUND_Y - 8;
        fb.vy = -4.5;
        fb.bounces++;
      }

      // Check hit enemies
      for (const e of enemies) {
        if (!e.dead && !e.squashed &&
            fb.x > e.x && fb.x < e.x + e.w &&
            fb.y > e.y && fb.y < e.y + e.h) {
          e.dead = true;
          fb.dead = true;
          audio.playStomp();
          score += 200;
          defeatedCount++;
          updateHUD();
          addFloatingText(e.x, e.y - 10, '+200', '#ff5533');
          break;
        }
      }

      if (fb.bounces > 4 || fb.x > cameraX + V_WIDTH || fb.x < cameraX - 20) {
        fb.dead = true;
      }

      if (fb.dead) {
        fireballs.splice(i, 1);
      }
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY * 0.5;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life--;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    // Bump decay for blocks
    for (const b of blocks) {
      if (b.bumpY < 0) {
        b.bumpY += 1.2;
        if (b.bumpY > 0) b.bumpY = 0;
      }
    }
  }

  // --- CRISP PIXEL ART RENDERING ---
  function render() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // Save camera offset
    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    // 1. Retro Scenery (Clouds, Hills, Bushes)
    drawBackgroundScenery();

    // 2. Blocks & Pipes
    drawBlocks();

    // 3. Flagpole & Castle
    drawFlagAndCastle();

    // 4. Enemies
    drawEnemies();

    // 5. Fireballs & Particles
    drawFireballs();
    drawParticles();

    // 6. Mario
    drawMario();

    // 7. Floating Text Popups
    drawFloatingTexts();

    ctx.restore();
  }

  function drawBackgroundScenery() {
    // NES Hills
    const hillOffsets = [80, 520, 960, 1400, 1840, 2300, 2750];
    hillOffsets.forEach(hx => {
      ctx.fillStyle = '#00a800';
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y, 48, Math.PI, 0, false);
      ctx.fill();
      ctx.fillStyle = '#008800';
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y, 24, Math.PI, 0, false);
      ctx.fill();
    });

    // NES Clouds
    const cloudOffsets = [120, 360, 680, 1020, 1380, 1720, 2100, 2500];
    cloudOffsets.forEach((cx, idx) => {
      const cy = 40 + (idx % 2) * 20;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx + 14, cy - 6, 18, 0, Math.PI * 2);
      ctx.arc(cx + 28, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBlocks() {
    for (const b of blocks) {
      const bx = b.x;
      const by = b.y + (b.bumpY || 0);

      // Cull offscreen blocks
      if (bx + b.w < cameraX - 20 || bx > cameraX + V_WIDTH + 20) continue;

      if (b.type === 'ground') {
        ctx.fillStyle = '#c84c0c'; // NES Ground brown
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = '#fcbc00'; // Light top highlight
        ctx.fillRect(bx, by, b.w, 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(bx + 4, by + 4, 2, 2);
      } else if (b.type === 'pipe') {
        // Green Pipe
        ctx.fillStyle = '#00a800';
        ctx.fillRect(bx, by, b.w, b.h);
        // Highlight & Shadow
        ctx.fillStyle = '#80d010';
        ctx.fillRect(bx + 2, by, 4, b.h);
        ctx.fillStyle = '#005000';
        ctx.fillRect(bx + b.w - 4, by, 4, b.h);
        // Rim at top
        ctx.fillStyle = '#00a800';
        ctx.fillRect(bx - 2, by, b.w + 4, 8);
        ctx.fillStyle = '#80d010';
        ctx.fillRect(bx, by, 4, 8);
        ctx.fillStyle = '#005000';
        ctx.fillRect(bx + b.w, by, 2, 8);
      } else if (b.type === 'mystery') {
        // Shimmering [?] Block
        ctx.fillStyle = '#fcbc00';
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = '#c84c0c';
        ctx.strokeRect(bx + 0.5, by + 0.5, b.w - 1, b.h - 1);
        // Rivets
        ctx.fillStyle = '#000';
        ctx.fillRect(bx + 1, by + 1, 2, 2);
        ctx.fillRect(bx + b.w - 3, by + 1, 2, 2);
        ctx.fillRect(bx + 1, by + b.h - 3, 2, 2);
        ctx.fillRect(bx + b.w - 3, by + b.h - 3, 2, 2);
        // [?] Symbol
        ctx.fillStyle = '#b84418';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('?', bx + 4, by + 12);
      } else if (b.type === 'used') {
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = '#4a2511';
        ctx.strokeRect(bx + 0.5, by + 0.5, b.w - 1, b.h - 1);
        ctx.fillStyle = '#000';
        ctx.fillRect(bx + 1, by + 1, 2, 2);
        ctx.fillRect(bx + b.w - 3, by + 1, 2, 2);
      } else if (b.type === 'brick' || b.type === 'stair') {
        ctx.fillStyle = '#b84418';
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = '#000';
        ctx.strokeRect(bx + 0.5, by + 0.5, b.w - 1, b.h - 1);
        // Brick lines
        ctx.fillRect(bx, by + 8, b.w, 1);
        ctx.fillRect(bx + 8, by, 1, 8);
        ctx.fillRect(bx + 4, by + 8, 1, 8);
      }
    }
  }

  function drawFlagAndCastle() {
    // Flagpole
    ctx.fillStyle = '#222';
    ctx.fillRect(flagPole.x, flagPole.y, 4, 144);
    // Gold finial top ball
    ctx.fillStyle = '#fcbc00';
    ctx.beginPath();
    ctx.arc(flagPole.x + 2, flagPole.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // Sliding Triangular Flag
    ctx.fillStyle = '#00a800';
    ctx.beginPath();
    ctx.moveTo(flagPole.x + 4, flagPole.flagY);
    ctx.lineTo(flagPole.x + 24, flagPole.flagY + 10);
    ctx.lineTo(flagPole.x + 4, flagPole.flagY + 20);
    ctx.closePath();
    ctx.fill();

    // Peach's Castle
    const cx = castle.x;
    const cy = castle.y;
    ctx.fillStyle = '#b84418';
    ctx.fillRect(cx, cy, 80, 80);
    // Crenellations
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx + i * 16, cy - 8, 10, 8);
    }
    // Dark entrance
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx + 40, cy + 50, 16, Math.PI, 0);
    ctx.fillRect(cx + 24, cy + 50, 32, 30);
    ctx.fill();
  }

  function drawMario() {
    if (mario.dead) {
      // Dying frame
      drawMarioSprite(mario.x, mario.y, 'die');
      return;
    }

    if (mario.invulnerable > 0 && Math.floor(mario.invulnerable / 4) % 2 === 0) {
      return; // Blinking
    }

    let pose = 'stand';
    if (!mario.grounded) {
      pose = 'jump';
    } else if (mario.ducking) {
      pose = 'duck';
    } else if (Math.abs(mario.vx) > 0.3) {
      pose = mario.animFrame === 1 ? 'run1' : (mario.animFrame === 2 ? 'run2' : 'stand');
    }

    drawMarioSprite(mario.x, mario.y, pose);
  }

  function drawMarioSprite(x, y, pose) {
    ctx.save();
    if (mario.facing === 'left') {
      ctx.translate(x + mario.w, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    // NES Colors Palette based on powerup state
    let hatColor = '#e52521'; // Red
    let suitColor = '#0026e6'; // Blue overalls
    let skinColor = '#fc9838'; // Peach

    if (mario.state === 'fire') {
      hatColor = '#ffffff';
      suitColor = '#e52521';
    } else if (mario.state === 'super') {
      hatColor = '#e52521';
      suitColor = '#0026e6';
    }

    const isTall = mario.state !== 'small';
    const h = mario.ducking ? 16 : (isTall ? 28 : 16);

    if (pose === 'duck') {
      // Ducking pose
      ctx.fillStyle = hatColor;
      ctx.fillRect(x + 2, y + 2, 12, 5);
      ctx.fillStyle = skinColor;
      ctx.fillRect(x + 4, y + 7, 8, 4);
      ctx.fillStyle = suitColor;
      ctx.fillRect(x + 2, y + 10, 12, 6);
      ctx.restore();
      return;
    }

    if (isTall) {
      // Super / Fire Mario
      // Cap
      ctx.fillStyle = hatColor;
      ctx.fillRect(x + 2, y, 11, 4);
      ctx.fillRect(x + 6, y + 2, 8, 3);
      // Head & Face
      ctx.fillStyle = skinColor;
      ctx.fillRect(x + 3, y + 4, 9, 6);
      // Mustache & Eye
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 9, y + 5, 2, 2);
      ctx.fillRect(x + 7, y + 8, 6, 2);
      // Shirt / Overalls
      ctx.fillStyle = hatColor;
      ctx.fillRect(x + 3, y + 10, 9, 7);
      ctx.fillStyle = suitColor;
      ctx.fillRect(x + 4, y + 14, 7, 8);
      // Arms / Legs
      if (pose === 'jump') {
        ctx.fillStyle = hatColor;
        ctx.fillRect(x + 10, y + 6, 4, 8); // Arm raised
        ctx.fillStyle = suitColor;
        ctx.fillRect(x + 1, y + 22, 6, 5);
        ctx.fillRect(x + 8, y + 20, 6, 4);
      } else {
        ctx.fillStyle = suitColor;
        ctx.fillRect(x + 2, y + 22, 4, 6);
        ctx.fillRect(x + 8, y + 22, 4, 6);
      }
      // Shoes
      ctx.fillStyle = '#6b3300';
      ctx.fillRect(x + 1, y + h - 2, 5, 3);
      ctx.fillRect(x + 8, y + h - 2, 5, 3);
    } else {
      // Small Mario
      // Cap
      ctx.fillStyle = hatColor;
      ctx.fillRect(x + 2, y, 9, 3);
      ctx.fillRect(x + 5, y + 1, 7, 3);
      // Face
      ctx.fillStyle = skinColor;
      ctx.fillRect(x + 2, y + 3, 9, 5);
      // Eye & Mustache
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 8, y + 4, 2, 2);
      ctx.fillRect(x + 6, y + 6, 5, 2);
      // Overalls & Shirt
      ctx.fillStyle = hatColor;
      ctx.fillRect(x + 3, y + 8, 8, 4);
      ctx.fillStyle = suitColor;
      ctx.fillRect(x + 4, y + 9, 6, 5);
      // Feet
      ctx.fillStyle = '#6b3300';
      if (pose === 'jump') {
        ctx.fillRect(x, y + 12, 4, 3);
        ctx.fillRect(x + 9, y + 10, 4, 3);
      } else {
        ctx.fillRect(x + 1, y + 13, 4, 3);
        ctx.fillRect(x + 8, y + 13, 4, 3);
      }
    }

    ctx.restore();
  }

  function drawEnemies() {
    for (const e of enemies) {
      if (e.x + e.w < cameraX - 20 || e.x > cameraX + V_WIDTH + 20) continue;

      if (e.type === 'goomba') {
        if (e.squashed) {
          // Squashed flat goomba
          ctx.fillStyle = '#a0522d';
          ctx.fillRect(e.x, e.y + 10, e.w, 6);
          ctx.fillStyle = '#000';
          ctx.fillRect(e.x + 3, e.y + 12, 3, 2);
          ctx.fillRect(e.x + 10, e.y + 12, 3, 2);
        } else {
          // Walking Goomba
          ctx.fillStyle = '#a0522d';
          ctx.beginPath();
          ctx.arc(e.x + 8, e.y + 6, 7, Math.PI, 0);
          ctx.lineTo(e.x + 15, e.y + 11);
          ctx.lineTo(e.x + 1, e.y + 11);
          ctx.closePath();
          ctx.fill();

          // Body & Eyes
          ctx.fillStyle = '#fcbc00';
          ctx.fillRect(e.x + 3, e.y + 10, 10, 4);
          ctx.fillStyle = '#fff';
          ctx.fillRect(e.x + 4, e.y + 5, 3, 4);
          ctx.fillRect(e.x + 9, e.y + 5, 3, 4);
          ctx.fillStyle = '#000';
          ctx.fillRect(e.x + 5, e.y + 6, 2, 3);
          ctx.fillRect(e.x + 10, e.y + 6, 2, 3);

          // Feet
          ctx.fillStyle = '#000';
          const step = Math.floor(performance.now() / 150) % 2 === 0;
          ctx.fillRect(e.x + (step ? 0 : 2), e.y + 13, 4, 3);
          ctx.fillRect(e.x + (step ? 10 : 12), e.y + 13, 4, 3);
        }
      } else if (e.type === 'koopa') {
        if (e.shell) {
          // Green Shell
          ctx.fillStyle = '#00a800';
          ctx.beginPath();
          ctx.arc(e.x + 8, e.y + 10, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(e.x + 2, e.y + 12, 12, 3);
        } else {
          // Walking Koopa
          ctx.fillStyle = '#00a800'; // Shell
          ctx.fillRect(e.x + 2, e.y + 8, 12, 12);
          ctx.fillStyle = '#fcbc00'; // Head
          ctx.fillRect(e.x + (e.vx < 0 ? 0 : 8), e.y + 2, 8, 8);
          ctx.fillStyle = '#000';
          ctx.fillRect(e.x + (e.vx < 0 ? 2 : 12), e.y + 4, 2, 2);
          // Shoes
          ctx.fillStyle = '#ff8800';
          ctx.fillRect(e.x + 2, e.y + 20, 5, 4);
          ctx.fillRect(e.x + 9, e.y + 20, 5, 4);
        }
      }
    }
  }

  function drawFireballs() {
    for (const fb of fireballs) {
      ctx.fillStyle = '#ff3300';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  function drawFloatingTexts() {
    for (const ft of floatingTexts) {
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 9px monospace';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
  }

  // --- HUD & MODAL CONTROLS ---
  function updateHUD() {
    const scoreVal = document.getElementById('score-val');
    const coinsVal = document.getElementById('coins-val');
    const livesVal = document.getElementById('lives-val');

    if (scoreVal) scoreVal.textContent = String(score).padStart(6, '0');
    if (coinsVal) coinsVal.textContent = '🪙 x' + String(coins).padStart(2, '0');
    if (livesVal) livesVal.textContent = '❤️ x' + lives;
  }

  function startGame() {
    audio.init();
    audio.startBGM();
    gameRunning = true;
    gameOver = false;
    gameWon = false;
    timeLeft = 400;

    const lobby = document.getElementById('mario-lobby');
    const endModal = document.getElementById('mario-end-modal');
    if (lobby) lobby.classList.remove('active');
    if (endModal) endModal.classList.remove('active');
  }

  function triggerGameOver() {
    gameRunning = false;
    gameOver = true;
    audio.stopBGM();

    const endModal = document.getElementById('mario-end-modal');
    const endTitle = document.getElementById('end-title');
    const endScore = document.getElementById('end-score');
    const endCoins = document.getElementById('end-coins');
    const endEnemies = document.getElementById('end-enemies');

    if (endTitle) endTitle.textContent = 'GAME OVER';
    if (endScore) endScore.textContent = String(score).padStart(6, '0');
    if (endCoins) endCoins.textContent = coins;
    if (endEnemies) endEnemies.textContent = defeatedCount;
    if (endModal) endModal.classList.add('active');
  }

  function showStageClearModal() {
    gameRunning = false;
    gameWon = true;

    const endModal = document.getElementById('mario-end-modal');
    const endTitle = document.getElementById('end-title');
    const endScore = document.getElementById('end-score');
    const endCoins = document.getElementById('end-coins');
    const endEnemies = document.getElementById('end-enemies');

    if (endTitle) endTitle.textContent = '🏆 STAGE CLEAR! 🏆';
    if (endScore) endScore.textContent = String(score).padStart(6, '0');
    if (endCoins) endCoins.textContent = coins;
    if (endEnemies) endEnemies.textContent = defeatedCount;
    if (endModal) endModal.classList.add('active');
  }

  function restartGame() {
    lives = 3;
    score = 0;
    coins = 0;
    defeatedCount = 0;
    timeLeft = 400;
    mario.dead = false;
    updateHUD();
    buildLevel();
    mario.reset();
    startGame();
  }

  // --- INITIALIZATION ---
  window.addEventListener('load', () => {
    canvas = document.getElementById('mario-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;

    // Attach Lobby & End Buttons
    const btnStart = document.getElementById('btn-start-mario');
    const btnRestart = document.getElementById('btn-restart-mario');
    const btnMute = document.getElementById('btn-mute');

    if (btnStart) btnStart.addEventListener('click', startGame);
    if (btnRestart) btnRestart.addEventListener('click', restartGame);

    if (btnMute) {
      btnMute.addEventListener('click', () => {
        audio.muted = !audio.muted;
        btnMute.textContent = audio.muted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
        if (audio.muted) audio.stopBGM();
        else if (gameRunning) audio.startBGM();
      });
    }

    // Generate Pairing QR Code
    fetch('/api/info')
      .then(r => r.json())
      .then(info => {
        const base = info.httpsPhoneUrl || `${window.location.protocol}//${window.location.hostname}:${info.port}/phone?room=${ROOM_ID}`;
        const phoneUrl = base.includes('?') ? `${base}&game=mario` : `${base}?game=mario`;
        const qrContainer = document.getElementById('mario-qr');
        const linkDisplay = document.getElementById('mario-link-display');

        if (linkDisplay) linkDisplay.textContent = phoneUrl;
        if (qrContainer && window.QRCode) {
          qrContainer.innerHTML = '';
          new QRCode(qrContainer, {
            text: phoneUrl,
            width: 150,
            height: 150,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      })
      .catch(() => {});

    // Build World
    buildLevel();
    mario.reset();
    updateHUD();

    // Connect WebSocket Relay
    connectWebSocket();

    // Main 60 FPS Render & Physics Loop
    function gameLoop(now) {
      update();
      render();
      requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);
  });
})();

