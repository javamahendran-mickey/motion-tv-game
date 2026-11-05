// Smart TV Kids Motion Arcade - 9 Blockbuster Motion Games
(function () {
  'use strict';

  // Room Identifier (Persistent in localStorage so it NEVER changes on refresh!)
  let persistentRoom = null;
  try { persistentRoom = localStorage.getItem('tv_arcade_room'); } catch (e) {}
  if (!persistentRoom) {
    persistentRoom = 'TV-' + Math.floor(1000 + Math.random() * 9000);
    try { localStorage.setItem('tv_arcade_room', persistentRoom); } catch (e) {}
  }
  const urlParams = new URLSearchParams(window.location.search);
  const ROOM_ID = urlParams.get('room') || persistentRoom;

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score-display');
  const comboEl = document.getElementById('combo-display');
  const connDot = document.getElementById('conn-dot');
  const connText = document.getElementById('conn-text');
  const startBtn = document.getElementById('start-btn');
  const lobbyModal = document.getElementById('lobby-modal');
  const gameoverModal = document.getElementById('gameover-modal');
  const restartBtn = document.getElementById('restart-btn');
  const roomIdDisplay = document.getElementById('room-id-display');
  const phoneUrlDisplay = document.getElementById('phone-url-display');
  const controllerModeDisplay = document.getElementById('controller-mode-display');
  const latencyDisplay = document.getElementById('latency-display');
  const finalScoreEl = document.getElementById('final-score');
  const maxComboEl = document.getElementById('max-combo');
  const accuracyEl = document.getElementById('accuracy-stat');

  roomIdDisplay.textContent = ROOM_ID;

  // Sound Synthesizer via Web Audio API (No external assets required!)
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type, duration, gainVal = 0.2) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // SOUND EFFECTS FOR ALL 9 GAMES
  function playFruitSliceSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function playHitSound() {
    playTone(587.33, 'triangle', 0.15, 0.3); // D5
    setTimeout(() => playTone(880, 'sine', 0.2, 0.25), 40); // A5
  }

  function playTennisHitSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {}
  }

  function playMagicSpellSound() {
    playTone(523.25, 'sine', 0.1, 0.3); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.35), 40); // E5
    setTimeout(() => playTone(880, 'sine', 0.15, 0.35), 80); // A5
    setTimeout(() => playTone(1174.66, 'sine', 0.22, 0.4), 120); // D6
  }

  function playBalloonPopSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {}
  }

  function playCoinSound() {
    playTone(987.77, 'sine', 0.08, 0.3); // B5
    setTimeout(() => playTone(1318.51, 'sine', 0.18, 0.35), 60); // E6
  }

  function playTurboSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }

  function playGemSound() {
    playTone(1046.5, 'sine', 0.1, 0.25); // C6
    setTimeout(() => playTone(1318.5, 'sine', 0.12, 0.25), 50); // E6
    setTimeout(() => playTone(1567.9, 'sine', 0.18, 0.3), 100); // G6
  }

  function playBoingSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(550, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  }

  function playGoalSound() {
    playTone(523.25, 'triangle', 0.2, 0.4); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.2, 0.4), 100); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.2, 0.4), 200); // G5
    setTimeout(() => playTone(1046.5, 'triangle', 0.4, 0.5), 300); // C6 Fanfare!
  }

  function playPunchSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  function playSwingSound() {
    playTone(260, 'sine', 0.1, 0.12);
  }

  function playMissSound() {
    playTone(110, 'sawtooth', 0.22, 0.2);
  }

  function playComboFanfare(combo) {
    if (combo === 5) {
      playTone(659.25, 'sine', 0.15, 0.3); // E5
      setTimeout(() => playTone(880, 'sine', 0.2, 0.35), 70); // A5
    } else if (combo === 10) {
      playTone(523.25, 'triangle', 0.15, 0.35); // C5
      setTimeout(() => playTone(783.99, 'triangle', 0.18, 0.35), 70); // G5
      setTimeout(() => playTone(1046.5, 'sine', 0.3, 0.4), 140); // C6
    }
  }

  // Canvas Resize
  let width = 0;
  let height = 0;
  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // 9 Game Content Definitions
  const FRUITS = [
    { name: 'Watermelon', icon: '🍉', color: '#ff3366', points: 100 },
    { name: 'Pineapple',  icon: '🍍', color: '#ffb703', points: 120 },
    { name: 'Banana',     icon: '🍌', color: '#ffd166', points: 100 },
    { name: 'Strawberry', icon: '🍓', color: '#ff0077', points: 150 },
    { name: 'StarFruit',  icon: '⭐', color: '#00f0ff', points: 300, isBonus: true }
  ];

  const MONSTERS = [
    { name: 'Glurp', icon: '👾', color: '#b5179e', points: 150 },
    { name: 'Boo',   icon: '👻', color: '#00f0ff', points: 120 },
    { name: 'Bot',   icon: '🤖', color: '#00f59b', points: 180 }
  ];

  const WIZARD_ENEMIES = [
    { name: 'Bat',      icon: '🦇', color: '#9d4edd', points: 120 },
    { name: 'Phantom',  icon: '👻', color: '#48cae4', points: 140 },
    { name: 'Skull',    icon: '💀', color: '#ff0055', points: 180 },
    { name: 'Dark Orb', icon: '🔮', color: '#7209b7', points: 200 }
  ];

  const BALLOONS = [
    { name: 'Red',     icon: '🎈', color: '#ff3366', points: 100 },
    { name: 'Blue',    icon: '🎈', color: '#00f0ff', points: 100 },
    { name: 'Yellow',  icon: '🎈', color: '#ffd166', points: 120 },
    { name: 'Star',    icon: '⭐', color: '#ffb703', points: 250, isBonus: true },
    { name: 'Gift',    icon: '🎁', color: '#00f59b', points: 200, isBonus: true }
  ];

  const KART_ITEMS = [
    { name: 'Coin',    icon: '🪙', color: '#ffd166', points: 100, isGood: true },
    { name: 'Turbo',   icon: '⚡', color: '#00f0ff', points: 300, isGood: true, isBoost: true },
    { name: 'Star',    icon: '⭐', color: '#ff0077', points: 200, isGood: true },
    { name: 'Oil',     icon: '🛢️', color: '#ff3366', points: -50, isObstacle: true }
  ];

  // Game State
  const gameState = {
    mode: 'fruit', // 'fruit', 'saber', 'tennis', 'wizard', 'balloon', 'kart', 'dodge', 'boxing', 'soccer'
    running: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    totalTargets: 0,
    health: 100,
    playerX: 0.5,
    playerY: 0.8,
    isSwinging: false,
    swingActiveUntil: 0, // Magnetic swing window (250ms)
    swingDir: null,
    isPunching: false,
    punchActiveUntil: 0,
    bladeAngle: 0,
    targets: [],
    particles: [],
    fruitHalves: [],
    floatingTexts: [],
    lastSpawnTime: 0,
    spawnInterval: 1000,
    lastFrameTime: performance.now()
  };

  // Controller Motion State
  const motionData = {
    tiltX: 0,
    tiltY: 0,
    accelMag: 0,
    bodyX: 0.5,
    lastUpdate: Date.now()
  };

  // Particle System
  class Particle {
    constructor(x, y, color, speed = 12, isSquare = false) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * speed;
      this.vy = (Math.random() - 0.5) * speed;
      this.radius = Math.random() * 5 + 3;
      this.color = color;
      this.isSquare = isSquare;
      this.alpha = 1;
      this.life = 1;
      this.decay = Math.random() * 0.035 + 0.02;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.95;
      this.vy *= 0.95;
      this.life -= this.decay;
      this.alpha = Math.max(0, this.life);
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      if (this.isSquare) {
        ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Sliced Fruit Halves (Physics Split)
  class FruitHalf {
    constructor(x, y, icon, vx, vy) {
      this.x = x;
      this.y = y;
      this.icon = icon;
      this.vx = vx;
      this.vy = vy;
      this.rotation = 0;
      this.vRot = (Math.random() - 0.5) * 0.25;
      this.alpha = 1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.4;
      this.rotation += this.vRot;
      this.alpha -= 0.025;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.font = '40px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.icon, 0, 0);
      ctx.restore();
    }
  }

  // Floating Text (Score / Praise Popups)
  class FloatingText {
    constructor(text, x, y, color, size = 30) {
      this.text = text;
      this.x = x;
      this.y = y;
      this.color = color;
      this.alpha = 1;
      this.life = 1;
      this.vy = -3;
      this.size = size;
    }
    update() {
      this.y += this.vy;
      this.life -= 0.022;
      this.alpha = Math.max(0, this.life);
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.font = `bold ${this.size}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // Target Class (Customized for each of the 9 Games)
  class Target {
    constructor(mode) {
      this.mode = mode;
      this.z = 0.05; // 0.0 far, 1.0 player hit zone
      this.speed = 0.013;
      this.lane = Math.floor(Math.random() * 3); // 0=left, 1=center, 2=right
      this.sliced = false;
      this.size = 24;

      if (this.mode === 'fruit') {
        this.fruitData = FRUITS[Math.floor(Math.random() * FRUITS.length)];
        this.icon = this.fruitData.icon;
        this.color = this.fruitData.color;
        this.points = this.fruitData.points;
      } else if (this.mode === 'saber') {
        this.type = Math.random() > 0.5 ? 'cyan' : 'magenta';
        this.color = this.type === 'cyan' ? '#00f0ff' : '#ff0077';
        this.points = 100;
      } else if (this.mode === 'tennis') {
        this.icon = '🎾';
        this.color = '#cbfb45';
        this.points = 150;
      } else if (this.mode === 'wizard') {
        this.enemyData = WIZARD_ENEMIES[Math.floor(Math.random() * WIZARD_ENEMIES.length)];
        this.icon = this.enemyData.icon;
        this.color = this.enemyData.color;
        this.points = this.enemyData.points;
      } else if (this.mode === 'balloon') {
        this.balloonData = BALLOONS[Math.floor(Math.random() * BALLOONS.length)];
        this.icon = this.balloonData.icon;
        this.color = this.balloonData.color;
        this.points = this.balloonData.points;
      } else if (this.mode === 'kart') {
        this.kartData = KART_ITEMS[Math.floor(Math.random() * KART_ITEMS.length)];
        this.icon = this.kartData.icon;
        this.color = this.kartData.color;
        this.points = this.kartData.points;
        this.isGood = this.kartData.isGood;
        this.isObstacle = this.kartData.isObstacle;
        this.isBoost = this.kartData.isBoost;
      } else if (this.mode === 'dodge') {
        this.isGem = Math.random() > 0.4;
        this.color = this.isGem ? '#00f59b' : '#ff3366';
        this.icon = this.isGem ? '💎' : '☄️';
        this.points = 100;
      } else if (this.mode === 'boxing') {
        this.monsterData = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
        this.icon = this.monsterData.icon;
        this.color = this.monsterData.color;
        this.points = this.monsterData.points;
      } else if (this.mode === 'soccer') {
        this.icon = '⚽';
        this.color = '#ffffff';
        this.points = 200;
      }
    }

    update() {
      this.z += this.speed;
      this.size = 24 + this.z * 110;
    }

    draw(ctx, w, h) {
      const horizonY = h * 0.44;
      const targetScreenY = horizonY + (h * 0.42) * (this.z * this.z);
      const laneSpread = (w * 0.72) * this.z;
      const targetScreenX = (w * 0.5) + (this.lane - 1) * (laneSpread * 0.5);

      this.screenX = targetScreenX;
      this.screenY = targetScreenY;

      ctx.save();

      if (this.mode === 'saber') {
        // Neon Rhythm Cube
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        const s = this.size;
        ctx.fillRect(targetScreenX - s / 2, targetScreenY - s / 2, s, s);
        ctx.strokeRect(targetScreenX - s / 2, targetScreenY - s / 2, s, s);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(targetScreenX, targetScreenY, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mode === 'dodge' && !this.isGem) {
        // Asteroid Laser Wall
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ff3366';
        ctx.fillStyle = 'rgba(255, 51, 102, 0.25)';
        ctx.lineWidth = 4;
        const wSpan = this.size * 1.5;
        const hSpan = this.size * 1.8;
        ctx.fillRect(targetScreenX - wSpan / 2, targetScreenY - hSpan / 2, wSpan, hSpan);
        ctx.strokeRect(targetScreenX - wSpan / 2, targetScreenY - hSpan / 2, wSpan, hSpan);
      } else {
        // High-fidelity emoji target with colored aura
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;
        ctx.font = `${this.size * 0.9}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, targetScreenX, targetScreenY);
      }

      ctx.restore();
    }
  }

  // Spawn Targets
  function spawnTarget() {
    gameState.totalTargets++;
    gameState.targets.push(new Target(gameState.mode));
  }

  // Create Explosion
  function createExplosion(x, y, color, count = 28, isSquare = false) {
    for (let i = 0; i < count; i++) {
      gameState.particles.push(new Particle(x, y, color, 14, isSquare));
    }
  }

  // Slice Fruit into Halves
  function sliceFruit(x, y, icon) {
    gameState.fruitHalves.push(new FruitHalf(x - 20, y, icon, -6, -8));
    gameState.fruitHalves.push(new FruitHalf(x + 20, y, icon, 6, -8));
  }

  // Check Collisions (Ultra-forgiving Magnetic Hitbox for Kids)
  function checkCollisions() {
    const hitZoneZMin = 0.55;
    const hitZoneZMax = 1.15;
    const now = performance.now();

    const isSwingActive = (now < gameState.swingActiveUntil) || gameState.isSwinging || (motionData.accelMag > 1.3);
    const isPunchActive = (now < gameState.punchActiveUntil) || gameState.isPunching || (motionData.accelMag > 1.4);

    for (let i = gameState.targets.length - 1; i >= 0; i--) {
      const t = gameState.targets[i];

      if (t.z >= hitZoneZMin && t.z <= hitZoneZMax && !t.sliced) {
        const playerScreenX = gameState.playerX * width;
        const dist = Math.abs(playerScreenX - t.screenX);

        let hit = false;

        if (gameState.mode === 'fruit' || gameState.mode === 'saber' || gameState.mode === 'tennis' || gameState.mode === 'wizard' || gameState.mode === 'balloon') {
          // Large magnetic swing slice radius (260px)
          if (dist < 260 && isSwingActive) {
            hit = true;
          }
        } else if (gameState.mode === 'kart') {
          // Kart steering collector / dodger
          if (t.isGood && dist < 140) {
            hit = true;
          } else if (t.isObstacle && dist < 80) {
            t.sliced = true;
            gameState.health -= 15;
            gameState.combo = 0;
            comboEl.textContent = '0x';
            playMissSound();
            createExplosion(t.screenX, t.screenY, '#ff3366', 22);
            gameState.floatingTexts.push(new FloatingText('SPIN OUT! 🛢️', t.screenX, t.screenY, '#ff3366', 32));
            sendHapticFeedback(120);
            continue;
          }
        } else if (gameState.mode === 'dodge') {
          if (t.isGem && dist < 150) {
            hit = true;
          } else if (!t.isGem && dist < 85) {
            t.sliced = true;
            gameState.health -= 15;
            gameState.combo = 0;
            comboEl.textContent = '0x';
            playMissSound();
            createExplosion(t.screenX, t.screenY, '#ff3366', 20);
            gameState.floatingTexts.push(new FloatingText('OUCH! -15', t.screenX, t.screenY, '#ff3366', 32));
            sendHapticFeedback(120);
            continue;
          }
        } else if (gameState.mode === 'boxing') {
          if (dist < 260 && (isPunchActive || isSwingActive)) {
            hit = true;
          }
        } else if (gameState.mode === 'soccer') {
          if (dist < 260 && (isSwingActive || isPunchActive)) {
            hit = true;
          }
        }

        if (hit) {
          t.sliced = true;
          gameState.hits++;
          gameState.combo++;
          if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;

          const mult = Math.min(Math.floor(gameState.combo / 3) + 1, 8);
          const pointsEarned = (t.points || 100) * mult;
          gameState.score += pointsEarned;

          scoreEl.textContent = gameState.score;
          comboEl.textContent = `${gameState.combo}x`;

          // Custom Sound & Visuals per game
          if (gameState.mode === 'fruit') {
            playFruitSliceSound();
            sliceFruit(t.screenX, t.screenY, t.icon);
            createExplosion(t.screenX, t.screenY, t.color, 32);
            gameState.floatingTexts.push(new FloatingText(`+${pointsEarned}!`, t.screenX, t.screenY, t.color, 32));
          } else if (gameState.mode === 'tennis') {
            playTennisHitSound();
            createExplosion(t.screenX, t.screenY, '#cbfb45', 30);
            gameState.floatingTexts.push(new FloatingText(`🎾 SMASH! +${pointsEarned}`, t.screenX, t.screenY, '#cbfb45', 34));
          } else if (gameState.mode === 'wizard') {
            playMagicSpellSound();
            createExplosion(t.screenX, t.screenY, t.color, 36);
            gameState.floatingTexts.push(new FloatingText(`✨ MAGIC BLAST! +${pointsEarned}`, t.screenX, t.screenY, '#00f0ff', 34));
          } else if (gameState.mode === 'balloon') {
            playBalloonPopSound();
            createExplosion(t.screenX, t.screenY, t.color, 36, true); // Colorful confetti squares!
            gameState.floatingTexts.push(new FloatingText(`🎈 POP! +${pointsEarned}`, t.screenX, t.screenY, t.color, 34));
          } else if (gameState.mode === 'kart') {
            if (t.isBoost) {
              playTurboSound();
              createExplosion(t.screenX, t.screenY, '#00f0ff', 35);
              gameState.floatingTexts.push(new FloatingText(`⚡ TURBO NITRO! +${pointsEarned}`, t.screenX, t.screenY, '#00f0ff', 38));
            } else {
              playCoinSound();
              createExplosion(t.screenX, t.screenY, '#ffd166', 22);
              gameState.floatingTexts.push(new FloatingText(`🪙 COIN! +${pointsEarned}`, t.screenX, t.screenY, '#ffd166', 30));
            }
          } else if (gameState.mode === 'dodge') {
            playGemSound();
            createExplosion(t.screenX, t.screenY, '#00f59b', 24);
            gameState.floatingTexts.push(new FloatingText(`💎 +${pointsEarned}!`, t.screenX, t.screenY, '#00f59b', 32));
          } else if (gameState.mode === 'boxing') {
            playBoingSound();
            createExplosion(t.screenX, t.screenY, t.color, 28);
            gameState.floatingTexts.push(new FloatingText(`BONK! +${pointsEarned}`, t.screenX, t.screenY, t.color, 34));
          } else if (gameState.mode === 'soccer') {
            playGoalSound();
            createExplosion(t.screenX, t.screenY, '#ffd166', 36);
            gameState.floatingTexts.push(new FloatingText(`⚽ GOOOAL! +${pointsEarned}`, t.screenX, height * 0.4, '#ffd166', 42));
          } else {
            playHitSound();
            createExplosion(t.screenX, t.screenY, t.color, 26);
            gameState.floatingTexts.push(new FloatingText(`+${pointsEarned}`, t.screenX, t.screenY, t.color, 30));
          }

          // Combo celebrations
          if (gameState.combo % 5 === 0) {
            playComboFanfare(gameState.combo);
            const praise = gameState.combo >= 15 ? 'UNSTOPPABLE!! 🔥' : (gameState.combo >= 10 ? 'AWESOME!! ⚡' : 'GREAT!! ⭐');
            gameState.floatingTexts.push(new FloatingText(praise, width / 2, height * 0.35, '#ff0077', 40));
          }

          sendHapticFeedback(70);
        }
      }

      // Despawn passed targets
      if (t.z > 1.15) {
        if (!t.sliced && gameState.mode !== 'dodge' && (gameState.mode !== 'kart' || !t.isObstacle)) {
          gameState.combo = 0;
          comboEl.textContent = '0x';
          playMissSound();
          gameState.floatingTexts.push(new FloatingText('MISS', t.screenX || width / 2, height * 0.8, '#ff3366', 26));
        } else if (gameState.mode === 'dodge' && !t.sliced && !t.isGem) {
          gameState.score += 50;
          scoreEl.textContent = gameState.score;
          gameState.floatingTexts.push(new FloatingText('DODGED! +50', t.screenX, height * 0.8, '#00f59b', 24));
        } else if (gameState.mode === 'kart' && !t.sliced && t.isObstacle) {
          gameState.score += 50;
          scoreEl.textContent = gameState.score;
          gameState.floatingTexts.push(new FloatingText('DRIFT DODGE! +50', t.screenX, height * 0.8, '#00f0ff', 24));
        }
        gameState.targets.splice(i, 1);
      }
    }
  }

  // Draw Dynamic Perspective Themed Grids
  function drawPerspectiveGrid(ctx, w, h) {
    const horizon = h * 0.44;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (gameState.mode === 'fruit') {
      bgGrad.addColorStop(0, '#0a192f');
      bgGrad.addColorStop(0.44, '#1b0a2a');
      bgGrad.addColorStop(1, '#08111e');
    } else if (gameState.mode === 'tennis') {
      bgGrad.addColorStop(0, '#0b3c5d');
      bgGrad.addColorStop(0.44, '#1d5a2b');
      bgGrad.addColorStop(1, '#0e2f18');
    } else if (gameState.mode === 'wizard') {
      bgGrad.addColorStop(0, '#0f051d');
      bgGrad.addColorStop(0.44, '#240046');
      bgGrad.addColorStop(1, '#10002b');
    } else if (gameState.mode === 'balloon') {
      bgGrad.addColorStop(0, '#1d2d44');
      bgGrad.addColorStop(0.44, '#3e1f47');
      bgGrad.addColorStop(1, '#0d1b2a');
    } else if (gameState.mode === 'kart') {
      bgGrad.addColorStop(0, '#03071e');
      bgGrad.addColorStop(0.44, '#370617');
      bgGrad.addColorStop(1, '#03071e');
    } else if (gameState.mode === 'soccer') {
      bgGrad.addColorStop(0, '#02182b');
      bgGrad.addColorStop(0.44, '#093a18');
      bgGrad.addColorStop(1, '#05200f');
    } else {
      bgGrad.addColorStop(0, '#06070b');
      bgGrad.addColorStop(0.44, '#130d24');
      bgGrad.addColorStop(1, '#0a0b12');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Horizon Glow
    const glowGrad = ctx.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, w * 0.45);
    glowGrad.addColorStop(0, 'rgba(255, 0, 119, 0.4)');
    glowGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, horizon + 50);

    // Horizon line
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();

    // Perspective Lanes (3 lanes)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.shadowBlur = 6;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 40, horizon);
      ctx.lineTo(w / 2 + i * (w * 0.36), h);
      ctx.stroke();
    }

    // Moving speed lines
    const timeOffset = (performance.now() * 0.001) % 1;
    for (let k = 1; k < 12; k++) {
      const p = (k + timeOffset) / 12;
      const y = horizon + (h - horizon) * Math.pow(p, 2.4);
      ctx.strokeStyle = `rgba(255, 0, 119, ${p * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // Draw Player Avatar customized per game
  function drawPlayer(ctx, w, h) {
    const px = gameState.playerX * w;
    const py = h * 0.82;

    ctx.save();
    if (gameState.mode === 'fruit' || gameState.mode === 'saber') {
      // Dual Ninja Katana / Neon Sabers
      const bladeLength = 150;
      const angle = gameState.bladeAngle;

      // Left Blade (Cyan)
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - 45, py);
      ctx.lineTo(px - 45 + Math.sin(angle - 0.35) * bladeLength, py - Math.cos(angle - 0.35) * bladeLength);
      ctx.stroke();

      // Right Blade (Magenta)
      ctx.shadowColor = '#ff0077';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#ff0077';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(px + 45, py);
      ctx.lineTo(px + 45 + Math.sin(angle + 0.35) * bladeLength, py - Math.cos(angle + 0.35) * bladeLength);
      ctx.stroke();

      // Blade Core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (gameState.mode === 'tennis') {
      // Wii Grand Slam Tennis Racket
      ctx.translate(px, py);
      ctx.rotate(gameState.bladeAngle * 0.8);
      ctx.shadowColor = '#cbfb45';
      ctx.shadowBlur = 20;

      // Racket Oval Head
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, -60, 36, 48, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Racket Netting
      ctx.strokeStyle = 'rgba(203, 251, 69, 0.6)';
      ctx.lineWidth = 1.5;
      for (let x = -24; x <= 24; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, -100);
        ctx.lineTo(x, -20);
        ctx.stroke();
      }

      // Racket Handle
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 35);
      ctx.stroke();
    } else if (gameState.mode === 'wizard') {
      // Glowing Magic Wand
      ctx.translate(px, py);
      ctx.rotate(gameState.bladeAngle * 0.7);
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 25;

      // Wooden Wand Shaft
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(0, -90);
      ctx.stroke();

      // Magic Crystal Tip
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, -95, 12, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling Aura
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -95, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (gameState.mode === 'balloon') {
      // Carnival Dart
      ctx.translate(px, py);
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 20;
      ctx.font = '55px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎯', 0, 0);
    } else if (gameState.mode === 'kart') {
      // Cyber Neon Kart
      ctx.translate(px, py);
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 24;
      ctx.font = '65px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏎️', 0, 0);

      // Exhaust Fire
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(-15, 20);
      ctx.lineTo(0, 42);
      ctx.lineTo(15, 20);
      ctx.closePath();
      ctx.fill();
    } else if (gameState.mode === 'dodge') {
      // Cosmic Spaceship
      ctx.shadowColor = '#00f59b';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#00f59b';
      ctx.beginPath();
      ctx.moveTo(px, py - 45);
      ctx.lineTo(px - 55, py + 20);
      ctx.lineTo(px, py + 10);
      ctx.lineTo(px + 55, py + 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(px - 15, py + 15);
      ctx.lineTo(px, py + 38);
      ctx.lineTo(px + 15, py + 15);
      ctx.closePath();
      ctx.fill();
    } else if (gameState.mode === 'boxing') {
      // Cartoon Boxing Gloves
      ctx.shadowColor = '#ffb703';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ffb703';
      const punchOffset = gameState.isPunching ? -35 : 0;
      ctx.beginPath();
      ctx.arc(px - 50, py + punchOffset, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 50, py + punchOffset, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (gameState.mode === 'soccer') {
      // Goalkeeper Gloves
      ctx.font = '55px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧤', px - 40, py);
      ctx.fillText('🧤', px + 40, py);
    }
    ctx.restore();
  }

  // Main Game Loop (Always renders player and grid at 60 FPS)
  function gameLoop(now) {
    const dt = (now - gameState.lastFrameTime) / 1000;
    gameState.lastFrameTime = now;

    // Ultra-smooth and responsive player position interpolation
    let targetX = 0.5 + (motionData.tiltX * 0.46);
    if (targetX < 0.06) targetX = 0.06;
    if (targetX > 0.94) targetX = 0.94;
    gameState.playerX += (targetX - gameState.playerX) * 0.52;

    // Clear and Render Scene
    ctx.clearRect(0, 0, width, height);
    drawPerspectiveGrid(ctx, width, height);

    // If game is active, update targets and collision
    if (gameState.running) {
      if (now - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnTarget();
        gameState.lastSpawnTime = now;
        if (gameState.spawnInterval > 650) {
          gameState.spawnInterval -= 10;
        }
      }

      for (let i = 0; i < gameState.targets.length; i++) {
        gameState.targets[i].update();
        gameState.targets[i].draw(ctx, width, height);
      }

      checkCollisions();
    }

    // Always Render Player
    drawPlayer(ctx, width, height);

    // Render Sliced Fruit Halves
    for (let i = gameState.fruitHalves.length - 1; i >= 0; i--) {
      gameState.fruitHalves[i].update();
      gameState.fruitHalves[i].draw(ctx);
      if (gameState.fruitHalves[i].alpha <= 0) {
        gameState.fruitHalves.splice(i, 1);
      }
    }

    // Render Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      gameState.particles[i].update();
      gameState.particles[i].draw(ctx);
      if (gameState.particles[i].life <= 0) {
        gameState.particles.splice(i, 1);
      }
    }

    // Render Floating Text
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
      gameState.floatingTexts[i].update();
      gameState.floatingTexts[i].draw(ctx);
      if (gameState.floatingTexts[i].life <= 0) {
        gameState.floatingTexts.splice(i, 1);
      }
    }

    // Single-frame triggers reset
    gameState.isSwinging = false;
    gameState.isPunching = false;

    requestAnimationFrame(gameLoop);
  }

  // Start / End Game
  function startGame() {
    initAudio();
    gameState.running = true;
    gameState.score = 0;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.hits = 0;
    gameState.totalTargets = 0;
    gameState.health = 100;
    gameState.targets = [];
    gameState.particles = [];
    gameState.fruitHalves = [];
    gameState.floatingTexts = [];
    gameState.spawnInterval = 1000;
    gameState.lastFrameTime = performance.now();
    gameState.lastSpawnTime = performance.now();

    scoreEl.textContent = '0';
    comboEl.textContent = '0x';

    lobbyModal.classList.remove('active');
    gameoverModal.classList.remove('active');
  }

  function endGame() {
    gameState.running = false;
    finalScoreEl.textContent = gameState.score;
    maxComboEl.textContent = `${gameState.maxCombo}x`;
    const acc = gameState.totalTargets > 0 ? Math.round((gameState.hits / gameState.totalTargets) * 100) : 100;
    accuracyEl.textContent = `${acc}%`;
    gameoverModal.classList.add('active');
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Mode Selection on TV Screen
  document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      gameState.mode = card.dataset.mode;
      initAudio();
      playTone(587.33, 'sine', 0.1, 0.3);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'game_mode_changed', mode: gameState.mode }));
      }
    });
  });

  // WebSocket Connection to Server
  let ws = null;
  function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'register',
        role: 'tv',
        roomId: ROOM_ID
      }));
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        } else if (raw instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(raw);
        }
        const msg = JSON.parse(raw);

        if (msg.type === 'registered') {
          updatePhoneStatus(msg.phoneConnected);
          if (msg.tunnelUrl) {
            renderPhoneQr(`${msg.tunnelUrl}/phone?room=${ROOM_ID}`);
          }
        } else if (msg.type === 'tunnel_ready') {
          if (msg.tunnelUrl) {
            renderPhoneQr(`${msg.tunnelUrl}/phone?room=${ROOM_ID}`);
          }
        } else if (msg.type === 'peer_status') {
          updatePhoneStatus(msg.phoneConnected);
        } else if (msg.type === 'mode_select') {
          controllerModeDisplay.textContent = msg.mode;
        } else if (msg.type === 'select_game_mode') {
          // Phone chose a new game!
          if (msg.mode === 'mario') { window.location.href = `/mario?room=${ROOM_ID}`; return; }
          if (msg.mode === 'romp') { window.location.href = `/romp-tv?room=${ROOM_ID}`; return; }
          gameState.mode = msg.mode;
          document.querySelectorAll('.mode-card').forEach((c) => {
            c.classList.toggle('active', c.dataset.mode === msg.mode);
          });
          initAudio();
          playTone(523.25, 'triangle', 0.1, 0.3);
          setTimeout(() => playTone(783.99, 'sine', 0.15, 0.35), 70);
          gameState.floatingTexts.push(new FloatingText(`SWITCHED: ${msg.mode.toUpperCase()}!`, width / 2, height * 0.4, '#00f0ff', 36));
        } else if (msg.type === 'start_game') {
          startGame();
        } else if (msg.type === 'switch_to_romp') {
          // Open ROMP-TV wrapper — phone body camera controls ROMP on this TV
          window.location.href = '/romp-tv?room=' + ROOM_ID;
        } else if (msg.type === 'switch_to_neon') {
          window.location.href = '/tv';
        } else if (msg.type === 'motion' || msg.type === 'tilt') {
          handlePhoneMotion(msg);
        } else if (msg.type === 'swing') {
          handlePhoneSwing(msg);
        } else if (msg.type === 'punch') {
          handlePhonePunch(msg);
        } else if (msg.type === 'pose') {
          handlePhonePose(msg);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onclose = () => {
      updatePhoneStatus(false);
      setTimeout(connectWebSocket, 2000);
    };
  }

  function updatePhoneStatus(connected) {
    if (connected) {
      connDot.classList.remove('disconnected');
      connDot.classList.add('connected');
      connText.textContent = 'PHONE CONNECTED';
      startBtn.disabled = false;
      startBtn.textContent = 'START GAME (PRESS TO PLAY)';
      startBtn.classList.add('active');
    } else {
      connDot.classList.remove('connected');
      connDot.classList.add('disconnected');
      connText.textContent = 'WAITING FOR PHONE...';
      startBtn.disabled = true;
      startBtn.textContent = 'WAITING FOR PHONE TO CONNECT...';
    }
  }

  function handlePhoneMotion(msg) {
    controllerModeDisplay.textContent = 'Handheld Sensors (IMU)';
    if (msg.tiltX !== undefined) {
      motionData.tiltX = Math.max(-1, Math.min(1, msg.tiltX));
    } else if (msg.gamma !== undefined) {
      const norm = Math.max(-1, Math.min(1, msg.gamma / 24));
      const sign = norm < 0 ? -1 : 1;
      motionData.tiltX = sign * Math.pow(Math.abs(norm), 1.15);
    }
    if (msg.accelMag !== undefined) {
      motionData.accelMag = msg.accelMag;
    }
    if (msg.bladeAngle !== undefined) {
      gameState.bladeAngle = msg.bladeAngle;
    }
    if (msg.latency !== undefined) {
      latencyDisplay.textContent = `${msg.latency} ms`;
    }
  }

  function handlePhoneSwing(msg) {
    gameState.isSwinging = true;
    gameState.swingActiveUntil = performance.now() + 250;
    gameState.swingDir = msg.direction || 'slash';
    playSwingSound();
    if (gameState.inLobby) {
      startGame();
    }
  }

  function handlePhonePunch(msg) {
    gameState.isPunching = true;
    gameState.punchActiveUntil = performance.now() + 250;
    playPunchSound();
  }

  function handlePhonePose(msg) {
    controllerModeDisplay.textContent = 'Optical Body Tracking';
    if (msg.bodyX !== undefined) {
      motionData.tiltX = (msg.bodyX - 0.5) * 2.2;
    }
    if (msg.isPunching) {
      gameState.isPunching = true;
      gameState.punchActiveUntil = performance.now() + 250;
      if (gameState.inLobby) {
        startGame();
      }
    }
    if (msg.isSwinging) {
      gameState.isSwinging = true;
      gameState.swingActiveUntil = performance.now() + 250;
      playSwingSound();
      if (gameState.inLobby) {
        startGame();
      }
    }
    if (msg.latency !== undefined) {
      latencyDisplay.textContent = `${msg.latency} ms`;
    }
  }

  function sendHapticFeedback(duration = 60) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'haptic',
        duration: duration
      }));
    }
  }

  function renderPhoneQr(phoneUrl) {
    phoneUrlDisplay.textContent = phoneUrl;
    if (phoneUrl.startsWith('https:')) {
      const badge = document.getElementById('tunnel-badge');
      if (badge) badge.style.display = 'block';
    }
    const qrEl = document.getElementById('qr-code');
    if (!qrEl) return;
    qrEl.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrEl, {
        text: phoneUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // Fetch Server Info & Generate QR Code (Prefer HTTPS Tunnel for instant mobile camera support)
  fetch('/api/info')
    .then((r) => r.json())
    .then((info) => {
      const isTunnel = window.location.protocol === 'https:' || window.location.hostname.includes('trycloudflare.com');
      const phoneUrl = info.tunnelUrl
        ? `${info.tunnelUrl}/phone?room=${ROOM_ID}`
        : (isTunnel ? `${window.location.origin}/phone?room=${ROOM_ID}` : `http://${info.localIp}:${info.port}/phone?room=${ROOM_ID}`);

      renderPhoneQr(phoneUrl);
    })
    .catch(() => {
      renderPhoneQr(`${window.location.origin}/phone?room=${ROOM_ID}`);
    });

  // Navigation to Romp Games
  const rompHeaderBtn = document.getElementById('btn-romp-header');
  if (rompHeaderBtn) {
    rompHeaderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `/romp-tv?room=${ROOM_ID}`;
    });
  }
  const rompLobbyBtn = document.getElementById('btn-launch-romp-lobby');
  if (rompLobbyBtn) {
    rompLobbyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `/romp-tv?room=${ROOM_ID}`;
    });
  }

  // Start Connection and Render Loop
  connectWebSocket();
  requestAnimationFrame(gameLoop);
})();
