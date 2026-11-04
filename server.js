const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const AgentOrchestrator = require('./agent-orchestrator');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const orchestrator = new AgentOrchestrator({ workspaceDir: __dirname });

// Find the real local Wi-Fi / LAN IPv4 address (ignoring Tailscale / VPN / Virtual adapters)
function getLocalIp() {
  if (process.env.HOST_IP) {
    return process.env.HOST_IP;
  }
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    // Ignore virtual / VPN / container / bluetooth adapters
    if (
      lowerName.includes('tailscale') ||
      lowerName.includes('docker') ||
      lowerName.includes('tap') ||
      lowerName.includes('tun') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('loopback') ||
      lowerName.includes('bluetooth')
    ) {
      continue;
    }

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Skip 169.254 (APIPA) and 100.64-127 (CGNAT / Tailscale)
        if (iface.address.startsWith('169.254.') || iface.address.startsWith('100.')) {
          continue;
        }
        let priority = 1;
        if (iface.address.startsWith('192.168.')) priority = 10;
        else if (iface.address.startsWith('10.')) priority = 8;
        else if (/^172\.(1[6-9]|2\d|3[01])\./.test(iface.address)) priority = 6;

        candidates.push({ address: iface.address, name, priority });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.length > 0 ? candidates[0].address : 'localhost';
}

const LOCAL_IP = getLocalIp();

// MIME Types (Includes WebAssembly, 3D GLB, Fonts, and MediaPipe Data models)
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.task': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.map': 'application/json'
};

