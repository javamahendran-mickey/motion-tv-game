// Android Motion Controller & Full-Body Pose Tracker Client
(function () {
  'use strict';

  // Room ID (Persistent in localStorage so phone always remembers this TV!)
  const urlParams = new URLSearchParams(window.location.search);
  let paramRoom = urlParams.get('room');
  if (paramRoom) {
    try { localStorage.setItem('phone_last_room', paramRoom); } catch (e) {}
  }
  let savedRoom = null;
  try { savedRoom = localStorage.getItem('phone_last_room'); } catch (e) {}
  let ROOM_ID = paramRoom || savedRoom || 'MAIN';
  function updateRompLinks() {
    const lp = document.getElementById('link-play-romp-phone');
    if (lp) lp.href = '/romp/?room=' + encodeURIComponent(ROOM_ID) + '&cast=1';
    const tr = document.getElementById('tab-romp');
    if (tr) tr.href = '/romp/?room=' + encodeURIComponent(ROOM_ID) + '&cast=1';
  }
  setTimeout(updateRompLinks, 500);

  // DOM Elements
  const bulb = document.getElementById('bulb');
  const statusLabel = document.getElementById('status-label');
  const pingBadge = document.getElementById('ping-badge');
  const tabHandheld = document.getElementById('tab-handheld');
  const tabBody = document.getElementById('tab-body');
  const viewHandheld = document.getElementById('view-handheld');
  const viewBody = document.getElementById('view-body');
  const phone3D = document.getElementById('phone-3d');
  const intensityVal = document.getElementById('intensity-val');
  const intensityFill = document.getElementById('intensity-fill');
  const btnStrike = document.getElementById('btn-strike');
  const btnCalibrate = document.getElementById('btn-calibrate');
  const btnInvertDir = document.getElementById('btn-invert-dir');
  const btnPermission = document.getElementById('btn-permission');
  const btnStartTv = document.getElementById('btn-start-tv');
  const btnStartTvBody = document.getElementById('btn-start-tv-body');
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnFlipCamera = document.getElementById('btn-flip-camera');
  const btnInvertBody = document.getElementById('btn-invert-body');
  const webcamFeed = document.getElementById('webcam-feed');
  const poseCanvas = document.getElementById('pose-canvas');
  const poseCanvasCtx = poseCanvas ? poseCanvas.getContext('2d') : null;
  const poseBadge = document.getElementById('pose-badge');
  const diagTilt = document.getElementById('diag-tilt');
  const diagG = document.getElementById('diag-g');
  const diagPackets = document.getElementById('diag-packets');
  const diagBodyX = document.getElementById('diag-body-x');
  const diagBodyPunch = document.getElementById('diag-body-punch');
  const diagBodyEngine = document.getElementById('diag-body-engine');
  const httpsHelperBanner = document.getElementById('https-helper-banner');
  const httpsSwitchLink = document.getElementById('https-switch-link');
  const btnDismissBanner = document.getElementById('btn-dismiss-banner');

  let activeMode = 'handheld'; // 'handheld' or 'body'
  let ws = null;
  let lastPingTime = 0;
  let currentLatency = 0;
  let packetsSent = 0;
  let lastMotionSendTime = 0;
  let invertDirection = false;
  let invertBody = true; // default mirrored for front selfie camera
  let currentFacingMode = 'user'; // 'user' or 'environment'

  // Sensor State
  let gyroOffset = { beta: 0, gamma: 0 };
  let currentOrientation = { beta: 0, gamma: 0, alpha: 0 };
  let filteredGamma = 0;
  let filteredBeta = 0;
  let lastSentGamma = 0;
  let lastMagnitude = 1.0;
  let lastAccelTime = performance.now();
  let lastAccel = { x: 0, y: 0, z: 0 };
  let lastSwingTime = 0;
  let sensorsActive = false;

  // Haptic feedback
  function vibrate(ms = 50) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  // Check Secure Context & Fetch HTTPS Tunnel Info
  if (btnDismissBanner) {
    btnDismissBanner.addEventListener('click', () => {
      httpsHelperBanner.style.display = 'none';
    });
  }

  fetch('/api/info')
    .then(r => r.json())
    .then(info => {
      if (info.tunnelUrl && window.location.protocol !== 'https:') {
        if (httpsHelperBanner && httpsSwitchLink) {
          httpsSwitchLink.href = `${info.tunnelUrl}/phone?room=${ROOM_ID}`;
          httpsHelperBanner.style.display = 'block';
        }
      }
    })
    .catch(() => {});

  // Tab Switching
  if (tabHandheld) tabHandheld.addEventListener('click', () => {
    activeMode = 'handheld';
    tabHandheld.classList.add('active');
    tabBody.classList.remove('active');
    viewHandheld.classList.add('active');
    viewBody.classList.remove('active');
    stopCameraTracking();
    sendModeSelect('Handheld Sensors (IMU)');
  });

  if (tabBody) tabBody.addEventListener('click', () => {
    activeMode = 'body';
    tabBody.classList.add('active');
    tabHandheld.classList.remove('active');
    viewBody.classList.add('active');
    viewHandheld.classList.remove('active');
    sendModeSelect('Optical Body Tracking');
  });

  function sendModeSelect(modeName) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'mode_select',
        mode: modeName
      }));
    }
  }

  // Quick Game Selector across both tabs
  function syncGameButtons(chosenGame) {
    checkMarioMode(chosenGame);
    document.querySelectorAll('.game-pill-btn').forEach((btn) => {
      if (btn.dataset.game === chosenGame) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  document.querySelectorAll('.game-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosenGame = btn.dataset.game;
      syncGameButtons(chosenGame);
      // Mario mode button styling
      if (chosenGame === 'mario') {
        const strikeBtn = document.getElementById('btn-strike');
        if (strikeBtn) {
          const btnText = strikeBtn.querySelector('.btn-text');
          const btnSub = strikeBtn.querySelector('.btn-subtext');
          if (btnText) btnText.textContent = '🦘 JUMP / 🔥 FIREBALL';
          if (btnSub) btnSub.textContent = '(Flick up to leap, punch for fireballs!)';
        }
      }
  
      vibrate(50);
      initSensors();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'select_game_mode',
          mode: chosenGame
        }));
      }
    });
  });

  // Start Game on TV Buttons
  function triggerStartGame() {
    vibrate(60);
    initSensors();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'start_game' }));
      [btnStartTv, btnStartTvBody].forEach(btn => {
        if (btn) {
          btn.textContent = '⚡ GAME RUNNING ON TV';
          setTimeout(() => { btn.textContent = '▶️ RESTART GAME ON TV'; }, 2000);
        }
      });
    }
  }

  if (btnStartTv) btnStartTv.addEventListener('click', triggerStartGame);
  if (btnStartTvBody) btnStartTvBody.addEventListener('click', triggerStartGame);

  // Strike Button Click
  if (btnStrike) {
    btnStrike.addEventListener('click', () => {
      vibrate(50);
      if (ws && ws.readyState === WebSocket.OPEN) {
        packetsSent++;
        if (diagPackets) diagPackets.textContent = packetsSent;
        ws.send(JSON.stringify({
          type: 'swing',
          direction: 'strike',
          magnitude: 3.0
        }));
      }
    });
  }

  // WebSocket Connection
  function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'register',
        role: 'phone',
        roomId: ROOM_ID
      }));
      bulb.classList.remove('disconnected');
      bulb.classList.add('connected');
      statusLabel.textContent = `LINKED: ${ROOM_ID}`;
      sendModeSelect(activeMode === 'handheld' ? 'Handheld Sensors (IMU)' : 'Optical Body Tracking');
      startPingLoop();
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        }
        const msg = JSON.parse(raw);
        if (msg.type === 'haptic') {
          vibrate(msg.duration || 60);
        } else if (msg.type === 'peer_status') {
          if (msg.roomId) {
            ROOM_ID = msg.roomId; updateRompLinks();
            try { localStorage.setItem('phone_last_room', msg.roomId); } catch (e) {}
          }
          if (msg.tvConnected) {
            statusLabel.textContent = 'TV CONNECTED';
            sendModeSelect(activeMode === 'handheld' ? 'Handheld Sensors (IMU)' : 'Optical Body Tracking');
          }
        } else if (msg.type === 'registered') {
          if (msg.roomId) {
            ROOM_ID = msg.roomId; updateRompLinks();
            try { localStorage.setItem('phone_last_room', msg.roomId); } catch (e) {}
          }
          if (msg.tunnelUrl && window.location.protocol !== 'https:') {
            if (httpsHelperBanner && httpsSwitchLink) {
              httpsSwitchLink.href = `${msg.tunnelUrl}/phone?room=${ROOM_ID}`;
              httpsHelperBanner.style.display = 'block';
            }
          }
        } else if (msg.type === 'tunnel_ready') {
          if (msg.tunnelUrl && window.location.protocol !== 'https:') {
            if (httpsHelperBanner && httpsSwitchLink) {
              httpsSwitchLink.href = `${msg.tunnelUrl}/phone?room=${ROOM_ID}`;
              httpsHelperBanner.style.display = 'block';
            }
          }
        } else if (msg.type === 'pong') {
          currentLatency = Date.now() - lastPingTime;
          pingBadge.textContent = `${currentLatency} ms`;
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      bulb.classList.remove('connected');
      bulb.classList.add('disconnected');
      statusLabel.textContent = 'RECONNECTING...';
      setTimeout(connectWebSocket, 1000);
    };
  }

  function startPingLoop() {
    setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        lastPingTime = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 3000);
  }

  // =========================================================================
  // HIGH-PRECISION SENSOR & TOUCH HYBRID ENGINE (IMU Mode)
  // =========================================================================
  let isTouchingVisualizer = false;
  let touchStartX = 0;
  let touchStartGamma = 0;

  function sendMotionPacket(forceHeartbeat = false) {
    const now = performance.now();
    const dt = now - lastMotionSendTime;
    const angleDiff = Math.abs(filteredGamma - lastSentGamma);

    // Send at ~60Hz on movement, or at least every 50ms as a heartbeat when held stationary
    if (angleDiff > 0.3 || (forceHeartbeat && dt > 16) || dt > 50) {
      lastMotionSendTime = now;
      lastSentGamma = filteredGamma;
      packetsSent++;
      if (diagPackets) diagPackets.textContent = packetsSent;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'motion',
          gamma: filteredGamma,
          beta: filteredBeta,
          tiltX: Math.max(-1, Math.min(1, filteredGamma / 14.0)),
          bladeAngle: -filteredGamma,
          accelMag: lastMagnitude,
          latency: currentLatency
        }));
      }
    }
  }

  function handleOrientation(e) {
    if (activeMode !== 'handheld') return;
    if (e.beta === null && e.gamma === null) return;
    sensorsActive = true;

    const rawBeta = e.beta || 0;
    const rawGamma = e.gamma || 0;
    currentOrientation.beta = rawBeta;
    currentOrientation.gamma = rawGamma;

    // Ignore gyro updates while player is touching/swiping the screen
    if (isTouchingVisualizer) return;

    const unadjustedBeta = rawBeta - gyroOffset.beta;
    const unadjustedGamma = rawGamma - gyroOffset.gamma;

    const orientationAngle = (screen.orientation && screen.orientation.angle !== undefined)
      ? screen.orientation.angle
      : (window.orientation || 0);

    let baseSteer = 0;
    if (orientationAngle === 90) {
      baseSteer = -unadjustedBeta;
    } else if (orientationAngle === 270 || orientationAngle === -90) {
      baseSteer = unadjustedBeta;
    } else if (orientationAngle === 180) {
      baseSteer = -unadjustedGamma;
    } else {
      baseSteer = unadjustedGamma;
    }

    if (invertDirection) baseSteer = -baseSteer;

    const steerDiff = Math.abs(baseSteer - filteredGamma);
    const alpha = steerDiff > 6 ? 0.8 : 0.4;
    filteredGamma = filteredGamma * (1 - alpha) + baseSteer * alpha;
    filteredBeta = filteredBeta * 0.7 + unadjustedBeta * 0.3;

    if (phone3D) {
      phone3D.style.transform = `rotateZ(${-filteredGamma * 0.8}deg) rotateX(${filteredBeta * 0.5}deg)`;
    }

    if (diagTilt) diagTilt.textContent = `${Math.round(filteredGamma)}°`;
    sendMotionPacket();
  }

  function handleMotion(e) {
    if (activeMode !== 'handheld') return;
    sensorsActive = true;

    // Check pure linear user acceleration (no gravity) first
    const linear = e.acceleration;
    let linearMag = 0;
    if (linear && (linear.x !== null || linear.y !== null || linear.z !== null)) {
      linearMag = Math.sqrt((linear.x || 0)**2 + (linear.y || 0)**2 + (linear.z || 0)**2);
    }

    // Gravity-included fallback
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    const totalMag = Math.sqrt(x * x + y * y + z * z) / 9.80665;
    lastMagnitude = totalMag;

    if (intensityVal) intensityVal.textContent = `${totalMag.toFixed(1)} G`;
    if (diagG) diagG.textContent = `${totalMag.toFixed(1)}G`;

    const pct = Math.min(100, Math.max(0, (totalMag - 1.0) / 2.5 * 100));
    if (intensityFill) intensityFill.style.width = `${pct}%`;

    const now = performance.now();
    const dt = (now - lastAccelTime) / 1000;
    lastAccelTime = now;

    let totalJerk = 0;
    if (dt > 0.005 && dt < 0.2) {
      const jerkX = Math.abs(x - lastAccel.x) / dt;
      const jerkY = Math.abs(y - lastAccel.y) / dt;
      const jerkZ = Math.abs(z - lastAccel.z) / dt;
      totalJerk = Math.sqrt(jerkX * jerkX + jerkY * jerkY + jerkZ * jerkZ);
    }

    // Highly responsive strike condition:
    // Either pure linear acceleration > 8.5 m/s² OR total G > 1.48 OR jerk > 18
    const isSwing = (linearMag > 8.5) || (totalMag > 1.48) || (totalJerk > 18);

    if (isSwing && (now - lastSwingTime > 180)) {
      lastSwingTime = now;
      vibrate(45);
      let dir = 'slash';
      if (Math.abs(x) > Math.abs(y) && Math.abs(x) > Math.abs(z)) {
        dir = x > 0 ? 'right' : 'left';
      } else if (Math.abs(y) > Math.abs(z)) {
        dir = y > 0 ? 'up' : 'down';
      } else {
        dir = 'punch';
      }

      packetsSent++;
      if (diagPackets) diagPackets.textContent = packetsSent;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'swing',
          direction: dir,
          magnitude: Math.max(totalMag, linearMag / 9.8),
          jerk: totalJerk
        }));
      }
    }

    lastAccel = { x, y, z };
  }

  // Touch and Drag Controls on the 3D Mockup Container (Zero-Fail Fallback)
  const visualizerEl = document.querySelector('.visualizer-container');
  if (visualizerEl) {
    visualizerEl.addEventListener('touchstart', (e) => {
      isTouchingVisualizer = true;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartGamma = filteredGamma;
      initSensors();
    }, { passive: true });

    visualizerEl.addEventListener('touchmove', (e) => {
      if (!isTouchingVisualizer) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const rect = visualizerEl.getBoundingClientRect();
      const sensitivity = 35.0 / (rect.width * 0.5);

      filteredGamma = Math.max(-25, Math.min(25, touchStartGamma + deltaX * sensitivity));
      if (phone3D) {
        phone3D.style.transform = `rotateZ(${-filteredGamma * 0.8}deg)`;
      }
      if (diagTilt) diagTilt.textContent = `${Math.round(filteredGamma)}°`;
      sendMotionPacket(true);
    }, { passive: true });

    visualizerEl.addEventListener('touchend', (e) => {
      isTouchingVisualizer = false;
      // Quick tap without dragging triggers a swing
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
        if (deltaX < 12) {
          vibrate(50);
          if (ws && ws.readyState === WebSocket.OPEN) {
            packetsSent++;
            if (diagPackets) diagPackets.textContent = packetsSent;
            ws.send(JSON.stringify({ type: 'swing', direction: 'strike', magnitude: 3.0 }));
          }
        }
      }
    });
  }

  async function initSensors() {
    sensorsActive = true;

    // iOS 13+ DeviceOrientation permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') attachListeners();
      } catch (e) {}
    }

    // iOS 13+ DeviceMotion permission
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const state = await DeviceMotionEvent.requestPermission();
        if (state === 'granted') attachListeners();
      } catch (e) {}
    }

    attachListeners();

    if (btnPermission) {
      btnPermission.textContent = '✅ SENSORS ACTIVE';
      btnPermission.style.borderColor = '#00f59b';
      btnPermission.style.color = '#00f59b';
    }
  }

  function attachListeners() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('devicemotion', handleMotion, true);
  }

  if (btnPermission) {
    btnPermission.addEventListener('click', () => {
      initSensors();
      vibrate(50);
    });
  }

  if (btnCalibrate) {
    btnCalibrate.addEventListener('click', () => {
      gyroOffset.beta = currentOrientation.beta;
      gyroOffset.gamma = currentOrientation.gamma;
      filteredGamma = 0;
      if (phone3D) phone3D.style.transform = 'rotateZ(0deg) rotateX(0deg)';
      if (diagTilt) diagTilt.textContent = '0°';
      vibrate(30);
      sendMotionPacket(true);
    });
  }

  if (btnInvertDir) {
    btnInvertDir.addEventListener('click', () => {
      invertDirection = !invertDirection;
      btnInvertDir.textContent = invertDirection ? '↔️ STEER: INVERTED' : '↔️ STEER: NORMAL';
      vibrate(30);
    });
  }

  document.body.addEventListener('touchstart', initSensors, { once: true, passive: true });
  document.body.addEventListener('click', initSensors, { once: true });
  attachListeners();

  // =========================================================================
  // OPTICAL FULL-BODY CAMERA TRACKING ENGINE (Dual-Engine: Optical Flow + MediaPipe)
  // =========================================================================
  let mediaStream = null;
  let isCameraActive = false;
  let animFrameId = null;
  let poseDetector = null;
  let mediaPipeActive = false;

  // Real-time Optical Motion Filter State
  const DIFF_W = 64;
  const DIFF_H = 48;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = DIFF_W;
  diffCanvas.height = DIFF_H;
  const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true });
  let prevFrameData = null;
  let smoothedBodyX = 0.5;
  let lastPoseSendTime = 0;
  let lastPunchTime = 0;
  let prevMotionCount = 0;

  // Camera Flip & Mirror Controls
  if (btnFlipCamera) {
    btnFlipCamera.addEventListener('click', async () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      vibrate(30);
      if (isCameraActive) {
        stopCameraTracking();
        await startCameraTracking();
      }
    });
  }

  if (btnInvertBody) {
    btnInvertBody.addEventListener('click', () => {
      invertBody = !invertBody;
      btnInvertBody.textContent = invertBody ? '↔️ MIRROR: ON' : '↔️ MIRROR: OFF';
      vibrate(30);
    });
  }

  // MediaPipe Pose Initialization (Background loader)
  function setupMediaPipePose() {
    if (typeof window.Pose === 'function') {
      try {
        poseDetector = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });
        poseDetector.setOptions({
          modelComplexity: 0, // Lite model for mobile 60 FPS performance
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        poseDetector.onResults(onMediaPipeResults);
        mediaPipeActive = true;
        if (diagBodyEngine) diagBodyEngine.textContent = 'MediaPipe 33-Keypoint';
      } catch (err) {
        mediaPipeActive = false;
      }
    }
  }

  // 33-Point MediaPipe Anatomical Skeleton Topology
  const SKELETON_CONNECTIONS = [
    // Head / Facial Features
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // Torso Frame
    [11, 12], // Shoulder to shoulder
    [11, 23], // Left torso side
    [12, 24], // Right torso side
    [23, 24], // Hip to hip
    // Left Arm
    [11, 13], [13, 15],
    [15, 17], [15, 19], [15, 21],
    // Right Arm
    [12, 14], [14, 16],
    [16, 18], [16, 20], [16, 22],
    // Left Leg
    [23, 25], [25, 27], [27, 29], [27, 31],
    // Right Leg
    [24, 26], [26, 28], [28, 30], [28, 32]
  ];

  function drawMediaPipeSkeleton(ctx, landmarks, w, h, isJumping, isPunching, activeLane) {
    ctx.save();
    const boneColor = isJumping ? '#ffd700' : (isPunching ? '#ff3366' : '#00f0ff');
    const glowColor = isJumping ? 'rgba(255, 215, 0, 0.9)' : (isPunching ? 'rgba(255, 51, 102, 0.9)' : 'rgba(0, 240, 255, 0.8)');

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = boneColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    // Draw all anatomical bone lines
    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && (p1.visibility === undefined || p1.visibility > 0.25) && (p2.visibility === undefined || p2.visibility > 0.25)) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    });

    // Draw central spine connection
    const ls = landmarks[11], rs = landmarks[12];
    const lh = landmarks[23], rh = landmarks[24];
    if (ls && rs && lh && rh) {
      const midShoulderX = ((ls.x + rs.x) / 2) * w;
      const midShoulderY = ((ls.y + rs.y) / 2) * h;
      const midHipX = ((lh.x + rh.x) / 2) * w;
      const midHipY = ((lh.y + rh.y) / 2) * h;
      ctx.beginPath();
      ctx.moveTo(midShoulderX, midShoulderY);
      ctx.lineTo(midHipX, midHipY);
      ctx.stroke();
    }

    // Draw glowing joint nodes
    landmarks.forEach((pt, idx) => {
      if (pt && (pt.visibility === undefined || pt.visibility > 0.3)) {
        const px = pt.x * w;
        const py = pt.y * h;
        const isMajor = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(idx);
        const radius = isMajor ? 6.5 : 4;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = isJumping ? '#ffffff' : (isPunching ? '#ff3366' : '#00ff88');
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    });

    // Draw Head Halo Reticle
    const nose = landmarks[0];
    if (nose && (nose.visibility === undefined || nose.visibility > 0.35)) {
      const hx = nose.x * w;
      const hy = nose.y * h;
      const radius = (ls && rs) ? Math.max(20, Math.abs(ls.x - rs.x) * w * 0.45) : 24;
      ctx.beginPath();
      ctx.arc(hx, hy - 4, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw Wireframe Status Text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 13px monospace';
    ctx.shadowBlur = 6;
    ctx.fillText(`🟢 33-POINT SKELETON: ${activeLane.toUpperCase()}`, 14, 24);

    ctx.restore();
  }

  function drawOpticalWireframe(ctx, w, h, minX, maxX, minY, maxY, centroidX, centroidY, isJumping, isPunching, activeLane) {
    ctx.save();
    const color = isJumping ? '#ffd700' : (isPunching ? '#ff3366' : '#00f0ff');
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3.5;

    const sx = w / DIFF_W;
    const sy = h / DIFF_H;

    const boxX = Math.max(10, minX * sx);
    const boxY = Math.max(10, minY * sy);
    const boxW = Math.min(w - boxX - 10, Math.max(80, (maxX - minX) * sx));
    const boxH = Math.min(h - boxY - 10, Math.max(120, (maxY - minY) * sy));

    const cX = Math.max(boxX + 20, Math.min(boxX + boxW - 20, centroidX * sx));
    const cY = Math.max(boxY + 40, Math.min(boxY + boxH - 40, centroidY * sy));
    const headX = cX;
    const headY = boxY + 22;

    // 1. Cybernetic Bounding Target Box with Corner Reticles
    const corner = 22;
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + corner); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + corner, boxY);
    ctx.moveTo(boxX + boxW - corner, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + corner);
    ctx.moveTo(boxX, boxY + boxH - corner); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX + corner, boxY + boxH);
    ctx.moveTo(boxX + boxW - corner, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH - corner);
    ctx.stroke();

    // 2. Optical Stick Wireframe Skeleton
    // Head
    ctx.beginPath();
    ctx.arc(headX, headY, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Spine
    ctx.beginPath();
    ctx.moveTo(headX, headY + 18);
    ctx.lineTo(cX, cY + 30);
    ctx.stroke();

    // Arms
    const shoulderY = headY + 28;
    const armSpread = isPunching ? 55 : 40;
    const armAngleY = isJumping ? -35 : (isPunching ? 5 : 25);
    ctx.beginPath();
    ctx.moveTo(headX - armSpread, shoulderY + armAngleY);
    ctx.lineTo(headX, shoulderY);
    ctx.lineTo(headX + armSpread, shoulderY + armAngleY);
    ctx.stroke();

    // Hips & Legs
    const hipY = cY + 30;
    const footSpread = 32;
    ctx.beginPath();
    ctx.moveTo(cX - footSpread, boxY + boxH);
    ctx.lineTo(cX, hipY);
    ctx.lineTo(cX + footSpread, boxY + boxH);
    ctx.stroke();

    // Joint Nodes
    const joints = [
      [headX, headY],
      [headX, shoulderY],
      [headX - armSpread, shoulderY + armAngleY],
      [headX + armSpread, shoulderY + armAngleY],
      [cX, hipY],
      [cX - footSpread, boxY + boxH],
      [cX + footSpread, boxY + boxH]
    ];

    joints.forEach(([jx, jy]) => {
      ctx.beginPath();
      ctx.arc(jx, jy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(jx, jy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });

    // Reticle Status Text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`⚡ WIREFRAME LOCKED: ${activeLane.toUpperCase()}`, boxX + 8, boxY - 10);

    ctx.restore();
  }

  let lastWristY = 0;
  let lastLeftWristY = 0;
  let isPoseBusy = false;
  let lastMediaPipeSuccessTime = 0;

  function onMediaPipeResults(results) {
    if (!isCameraActive || activeMode !== 'body') return;

    poseCanvas.width = webcamFeed.videoWidth || 640;
    poseCanvas.height = webcamFeed.videoHeight || 480;
    poseCanvasCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);

    if (results.poseLandmarks) {
      lastMediaPipeSuccessTime = Date.now();
      if (diagBodyEngine) diagBodyEngine.textContent = 'MediaPipe 33-Keypoint';

      const lm = results.poseLandmarks;
      const nose = lm[0];
      const leftShoulder = lm[11];
      const rightShoulder = lm[12];
      const leftWrist = lm[15];
      const rightWrist = lm[16];

      const rawTorsoX = (leftShoulder.x + rightShoulder.x) / 2;
      const torsoY = (leftShoulder.y + rightShoulder.y) / 2;

      // Correct Direction Mapping:
      // When user moves to their RIGHT, Mario must move RIGHT!
      // When user moves to their LEFT, Mario must move LEFT!
      const effectiveX = invertBody ? rawTorsoX : (1.0 - rawTorsoX);
      let lane = 'center';
      if (effectiveX > 0.58) lane = 'right';
      else if (effectiveX < 0.42) lane = 'left';

      // 1. Jump Detection: Hands raised above shoulders OR vertical jump
      const handsUp = (leftWrist && leftShoulder && leftWrist.y < leftShoulder.y) || 
                      (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y);
      const verticalRise = (prevNoseY - (nose ? nose.y : torsoY)) > 0.035;
      const isJumping = handsUp || verticalRise;
      prevNoseY = nose ? nose.y : torsoY;

      // 2. Duck Detection: Torso drops
      const isDucking = torsoY > 0.68;

      // 3. Punch Detection: High wrist velocity
      const wristSpeed = Math.abs(rightWrist.y - lastWristY) + Math.abs(leftWrist.y - lastLeftWristY);
      lastWristY = rightWrist.y;
      lastLeftWristY = leftWrist.y;
      const isPunching = wristSpeed > 0.11;

      // Draw Full 33-Keypoint Anatomical Wireframe Skeleton
      drawMediaPipeSkeleton(poseCanvasCtx, lm, poseCanvas.width, poseCanvas.height, isJumping, isPunching, lane);

      poseBadge.textContent = `BODY: ${lane.toUpperCase()} ${isJumping ? '🦘' : ''}`;
      poseBadge.classList.add('tracking');

      updatePhoneVisualFeedback(lane, isJumping, isPunching);

      let normBodyX = 0.50;
      if (lane === 'right') normBodyX = 0.80;
      else if (lane === 'left') normBodyX = 0.20;

      lastRawLandmarks = lm; // save for ROMP pose relay
      sendBodyPoseDirect(normBodyX, torsoY, lane, isJumping, isDucking, isPunching);
    }
  }

  // =========================================================================
  // ROBUST MULTI-FRAME TEMPORAL ENERGY & SPATIAL TRACKER (60 FPS Pure JS)
  // =========================================================================
  const FRAME_HISTORY_CAP = 5;
  const frameHistory = [];
  let currentActiveLane = 'center';
  let laneHoldFrames = 0;
  let lastJumpSendTime = 0;
  let lastPunchSendTime = 0;

  function updatePhoneVisualFeedback(lane, isJump, isPunch) {
    const leftEl = document.getElementById('hud-lane-left');
    const centerEl = document.getElementById('hud-lane-center');
    const rightEl = document.getElementById('hud-lane-right');
    const jumpEl = document.getElementById('hud-action-jump');
    const fireEl = document.getElementById('hud-action-fire');

    if (leftEl && centerEl && rightEl) {
      if (lane === 'left') {
        leftEl.style.background = '#00ff88';
        leftEl.style.color = '#000';
        leftEl.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.6)';
        centerEl.style.background = 'transparent';
        centerEl.style.color = '#64748b';
        centerEl.style.boxShadow = 'none';
        rightEl.style.background = 'transparent';
        rightEl.style.color = '#64748b';
        rightEl.style.boxShadow = 'none';
      } else if (lane === 'right') {
        rightEl.style.background = '#00ff88';
        rightEl.style.color = '#000';
        rightEl.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.6)';
        centerEl.style.background = 'transparent';
        centerEl.style.color = '#64748b';
        centerEl.style.boxShadow = 'none';
        leftEl.style.background = 'transparent';
        leftEl.style.color = '#64748b';
        leftEl.style.boxShadow = 'none';
      } else {
        centerEl.style.background = 'rgba(0, 240, 255, 0.25)';
        centerEl.style.color = '#00f0ff';
        centerEl.style.boxShadow = 'none';
        leftEl.style.background = 'transparent';
        leftEl.style.color = '#64748b';
        leftEl.style.boxShadow = 'none';
        rightEl.style.background = 'transparent';
        rightEl.style.color = '#64748b';
        rightEl.style.boxShadow = 'none';
      }
    }

    if (jumpEl) {
      if (isJump) {
        jumpEl.style.background = '#ffd700';
        jumpEl.style.color = '#000';
        jumpEl.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
      } else {
        jumpEl.style.background = '#1e293b';
        jumpEl.style.color = '#64748b';
        jumpEl.style.boxShadow = 'none';
      }
    }

    if (fireEl) {
      if (isPunch) {
        fireEl.style.background = '#ff3d6e';
        fireEl.style.color = '#fff';
        fireEl.style.boxShadow = '0 0 20px rgba(255, 61, 110, 0.8)';
      } else {
        fireEl.style.background = '#1e293b';
        fireEl.style.color = '#64748b';
        fireEl.style.boxShadow = 'none';
      }
    }
  }

  function processVideoFrame() {
    if (!isCameraActive) return;

    if (webcamFeed.readyState >= 2) {
      poseCanvas.width = webcamFeed.videoWidth || 640;
      poseCanvas.height = webcamFeed.videoHeight || 480;

      // 1. Non-blocking MediaPipe Pose dispatch
      if (poseDetector && !isPoseBusy && webcamFeed.videoWidth > 0) {
        isPoseBusy = true;
        poseDetector.send({ image: webcamFeed }).catch(() => {}).finally(() => {
          isPoseBusy = false;
        });
      }

      // 2. Continuous Optical Energy Tracker (64x48)
      diffCtx.drawImage(webcamFeed, 0, 0, DIFF_W, DIFF_H);
      const currentFrame = diffCtx.getImageData(0, 0, DIFF_W, DIFF_H);
      const curr = currentFrame.data;

      frameHistory.push(new Uint8ClampedArray(curr));
      if (frameHistory.length > FRAME_HISTORY_CAP) {
        frameHistory.shift();
      }

      const hasRecentMediaPipe = (Date.now() - lastMediaPipeSuccessTime < 450);

      // Compare current frame with frame ~60-80ms ago
      const refFrame = frameHistory[0];
      if (refFrame && refFrame.length === curr.length) {
        let leftMotion = 0, centerMotion = 0, rightMotion = 0;
        let topMotion = 0, totalMotion = 0;
        let minX = DIFF_W, maxX = 0, minY = DIFF_H, maxY = 0;
        let sumX = 0, sumY = 0;

        const zone1 = Math.floor(DIFF_W * 0.38); // 24
        const zone2 = Math.floor(DIFF_W * 0.62); // 39
        const topRows = Math.floor(DIFF_H * 0.35); // 16

        for (let y = 0; y < DIFF_H; y++) {
          for (let x = 0; x < DIFF_W; x++) {
            const idx = (y * DIFF_W + x) * 4;
            const diff = Math.abs(curr[idx] - refFrame[idx]) +
                         Math.abs(curr[idx + 1] - refFrame[idx + 1]) +
                         Math.abs(curr[idx + 2] - refFrame[idx + 2]);

            if (diff > 18) {
              totalMotion++;
              sumX += x;
              sumY += y;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;

              if (x < zone1) leftMotion++;
              else if (x > zone2) rightMotion++;
              else centerMotion++;

              if (y < topRows) topMotion++;
            }
          }
        }

        // Update real-time energy meter on phone
        const energyBar = document.getElementById('body-energy-bar');
        const energyVal = document.getElementById('body-energy-val');
        if (energyBar) {
          const pct = Math.min(100, Math.round((totalMotion / 100) * 100));
          energyBar.style.width = pct + '%';
        }
        if (energyVal) {
          energyVal.textContent = totalMotion;
        }

        // If MediaPipe is not actively driving, optical engine controls the game and renders wireframe
        if (!hasRecentMediaPipe) {
          if (diagBodyEngine) diagBodyEngine.textContent = 'Optical Wireframe 60FPS';

          // Correct Direction Mapping:
          // Player moving body RIGHT -> playerRight > playerLeft
          // Player moving body LEFT  -> playerLeft > playerRight
          const playerRight = invertBody ? rightMotion : leftMotion;
          const playerLeft = invertBody ? leftMotion : rightMotion;

          const now = performance.now();
          const isJump = topMotion > 18 && (now - lastJumpSendTime > 320);
          if (isJump) {
            lastJumpSendTime = now;
            vibrate(50);
          }

          const isPunch = totalMotion > 75 && (now - lastPunchSendTime > 260);
          if (isPunch) {
            lastPunchSendTime = now;
            vibrate(35);
          }

          const MOTION_TRIGGER = 8;
          let detectedLane = currentActiveLane;

          if (playerRight > playerLeft + 4 && playerRight > MOTION_TRIGGER) {
            detectedLane = 'right';
            laneHoldFrames = isJump ? 24 : 16;
          } else if (playerLeft > playerRight + 4 && playerLeft > MOTION_TRIGGER) {
            detectedLane = 'left';
            laneHoldFrames = isJump ? 24 : 16;
          } else if (!isJump && (centerMotion > MOTION_TRIGGER * 1.5 || totalMotion < 5)) {
            // Only return to center when not actively jumping
            if (laneHoldFrames <= 0) {
              detectedLane = 'center';
            } else {
              laneHoldFrames--;
            }
          } else if (laneHoldFrames > 0) {
            laneHoldFrames--;
          }

          currentActiveLane = detectedLane;

          updatePhoneVisualFeedback(currentActiveLane, isJump, isPunch);

          // Clear canvas & Draw Optical Cybernetic Wireframe
          poseCanvasCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
          const cw = poseCanvas.width;
          const ch = poseCanvas.height;

          // Zone lines
          poseCanvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          poseCanvasCtx.lineWidth = 1.5;
          poseCanvasCtx.beginPath();
          poseCanvasCtx.moveTo(cw * 0.38, 0); poseCanvasCtx.lineTo(cw * 0.38, ch);
          poseCanvasCtx.moveTo(cw * 0.62, 0); poseCanvasCtx.lineTo(cw * 0.62, ch);
          poseCanvasCtx.stroke();

          // Render active wireframe overlay
          if (totalMotion > 8 && minX < maxX) {
            const centroidX = sumX / totalMotion;
            const centroidY = sumY / totalMotion;
            drawOpticalWireframe(poseCanvasCtx, cw, ch, minX, maxX, minY, maxY, centroidX, centroidY, isJump, isPunch, currentActiveLane);
          } else {
            // Standby guide wireframe
            const midX = cw * 0.5;
            const midY = ch * 0.5;
            drawOpticalWireframe(poseCanvasCtx, cw, ch, 18, 46, 8, 42, 32, 24, false, false, 'center');
          }

          poseBadge.textContent = `WIREFRAME: ${currentActiveLane.toUpperCase()} ${isJump ? '🦘' : ''}`;
          poseBadge.classList.add('tracking');

          let normBodyX = 0.50;
          if (currentActiveLane === 'right') normBodyX = 0.80;
          else if (currentActiveLane === 'left') normBodyX = 0.20;

          sendBodyPoseDirect(normBodyX, isJump ? 0.2 : 0.5, currentActiveLane, isJump, false, isPunch);
        }
      }
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  let prevNoseY = 0.5;
  let prevTorsoY = 0.5;
  let lastRawLandmarks = null; // 33-point array for ROMP injection

  function sendBodyPoseDirect(bodyX, bodyY, lane, isJumping, isDucking, isPunching) {
    const now = Date.now();
    if (now - lastPoseSendTime > 25) {
      lastPoseSendTime = now;
      packetsSent++;
      if (diagPackets) diagPackets.textContent = packetsSent;

      if (diagBodyX) {
        diagBodyX.textContent = `${lane.toUpperCase()} (${bodyX.toFixed(2)})`;
      }
      if (diagBodyPunch) {
        diagBodyPunch.textContent = isPunching ? '🔥 FIRE' : (isJumping ? '🦘 JUMP' : 'Idle');
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        // Build compact landmark array (x, y, visibility only — saves ~60% bandwidth vs full object)
        let compactLm = null;
        if (lastRawLandmarks && lastRawLandmarks.length >= 29) {
          compactLm = lastRawLandmarks.map(function(p) {
            return { x: p.x, y: p.y, z: p.z || 0, visibility: p.visibility === undefined ? 1 : p.visibility };
          });
        }
        ws.send(JSON.stringify({
          type: 'pose',
          bodyX: bodyX,
          bodyY: bodyY || 0.5,
          lane: lane,
          jump: isJumping || false,
          isSwinging: isJumping || false,
          isDucking: isDucking || false,
          isPunching: isPunching || false,
          latency: currentLatency,
          landmarks: compactLm,          // 33-point MediaPipe landmarks for ROMP
          energy: compactLm ? 0.5 : 0   // placeholder; real energy computed in romp-tv
        }));
      }
    }
  }

  async function startCameraTracking() {
    // 1. Check navigator.mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (httpsHelperBanner) httpsHelperBanner.style.display = 'block';
      alert('Camera requires a Secure Origin (HTTPS).\n\nPlease tap the HTTPS link at the top or open chrome://flags/#unsafely-treat-insecure-origin-as-secure to allow camera access.');
      return;
    }

    try {
      poseBadge.textContent = 'STARTING CAMERA...';
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      webcamFeed.srcObject = mediaStream;
      await webcamFeed.play();

      isCameraActive = true;
      btnToggleCamera.textContent = '⏹️ STOP CAMERA';
      btnToggleCamera.style.background = '#ff3366';
      poseBadge.textContent = 'CAMERA ACTIVE';

      // Setup MediaPipe in parallel
      setupMediaPipePose();

      // Start optical frame loop
      animFrameId = requestAnimationFrame(processVideoFrame);
    } catch (err) {
      console.error('Camera start error:', err);
      if (httpsHelperBanner) httpsHelperBanner.style.display = 'block';
      alert('Camera error: ' + err.message + '\n\nIf running over local HTTP, switch to the HTTPS Tunnel link or enable Insecure Origins in Chrome flags.');
      poseBadge.textContent = 'CAMERA FAILED';
    }
  }

  function stopCameraTracking() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    isCameraActive = false;
    btnToggleCamera.textContent = '📹 START BODY CAMERA';
    btnToggleCamera.style.background = '';
    poseBadge.textContent = 'CAMERA OFF';
    poseBadge.classList.remove('tracking');
    if (poseCanvasCtx) poseCanvasCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
  }

  if (btnToggleCamera) btnToggleCamera.addEventListener('click', () => {
    if (isCameraActive) {
      stopCameraTracking();
    } else {
      startCameraTracking();
    }
  });

  // Romp Modal Handlers
  const tabRomp = document.getElementById('tab-romp');
  const rompModal = document.getElementById('romp-modal');
  const btnLaunchRompTv = document.getElementById('btn-launch-romp-tv');
  const btnCloseRompModal = document.getElementById('btn-close-romp-modal');

  if (tabRomp && rompModal) {
    tabRomp.addEventListener('click', (e) => {
      e.preventDefault();
      rompModal.style.display = 'flex';
      vibrate(40);
    });
  }

  if (btnCloseRompModal && rompModal) {
    btnCloseRompModal.addEventListener('click', () => {
      rompModal.style.display = 'none';
    });
  }

  if (btnLaunchRompTv) {
    btnLaunchRompTv.addEventListener('click', () => {
      vibrate(50);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'switch_to_romp' }));
      }
      rompModal.style.display = 'none';
    });
  }

  
  // Mario Gamepad Touch Listeners
  function sendKey(key, isDown) {
    vibrate(isDown ? 30 : 0);
    initSensors();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: isDown ? 'key_press' : 'key_release',
        key: key
      }));
    }
  }

  const btnMarioL = document.getElementById('btn-mario-left');
  const btnMarioR = document.getElementById('btn-mario-right');
  const btnMarioJ = document.getElementById('btn-mario-jump');
  const btnMarioF = document.getElementById('btn-mario-fire');
  const marioTouchPad = document.getElementById('mario-touch-pad');

  if (btnMarioL) {
    btnMarioL.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('left', true); });
    btnMarioL.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('left', false); });
    btnMarioL.addEventListener('pointercancel', (e) => { e.preventDefault(); sendKey('left', false); });
  }
  if (btnMarioR) {
    btnMarioR.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('right', true); });
    btnMarioR.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('right', false); });
    btnMarioR.addEventListener('pointercancel', (e) => { e.preventDefault(); sendKey('right', false); });
  }
  if (btnMarioJ) {
    btnMarioJ.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('jump', true); });
    btnMarioJ.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('jump', false); });
  }
  if (btnMarioF) {
    btnMarioF.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('fire', true); });
    btnMarioF.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('fire', false); });
  }

  const btnBodyMarioL = document.getElementById('btn-body-mario-left');
  const btnBodyMarioR = document.getElementById('btn-body-mario-right');
  const btnBodyMarioJ = document.getElementById('btn-body-mario-jump');
  const btnBodyMarioF = document.getElementById('btn-body-mario-fire');
  const marioBodyTouchPad = document.getElementById('mario-body-touch-pad');

  if (btnBodyMarioL) {
    btnBodyMarioL.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('left', true); });
    btnBodyMarioL.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('left', false); });
    btnBodyMarioL.addEventListener('pointercancel', (e) => { e.preventDefault(); sendKey('left', false); });
  }
  if (btnBodyMarioR) {
    btnBodyMarioR.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('right', true); });
    btnBodyMarioR.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('right', false); });
    btnBodyMarioR.addEventListener('pointercancel', (e) => { e.preventDefault(); sendKey('right', false); });
  }
  if (btnBodyMarioJ) {
    btnBodyMarioJ.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('jump', true); });
    btnBodyMarioJ.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('jump', false); });
  }
  if (btnBodyMarioF) {
    btnBodyMarioF.addEventListener('pointerdown', (e) => { e.preventDefault(); sendKey('fire', true); });
    btnBodyMarioF.addEventListener('pointerup', (e) => { e.preventDefault(); sendKey('fire', false); });
  }

  function checkMarioMode(game) {
    if (marioTouchPad) {
      marioTouchPad.style.display = (game === 'mario') ? 'flex' : 'none';
    }
    if (marioBodyTouchPad) {
      marioBodyTouchPad.style.display = (game === 'mario') ? 'flex' : 'none';
    }
  }

  // Auto-detect ?game=mario from QR code
  const paramGame = urlParams.get('game');
  if (paramGame === 'mario') {
    syncGameButtons('mario');
    checkMarioMode('mario');
  }

  
  // Auto-switch to Body mode if Mario is active
  const cameraTapPrompt = document.getElementById('camera-tap-prompt');
  if (cameraTapPrompt) {
    cameraTapPrompt.addEventListener('click', () => {
      cameraTapPrompt.style.display = 'none';
      startCameraTracking();
    });
  }

  // Hook camera start/stop button to also hide/show prompt
  const origStartCameraTracking = startCameraTracking;
  startCameraTracking = async function() {
    if (cameraTapPrompt) cameraTapPrompt.style.display = 'none';
    await origStartCameraTracking();
  };

  const origStopCameraTracking = stopCameraTracking;
  stopCameraTracking = function() {
    if (cameraTapPrompt) cameraTapPrompt.style.display = 'flex';
    origStopCameraTracking();
  };

  // If ?game=mario is passed, auto-select Body tab
  if (urlParams.get('game') === 'mario') {
    tabBody.click();
  }

  // Start WebSocket
  connectWebSocket();
})();
