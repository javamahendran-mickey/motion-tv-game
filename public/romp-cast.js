/**
 * ROMP Wireless TV Casting Helper
 * Enables zero-setup WebRTC screen/canvas casting from smartphone to Android TV.
 */
(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__rompCastInitialized) return;
  window.__rompCastInitialized = true;

  const params = new URLSearchParams(location.search);
  let storedRoom = null;
  try { storedRoom = localStorage.getItem('tv_arcade_room'); } catch (e) {}
  const ROOM_ID = params.get('room') || storedRoom || 'TV-6230';
  try { localStorage.setItem('tv_arcade_room', ROOM_ID); } catch (e) {}

  let ws = null;
  let pc = null;
  let activeStream = null;
  let isCasting = false;

  // ── Establish WebSocket connection for WebRTC signaling ──────────────────
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
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'rtc_answer' && pc) {
          console.log('[RompCast] Received WebRTC answer from TV');
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
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

  // ── Floating Cast UI Button ───────────────────────────────────────────────
  const castPill = document.createElement('div');
  castPill.id = 'romp-cast-pill';
  castPill.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(10, 14, 26, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid #00f0ff;
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.35);
    border-radius: 30px;
    padding: 6px 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    transition: all 0.25s ease;
  `;

  castPill.innerHTML = `
    <span id="cast-icon" style="font-size: 16px;">📺</span>
    <span id="cast-text">Cast to TV (${ROOM_ID})</span>
  `;

  function updatePillState(casting) {
    isCasting = casting;
    const text = document.getElementById('cast-text');
    const icon = document.getElementById('cast-icon');
    if (casting) {
      castPill.style.borderColor = '#ff3366';
      castPill.style.boxShadow = '0 0 20px rgba(255, 51, 102, 0.6)';
      if (icon) icon.textContent = '🔴';
      if (text) text.textContent = 'Stop Cast (Live)';
    } else {
      castPill.style.borderColor = '#00f0ff';
      castPill.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.35)';
      if (icon) icon.textContent = '📺';
      if (text) text.textContent = `Cast to TV (${ROOM_ID})`;
    }
  }

  // ── Capture Stream (Canvas or DisplayMedia) ────────────────────────────────
  async function startCasting() {
    try {
      let stream = null;

      // First try capturing game canvas directly (smoothest 60 FPS, no permission dialogs if already playing)
      const canvas = document.querySelector('canvas');
      if (canvas && typeof canvas.captureStream === 'function') {
        stream = canvas.captureStream(30);
      }

      // If no canvas yet or captureStream not supported, prompt for DisplayMedia
      if (!stream && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 60 } },
          audio: false
        });
      }

      if (!stream) {
        alert('Could not start screen capture. Please start a game first or use your phone\'s Quick Settings "Cast / Smart View" to mirror to Thomson TV.');
        return;
      }

      activeStream = stream;

      // WebRTC Peer Connection
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      pc = new RTCPeerConnection(config);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
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

      updatePillState(true);
      console.log('[RompCast] Streaming started successfully to TV');
    } catch (err) {
      console.error('[RompCast] Failed to start cast:', err);
      updatePillState(false);
      if (err.name !== 'NotAllowedError') {
        alert('Casting tip: You can also use your Android phone\'s native "Smart View / Cast Screen" in Quick Settings to mirror to your Thomson TV.');
      }
    }
  }

  function stopCasting() {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
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
    updatePillState(false);
    console.log('[RompCast] Streaming stopped');
  }

  castPill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isCasting) {
      stopCasting();
    } else {
      startCasting();
    }
  });

  // Inject pill once DOM is ready
  function mountUI() {
    if (document.body) {
      document.body.appendChild(castPill);
    } else {
      window.addEventListener('DOMContentLoaded', () => document.body.appendChild(castPill));
    }
  }
  mountUI();

  // If URL has ?cast=1, start cast immediately on user's first touch
  if (params.get('cast') === '1') {
    const autoPrompt = () => {
      window.removeEventListener('click', autoPrompt);
      window.removeEventListener('touchstart', autoPrompt);
      startCasting();
    };
    window.addEventListener('click', autoPrompt, { once: true });
    window.addEventListener('touchstart', autoPrompt, { once: true });
  }
})();