// Cloudflare Tunnel State (or Render Cloud Host URL)
let tunnelUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || null;
let tunnelProcess = null;

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Route shortcuts
  if (pathname === '/' || pathname === '/tv') {
    pathname = '/tv.html';
  } else if (pathname === '/mario') {
    pathname = '/mario.html';
  } else if (pathname === '/phone' || pathname === '/controller') {
    pathname = '/phone.html';
  } else if (pathname === '/dashboard' || pathname === '/agent' || pathname === '/control') {
    pathname = '/dashboard.html';
  } else if (pathname === '/romp') {
    res.writeHead(301, { 'Location': '/romp/' });
    res.end();
    return;
  } else if (pathname === '/api/gl-report') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('🎮 [TV WebGL Diagnostic Report]:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  } else if (pathname === '/romp-tv') {
    // ROMP on TV — full-screen iframe wrapper driven by phone body camera
    pathname = '/romp-tv.html';
  } else if (pathname === '/api/action' || pathname === '/action') {
    // ActionAndLink / External HTTP Webhook relay
    const action = parsedUrl.searchParams.get('action') || parsedUrl.searchParams.get('key');
    const roomId = parsedUrl.searchParams.get('room') || activeTvRoomId;
    const room = roomId ? rooms.get(roomId) : null;
    const targetTv = (room && room.tv && room.tv.readyState === 1) ? room.tv : activeTvWs;

    if (targetTv && targetTv.readyState === 1 && action) {
      if (action === 'left' || action === 'right' || action === 'jump' || action === 'fire' || action === 'duck') {
        targetTv.send(JSON.stringify({ type: 'key_press', key: action }));
        setTimeout(() => {
          if (targetTv.readyState === 1) targetTv.send(JSON.stringify({ type: 'key_release', key: action }));
        }, 220);
      } else if (action === 'start') {
        targetTv.send(JSON.stringify({ type: 'start_game' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, action, relayedTo: roomId || 'activeTv' }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'No active TV connected or missing action param' }));
    }
    return;
  } else if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      localIp: LOCAL_IP,
      port: currentPort,
      tunnelUrl: tunnelUrl,
      tvUrl: `http://${LOCAL_IP}:${currentPort}/tv`,
      marioUrl: `http://${LOCAL_IP}:${currentPort}/mario`,
      phoneUrl: tunnelUrl ? `${tunnelUrl}/phone` : `http://${LOCAL_IP}:${currentPort}/phone`,
      dashboardUrl: `http://${LOCAL_IP}:${currentPort}/dashboard`,
      rompUrl: `http://${LOCAL_IP}:${currentPort}/romp/`,
      httpsPhoneUrl: tunnelUrl ? `${tunnelUrl}/phone` : null,
      httpsRompUrl: tunnelUrl ? `${tunnelUrl}/romp/` : null
    }));
    return;
  }

  const ROMP_DIST = path.join(__dirname, 'romp', 'dist');
  let filePath;

  if (pathname.startsWith('/romp/')) {
    let subpath = pathname.replace(/^\/romp\//, '');
    if (subpath === '' || subpath === '/') {
      subpath = 'index.html';
    }
    filePath = path.join(ROMP_DIST, subpath);
    if (!filePath.startsWith(ROMP_DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  } else if (
    pathname.startsWith('/wasm/') ||
    pathname.startsWith('/models/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/manifest.json' ||
    pathname === '/icon.svg' ||
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png'
  ) {
    filePath = path.join(ROMP_DIST, pathname);
    if (!filePath.startsWith(ROMP_DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  } else {
    filePath = path.join(PUBLIC_DIR, pathname);
    if (!fs.existsSync(filePath) && fs.existsSync(path.join(ROMP_DIST, pathname))) {
      filePath = path.join(ROMP_DIST, pathname);
    }
    if (!filePath.startsWith(PUBLIC_DIR) && !filePath.startsWith(ROMP_DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, magnetometer=*',
      'Feature-Policy': 'accelerometer *; gyroscope *; camera *; magnetometer *'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });
wss.on('error', (err) => {
  // Suppress uncaught listen error on WebSocketServer
});

// Rooms map: roomId -> { tv: WebSocket, phone: WebSocket }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { tv: null, phone: null });
  }
  return rooms.get(roomId);
}

// Global active TV and phone tracking for zero-configuration auto-pairing
let activeTvWs = null;
let activeTvRoomId = 'MAIN';
let globalPhoneWs = null;
const dashboardSockets = new Set();

function broadcastTunnelReady() {
  if (!tunnelUrl) return;
  const payload = JSON.stringify({
    type: 'tunnel_ready',
    tunnelUrl: tunnelUrl,
    phoneUrl: `${tunnelUrl}/phone`,
    rompUrl: `${tunnelUrl}/romp/`
  });
  if (activeTvWs && activeTvWs.readyState === activeTvWs.OPEN) {
    try { activeTvWs.send(payload); } catch (e) {}
  }
  for (const ds of dashboardSockets) {
    if (ds && ds.readyState === ds.OPEN) {
      try { ds.send(payload); } catch (e) {}
    }
  }
}

// Pipe orchestrator state updates to dashboard clients
orchestrator.on('state_update', (state) => {
  const payload = JSON.stringify({ type: 'orchestrator_state', state });
  for (const ds of dashboardSockets) {
    if (ds && ds.readyState === ds.OPEN) {
      try { ds.send(payload); } catch (e) {}
    }
  }
});

wss.on('connection', (ws, req) => {
  // Ultra-low latency: Disable Nagle's TCP buffering
  if (req && req.socket) {
    try { req.socket.setNoDelay(true); } catch (e) {}
  }
  let clientRole = null;
  let clientRoomId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'register') {
        clientRole = msg.role; // 'tv', 'phone', or 'romp_tv'
        clientRoomId = msg.roomId || 'MAIN';

        if (clientRole === 'tv') {
          activeTvWs = ws;
          activeTvRoomId = clientRoomId;
          const room = getOrCreateRoom(clientRoomId);
          room.tv = ws;
          console.log(`[Server] TV registered in room: ${clientRoomId}`);

          // If a phone is already waiting on the server, auto-link it immediately!
          if (!room.phone && globalPhoneWs && globalPhoneWs.readyState === ws.OPEN) {
            room.phone = globalPhoneWs;
            globalPhoneWs.send(JSON.stringify({ type: 'peer_status', tvConnected: true, roomId: clientRoomId }));
          }

          ws.send(JSON.stringify({
            type: 'registered',
            role: 'tv',
            roomId: clientRoomId,
            phoneConnected: !!(room.phone && room.phone.readyState === ws.OPEN),
            tunnelUrl: tunnelUrl,
            httpsPhoneUrl: tunnelUrl ? `${tunnelUrl}/phone?room=${clientRoomId}` : null
          }));

          if (tunnelUrl) {
            ws.send(JSON.stringify({
              type: 'tunnel_ready',
              tunnelUrl: tunnelUrl,
              phoneUrl: `${tunnelUrl}/phone?room=${clientRoomId}`,
              rompUrl: `${tunnelUrl}/romp/`
            }));
          }

          if (room.phone && room.phone.readyState === ws.OPEN) {
            room.phone.send(JSON.stringify({ type: 'peer_status', tvConnected: true, roomId: clientRoomId }));
          }
        } else if (clientRole === 'romp_tv') {
          // ROMP TV display — receives pose data from phone, renders ROMP full-screen
          const room = getOrCreateRoom(clientRoomId);
          room.romp_tv = ws;
          console.log(`[Server] ROMP-TV registered in room: ${clientRoomId}`);
          ws.send(JSON.stringify({
            type: 'registered',
            role: 'romp_tv',
            roomId: clientRoomId,
            phoneConnected: !!(room.phone && room.phone.readyState === ws.OPEN)
          }));
          // Notify phone that ROMP TV is ready
          if (room.phone && room.phone.readyState === ws.OPEN) {
            room.phone.send(JSON.stringify({ type: 'peer_status', tvConnected: true, rompTvReady: true }));
          }
        } else if (clientRole === 'phone') {
          globalPhoneWs = ws;
          // If phone connects, auto-adopt the active TV's room
          if (activeTvWs && activeTvWs.readyState === ws.OPEN) {
            clientRoomId = activeTvRoomId;
          }
          const room = getOrCreateRoom(clientRoomId);
          room.phone = ws;
          console.log(`[Server] Phone paired to room: ${clientRoomId}`);

          const isTvConnected = !!(room.tv && room.tv.readyState === ws.OPEN) || !!(activeTvWs && activeTvWs.readyState === ws.OPEN);
          ws.send(JSON.stringify({
            type: 'registered',
            role: 'phone',
            roomId: clientRoomId,
            tvConnected: isTvConnected,
            tunnelUrl: tunnelUrl
          }));

          const targetTv = room.tv || activeTvWs;
          if (targetTv && targetTv.readyState === ws.OPEN) {
            targetTv.send(JSON.stringify({ type: 'peer_status', phoneConnected: true }));
          }
          // Also notify ROMP TV if it's running
          if (room.romp_tv && room.romp_tv.readyState === ws.OPEN) {
            room.romp_tv.send(JSON.stringify({ type: 'peer_status', phoneConnected: true }));
          }
        }
        return;
      }

      // Dashboard Management Commands
      if (msg.type === 'dashboard_register') {
        clientRole = 'dashboard';
        dashboardSockets.add(ws);
        ws.send(JSON.stringify({
          type: 'orchestrator_state',
          state: orchestrator.getState()
        }));
        if (tunnelUrl) {
          ws.send(JSON.stringify({
            type: 'tunnel_ready',
            tunnelUrl: tunnelUrl,
            phoneUrl: `${tunnelUrl}/phone`,
            rompUrl: `${tunnelUrl}/romp/`
          }));
        }
        return;
      } else if (msg.type === 'spawn_agent') {
        orchestrator.spawnAgent(msg.taskId, msg.role || 'CoderAgent');
        return;
      } else if (msg.type === 'terminate_agent') {
        orchestrator.terminateAgent(msg.agentId);
        return;
      } else if (msg.type === 'terminate_all_agents') {
        orchestrator.terminateAllAgents();
        return;
      } else if (msg.type === 'run_all_ideas') {
        orchestrator.runAllIdeas();
        return;
      } else if (msg.type === 'add_idea') {
        orchestrator.addIdea(msg.title, msg.description);
        return;
      } else if (msg.type === 'get_raw_ideas') {
        try {
          const raw = fs.readFileSync(orchestrator.ideasFilePath, 'utf8');
          ws.send(JSON.stringify({ type: 'raw_ideas_content', content: raw }));
        } catch (e) {}
        return;
      } else if (msg.type === 'save_raw_ideas') {
        orchestrator.saveIdeasToFile(msg.content);
        return;
      } else if (msg.type === 'reload_ideas') {
        orchestrator.loadIdeas();
        return;
      } else if (msg.type === 'retest_all') {
        orchestrator.verifyCodebase((res) => {
          orchestrator.log(`Codebase verification: ${res.success ? 'ALL TESTS PASSED' : 'FAILED: ' + res.error}`, res.success ? 'success' : 'error', 'MainAgent');
        });
        return;
      }

      // Fast-path Relay: if from phone, send to tv AND romp_tv; if from tv/romp_tv, send to phone
      const textData = typeof data === 'string' ? data : data.toString();
      if (clientRole === 'phone') {
        const room = clientRoomId ? rooms.get(clientRoomId) : null;
        const targetTv = (room && room.tv && room.tv.readyState === ws.OPEN) ? room.tv : activeTvWs;
        if (targetTv && targetTv.readyState === ws.OPEN) {
          targetTv.send(textData);
        }
        // Also relay to ROMP TV display if connected in same room
        if (room && room.romp_tv && room.romp_tv.readyState === ws.OPEN) {
          room.romp_tv.send(textData);
        }
      } else if (clientRole === 'tv' || clientRole === 'romp_tv') {
        const room = clientRoomId ? rooms.get(clientRoomId) : null;
        if (room && room.phone && room.phone.readyState === ws.OPEN) {
          room.phone.send(textData);
        }
      }
    } catch (e) {
      // Ignore malformed payloads
    }
  });

  ws.on('close', () => {
    dashboardSockets.delete(ws);
    if (ws === globalPhoneWs) globalPhoneWs = null;
    if (ws === activeTvWs) activeTvWs = null;

    if (clientRoomId && rooms.has(clientRoomId)) {
      const room = rooms.get(clientRoomId);
      if (clientRole === 'tv' && room.tv === ws) {
        room.tv = null;
        if (room.phone && room.phone.readyState === ws.OPEN) {
          room.phone.send(JSON.stringify({ type: 'peer_status', tvConnected: false }));
        }
      } else if (clientRole === 'romp_tv' && room.romp_tv === ws) {
        room.romp_tv = null;
      } else if (clientRole === 'phone' && room.phone === ws) {
        room.phone = null;
        if (room.tv && room.tv.readyState === ws.OPEN) {
          room.tv.send(JSON.stringify({ type: 'peer_status', phoneConnected: false }));
        }
        if (room.romp_tv && room.romp_tv.readyState === ws.OPEN) {
          room.romp_tv.send(JSON.stringify({ type: 'peer_status', phoneConnected: false }));
        }
      }
      if (!room.tv && !room.phone && !room.romp_tv) {
        rooms.delete(clientRoomId);
      }
    }
  });
});

const FIXED_PORT = parseInt(process.env.PORT || '3000', 10);
let currentPort = FIXED_PORT;

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`) && parts[3] === 'LISTENING') {
          const pid = parts[4];
          if (pid && pid !== String(process.pid) && pid !== '0') {
            console.log(`[Server] Freeing port ${port} by terminating lingering process PID: ${pid}`);
            try { execSync(`taskkill /F /PID ${pid}`); } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}
}

function startCloudflareTunnel(port) {
  const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(cloudflaredPath)) return;

  try {
    console.log('[Tunnel] Initializing Cloudflare HTTPS tunnel for mobile camera compatibility...');
    tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${port}`]);

    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
        console.log('\n======================================================');
        console.log('🔒 SECURE HTTPS CLOUDFLARE TUNNEL ONLINE');
        console.log('======================================================');
        console.log(`📱 HTTPS Phone Controller: ${tunnelUrl}/phone`);
        console.log(`🕹️ HTTPS Romp Motion Games: ${tunnelUrl}/romp/`);
        console.log('💡 Camera permissions & MediaPipe Pose are fully enabled!');
        console.log('======================================================\n');
        broadcastTunnelReady();
      }
    };

    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);

    tunnelProcess.on('exit', () => {
      tunnelProcess = null;
    });

    process.on('exit', () => {
      if (tunnelProcess) {
        try { tunnelProcess.kill(); } catch (e) {}
      }
    });
  } catch (err) {
    console.error('[Tunnel] Failed to launch cloudflared:', err.message);
  }
}

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    currentPort = port;
    console.log('\n======================================================');
    console.log('🎮 MOTION TV GAME SERVER STARTED (PORT PINNED: 3000)');
    console.log('======================================================');
    console.log(`📡 Local Network IP:       http://${LOCAL_IP}:${currentPort}`);
    console.log(`📺 Smart TV Arcade URL:     http://${LOCAL_IP}:${currentPort}/tv`);
    console.log(`📱 Phone Controller URL:   http://${LOCAL_IP}:${currentPort}/phone`);
    console.log(`🕹️ Romp Motion Games URL:   http://${LOCAL_IP}:${currentPort}/romp/`);
    console.log('======================================================');
    if (tunnelUrl) {
      console.log(`🌐 Public Production URL:  ${tunnelUrl}`);
      console.log(`📺 Smart TV Arcade URL:     ${tunnelUrl}/tv`);
      console.log(`📱 Phone Controller URL:   ${tunnelUrl}/phone`);
      console.log(`🕹️ Romp Motion Games URL:   ${tunnelUrl}/romp/`);
      console.log('======================================================');
    }
    console.log('1. Open TV Arcade on your Thomson TV (or Leanback App).');
    console.log('2. Phone will auto-pair permanently to this TV!\n');

    startCloudflareTunnel(port);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${FIXED_PORT} is in use by another instance. Freeing port ${FIXED_PORT}...`);
    freePort(FIXED_PORT);
    setTimeout(() => {
      startServer(FIXED_PORT);
    }, 800);
  } else {
    console.error('Server error:', err);
  }
});

freePort(FIXED_PORT);
startServer(currentPort);
