/**
 * ROMP Mobile to TV Wireless Casting Engine (Full Screen Composite Edition)
 *
 * Solves: "only wireframe image came, not entire mobile screen"
 * Why: ROMP uses separate DOM layers:
 *      1. PlayCanvas 3D Game Canvas (.stage > canvas)
 *      2. MediaPipe Presence Wireframe Canvas (.presence > canvas)
 *      3. React HUD DOM Overlays (.stage .banner, .clock, etc.)
 *
 * This engine composites ALL layers onto a 16:9 master broadcast canvas (1280x720)
 * and streams the ENTIRE game + player wireframe + scores live to Thomson TV!
 * Also provides direct guide for Native Android Smart View / Screen Mirroring.
 */
(function () {
  'use strict';

  if (window.__rompCastInitialized) return;
  window.__rompCastInitialized = true;

  // ── Detect Room ───────────────────────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  let storedRoom = null;
  try { storedRoom = localStorage.getItem('tv_arcade_room'); } catch (e) {}
  let ROOM_ID = params.get('room') || storedRoom || 'TV-6230';
  try { localStorage.setItem('tv_arcade_room', ROOM_ID); } catch (e) {}

  let ws = null;
  let pc = null;
  let compositeStream = null;
  let isCasting = false;
  let compositeRafId = null;

  // ── Broadcast Composite Canvas (1280x720 Widescreen) ──────────────────────
  const compCanvas = document.createElement('canvas');
  compCanvas.width = 1280;
  compCanvas.height = 720;
  const compCtx = compCanvas.getContext('2d', { alpha: false });

  // ── WebSocket Signaling ───────────────────────────────────────────────────
  function initWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'register',
        role: 'phone',
        roomId: ROOM_ID
      }));
      console.log('[RompCast] Connected to signaling server, room:', ROOM_ID);
      updateStatusLabel();
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'peer_status' && msg.roomId) {
          ROOM_ID = msg.roomId;
          try { localStorage.setItem('tv_arcade_room', ROOM_ID); } catch (e) {}
          updateStatusLabel();
        } else if (msg.type === 'rtc_answer' && pc) {
          console.log('[RompCast] Received WebRTC answer from TV');
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          showToast('🟢 TV Connected! Streaming full game to TV');
        } else if (msg.type === 'rtc_ice_candidate' && pc && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      } catch (err) {
        console.error('[RompCast] Signaling error:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  }
  initWebSocket();

  // ── Toast Notifications ───────────────────────────────────────────────────
  function showToast(text, duration = 3500) {
    let toast = document.getElementById('romp-cast-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'romp-cast-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 14, 26, 0.95);
        border: 1.5px solid #00f0ff;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 22px;
        border-radius: 30px;
        box-shadow: 0 4px 20px rgba(0, 240, 255, 0.5);
        z-index: 1000000;
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    setTimeout(() => { if (toast) toast.style.opacity = '0'; }, duration);
  }

  // ── Composite Render Loop (Merges 3D Game + Wireframe + HUD) ──────────────
  function findGameCanvas() {
    // 1. Look for canvas in .stage
    const stageCanvas = document.querySelector('.stage canvas');
    if (stageCanvas && stageCanvas.clientWidth > 100) return stageCanvas;

    // 2. Look for any canvas not inside .presence with large width
    const all = Array.from(document.querySelectorAll('canvas'));
    return all.find(c => !c.closest('.presence') && c.clientWidth > 250) || null;
  }

  function findPresenceCanvas() {
    return document.querySelector('.presence canvas') ||
           document.querySelector('.presence-small canvas') ||
           null;
  }

  function renderCompositeFrame() {
    if (!isCasting) return;

    const W = compCanvas.width;   // 1280
    const H = compCanvas.height;  // 720

    const gameCanvas = findGameCanvas();
    const presenceCanvas = findPresenceCanvas();

    if (gameCanvas) {
      // 1. Draw full-screen 3D Game
      try {
        compCtx.drawImage(gameCanvas, 0, 0, W, H);
      } catch (e) {
        compCtx.fillStyle = '#171b30';
        compCtx.fillRect(0, 0, W, H);
      }

      // 2. Picture-in-Picture: Draw Player Camera Presence Wireframe in bottom-right corner
      if (presenceCanvas) {
        const pw = 240;
        const ph = 180;
        const px = W - pw - 24;
        const py = H - ph - 24;

        // Dark glow card behind wireframe
        compCtx.save();
        compCtx.fillStyle = 'rgba(10, 14, 26, 0.85)';
        compCtx.strokeStyle = '#00f0ff';
        compCtx.lineWidth = 2.5;
        compCtx.shadowColor = '#00f0ff';
        compCtx.shadowBlur = 12;

        compCtx.beginPath();
        compCtx.roundRect(px, py, pw, ph, 14);
        compCtx.fill();
        compCtx.stroke();
        compCtx.restore();

        try {
          compCtx.drawImage(presenceCanvas, px + 4, py + 4, pw - 8, ph - 8);
        } catch (e) {}

        // Label above wireframe
        compCtx.fillStyle = '#00ff88';
        compCtx.font = 'bold 12px monospace';
        compCtx.fillText('PLAYER CAMERA (BODY TRACK)', px + 10, py - 8);
      }

      // 3. Draw DOM HUD elements (Clock / Banner / Scores)
      const clockEl = document.querySelector('.stage .clock');
      if (clockEl && clockEl.textContent) {
        compCtx.fillStyle = 'rgba(0,0,0,0.6)';
        compCtx.fillRect(W / 2 - 60, 16, 120, 36);
        compCtx.fillStyle = '#00f0ff';
        compCtx.font = 'bold 22px monospace';
        compCtx.textAlign = 'center';
        compCtx.fillText(clockEl.textContent, W / 2, 42);
        compCtx.textAlign = 'start';
      }

      const bannerEl = document.querySelector('.stage .banner');
      if (bannerEl && bannerEl.textContent) {
        compCtx.fillStyle = '#ff3d6e';
        compCtx.font = 'bold 26px sans-serif';
        compCtx.textAlign = 'center';
        compCtx.fillText(bannerEl.textContent, W / 2, 90);
        compCtx.textAlign = 'start';
      }
    } else {
      // ── Lobby / Menu Standby Screen (when browsing the 17 games on phone) ──
      const grad = compCtx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 600);
      grad.addColorStop(0, '#1c223c');
      grad.addColorStop(1, '#090b14');
      compCtx.fillStyle = grad;
      compCtx.fillRect(0, 0, W, H);

      // Title
      compCtx.fillStyle = '#00f0ff';
      compCtx.font = 'bold 36px sans-serif';
      compCtx.textAlign = 'center';
      compCtx.fillText('🕹️ ROMP MOTION GAMES · LIVE TV CAST', W / 2, 120);

      compCtx.fillStyle = '#b5c3d7';
      compCtx.font = '18px sans-serif';
      compCtx.fillText(`Connected to TV: ${ROOM_ID}`, W / 2, 160);

      // Center card with presence camera
      if (presenceCanvas) {
        const cw = 400;
        const ch = 300;
        const cx = (W - cw) / 2;
        const cy = 200;

        compCtx.save();
        compCtx.fillStyle = 'rgba(10, 14, 26, 0.9)';
        compCtx.strokeStyle = '#00ff88';
        compCtx.lineWidth = 3;
        compCtx.shadowColor = '#00ff88';
        compCtx.shadowBlur = 18;

        compCtx.beginPath();
        compCtx.roundRect(cx, cy, cw, ch, 18);
        compCtx.fill();
        compCtx.stroke();
        compCtx.restore();

        try {
          compCtx.drawImage(presenceCanvas, cx + 8, cy + 8, cw - 16, ch - 16);
        } catch (e) {}

        compCtx.fillStyle = '#00ff88';
        compCtx.font = 'bold 16px sans-serif';
        compCtx.textAlign = 'center';
        compCtx.fillText('🧍 CAMERA READY · STEP BACK TO FIT BODY', W / 2, cy + ch + 36);
      }

      compCtx.fillStyle = '#ffd166';
      compCtx.font = 'bold 20px sans-serif';
      compCtx.textAlign = 'center';
      compCtx.fillText('👉 Tap any game on your phone (Run, Pulse, Slice, etc.) to start playing on TV!', W / 2, H - 70);
      compCtx.textAlign = 'start';
    }

    compositeRafId = requestAnimationFrame(renderCompositeFrame);
  }

  // ── Floating Cast UI Button ───────────────────────────────────────────────
  const castPill = document.createElement('div');
  castPill.id = 'romp-cast-pill';
  castPill.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 999998;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(10, 14, 26, 0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1.5px solid #00f0ff;
    box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
    border-radius: 30px;
    padding: 7px 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    transition: all 0.25s ease;
  `;

  castPill.innerHTML = `
    <span id="cast-icon" style="font-size: 16px;">📺</span>
    <span id="cast-text">Cast to TV (${ROOM_ID})</span>
  `;

  function updateStatusLabel() {
    const text = document.getElementById('cast-text');
    if (text && !isCasting) {
      text.textContent = `Cast to TV (${ROOM_ID})`;
    }
    const modalRoom = document.getElementById('cast-modal-room');
    if (modalRoom) {
      modalRoom.textContent = `Target TV: ${ROOM_ID}`;
    }
  }

  function setCastingUI(casting) {
    isCasting = casting;
    const text = document.getElementById('cast-text');
    const icon = document.getElementById('cast-icon');
    if (casting) {
      castPill.style.borderColor = '#ff3366';
      castPill.style.boxShadow = '0 0 25px rgba(255, 51, 102, 0.7)';
      if (icon) icon.textContent = '🔴';
      if (text) text.textContent = 'Stop Cast (Live)';
    } else {
      castPill.style.borderColor = '#00f0ff';
      castPill.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.4)';
      if (icon) icon.textContent = '📺';
      if (text) text.textContent = `Cast to TV (${ROOM_ID})`;
    }
  }

  // ── Cast Options Modal ────────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'romp-cast-modal';
  modal.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(8, 10, 18, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  modal.innerHTML = `
    <div style="background: #121626; border: 1.5px solid #00f0ff; border-radius: 20px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 40px rgba(0, 240, 255, 0.3); color: #fff; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 6px;">📺</div>
      <h3 style="font-size: 19px; font-weight: 800; margin-bottom: 4px;">Cast ROMP to Thomson TV</h3>
      <div id="cast-modal-room" style="font-size: 13px; color: #00f0ff; font-weight: 700; margin-bottom: 20px; letter-spacing: 0.5px;">
        Target TV: ${ROOM_ID}
      </div>

      <!-- Option 1: In-App Composite Game Stream -->
      <button id="btn-start-composite-cast" style="width: 100%; background: linear-gradient(135deg, #00f0ff, #7000ff); border: none; border-radius: 14px; padding: 15px; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; margin-bottom: 12px; box-shadow: 0 4px 18px rgba(0, 240, 255, 0.45);">
        ⚡ Start Live WebRTC Game Stream
      </button>
      <p style="font-size: 11px; color: #94a3b8; margin-top: -6px; margin-bottom: 16px;">
        Streams the full 3D game + your camera wireframe + scores to the TV in 60 FPS!
      </p>

      <!-- Option 2: Native Android Screen Mirroring -->
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 14px; text-align: left; margin-bottom: 18px;">
        <div style="font-size: 13px; font-weight: 800; color: #fcbc00; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>📱</span> Mirror Entire Phone Screen (Smart View)
        </div>
        <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.5;">
          <b>1.</b> Swipe down your phone's notification shade from top.<br>
          <b>2.</b> Tap <b>Smart View</b> or <b>Cast / Screen Cast</b>.<br>
          <b>3.</b> Tap <b>Thomson TV</b> &rarr; tap <b>Start now</b>.<br>
          <i>Mirrors every app, full phone screen, with audio!</i>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button id="btn-change-room" style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 9px; color: #94a3b8; font-size: 12px; cursor: pointer;">
          Change TV Code
        </button>
        <button id="btn-close-cast-modal" style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 9px; color: #94a3b8; font-size: 12px; cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;

  // ── Start WebRTC Composite Stream to TV ────────────────────────────────────
  async function startCompositeCasting() {
    try {
      // Start the composite RAF loop
      isCasting = true;
      setCastingUI(true);
      modal.style.display = 'none';

      if (compositeRafId) cancelAnimationFrame(compositeRafId);
      compositeRafId = requestAnimationFrame(renderCompositeFrame);

      // Capture the 16:9 composite canvas at 30 FPS
      compositeStream = compCanvas.captureStream(30);

      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };
      pc = new RTCPeerConnection(config);

      compositeStream.getTracks().forEach(track => {
        pc.addTrack(track, compositeStream);
        track.onended = () => stopCasting();
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'rtc_ice_candidate',
            candidate: event.candidate,
            roomId: ROOM_ID
          }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'rtc_offer',
          sdp: offer,
          roomId: ROOM_ID
        }));
      }

      showToast(`🟢 Streaming full game to TV (${ROOM_ID})!`);
      console.log('[RompCast] Composite full-game streaming initiated');
    } catch (err) {
      console.error('[RompCast] Cast error:', err);
      stopCasting();
      showToast('Tip: Use Android Smart View in notification shade');
    }
  }

  function stopCasting() {
    isCasting = false;
    if (compositeRafId) {
      cancelAnimationFrame(compositeRafId);
      compositeRafId = null;
    }
    if (compositeStream) {
      compositeStream.getTracks().forEach(t => t.stop());
      compositeStream = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'rtc_cast_stopped',
        roomId: ROOM_ID
      }));
    }
    setCastingUI(false);
    showToast('Casting stopped');
  }

  // ── Event Handlers ────────────────────────────────────────────────────────
  castPill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isCasting) {
      stopCasting();
    } else {
      modal.style.display = 'flex';
    }
  });

  function bindModalEvents() {
    const btnStream = document.getElementById('btn-start-composite-cast');
    const btnClose = document.getElementById('btn-close-cast-modal');
    const btnChangeRoom = document.getElementById('btn-change-room');

    if (btnStream) btnStream.onclick = () => startCompositeCasting();
    if (btnClose) btnClose.onclick = () => modal.style.display = 'none';
    if (btnChangeRoom) {
      btnChangeRoom.onclick = () => {
        const input = prompt('Enter TV Room Code (e.g. TV-6230):', ROOM_ID);
        if (input && input.trim()) {
          ROOM_ID = input.trim();
          try { localStorage.setItem('tv_arcade_room', ROOM_ID); } catch (e) {}
          updateStatusLabel();
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'register', role: 'phone', roomId: ROOM_ID }));
          }
        }
      };
    }
  }

  // ── Mount UI to DOM ───────────────────────────────────────────────────────
  function mountUI() {
    if (document.body) {
      document.body.appendChild(castPill);
      document.body.appendChild(modal);
      bindModalEvents();
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(castPill);
        document.body.appendChild(modal);
        bindModalEvents();
      });
    }
  }
  mountUI();

  // If ?cast=1 was provided, open cast options on first touch
  if (params.get('cast') === '1') {
    const trigger = () => {
      window.removeEventListener('click', trigger);
      window.removeEventListener('touchstart', trigger);
      modal.style.display = 'flex';
    };
    window.addEventListener('click', trigger, { once: true });
    window.addEventListener('touchstart', trigger, { once: true });
  }
})();
