# 🎮 Smart TV Motion Gaming Suite & Controller (Mario + ROMP 17 + Neon Arcade)

A full-stack, real-time body motion and gesture gaming suite designed for **Smart TVs** (Android TV, Google TV, Thomson, Samsung Tizen, LG webOS, Fire TV) powered by any **Android smartphone** as an AI-driven, wireless motion capture controller.

Runs with **zero lag (< 10ms)** using WebSockets, Web Audio API, HTML5 Canvas/WebGL, and dual-layer body tracking (Google MediaPipe 33-point skeletal pose + 60 FPS multi-frame optical flow tracker).

---

## 🌟 3 Complete Game Arenas Included

### 1. 🍄 Super Mario Motion (`/mario`)
Play classic **Super Mario Bros World 1-1** using your actual body movements:
* **Run Right / Left**: Move your body to the right or left of your camera frame. (Calibrated with natural mirroring: moving to your right moves Mario right!).
* **Jump**: Physically jump or raise both hands above shoulder height.
* **Mid-Air Steering**: Full momentum physics engine (`airDrag = 0.97`) allowing mid-air direction adjustments and platform jumps.
* **Duck / Pipe Crouch**: Drop into a physical squat.
* **Fireball / Dash**: Quick forward punch or wrist snap.
* **Dual Fallback Engine**: If MediaPipe takes time to initialize or drops frames, the built-in 60 FPS multi-frame temporal optical tracker takes over instantaneously.
* **External Controller Support**: HTML5 Gamepad API + `/api/action` webhook for third-party apps like *ActionAndLink*.

### 2. 🕹️ ROMP 17 Motion Games Arena (`/romp/` and `/romp-tv`)
17 camera-driven motion fitness & rhythm arcade games:
* **Pulse** — Neon rhythm tunnel: slice incoming notes on the beat with your hands.
* **Run** — Endless runner: lean to change lanes, jump barrels, duck under laser beams.
* **Slice** — Fruit Ninja style: swipe and slash flying fruit, dodge bombs.
* **Keepy-Uppy** — Balloon volleyball: keep balloons floating with headers, knees, and kicks.
* **Leaks** — Full-body water plug: cover room cracks with hands, feet, knees, or head.
* **Sprint** — Knees-up Olympic racing against the clock.
* **Jack Attack** — Every physical jumping jack fires the cannon at space invaders.
* **Forge** — Hold deep squats to heat glowing blades; strike up hard when white hot.
* **Lumberjack** — Wind up high and chop down diagonally across your body to split logs.
* **Smash**, **Goalie**, **Jab**, **Beat**, **Rocket**, **Freeze**, **Wipe**, **Shape Up**.
* **Dual Play Options**:
  * **Option A (TV Direct)**: Plays full-screen on TV via `/romp-tv`, receiving pose data injected into `globalThis.__romp.players` from your phone.
  * **Option B (Phone Cast)**: Run ROMP directly on mobile at 60 FPS and cast full screen to the TV using Google Cast / Miracast.

### 3. ⚔️ Neon Motion Strike (`/tv`)
High-performance 60 FPS cyberpunk rhythm & dodge arcade:
* **Mode 1: Handheld Saber**: Phone IMU gyro/accelerometer tracking (`DeviceOrientation` & `DeviceMotion`) with real-time haptic vibration on hit.
* **Mode 2: Optical Full-Body**: Stand 2–3 meters away and dodge barriers, duck obstacles, and punch bosses.

---

## 📱 Wireless Phone Controller Features (`/phone`)

* **33-Point Neon Wireframe Skeleton**: Real-time HUD displaying cyan/gold glowing bones, joints, spine, and head halo reticle overlaying your webcam feed.
* **Live Directional HUD**: Real-time indicators for `LEFT`, `CENTER`, `RIGHT`, `JUMP 🦘`, and `FIRE 🔥`.
* **Motion Energy Bar**: Live visual feedback of movement intensity and speed.
* **Touch Fallback Pad**: On-screen buttons to control games when camera is resting.
* **Camera Tap-to-Activate**: Respects mobile browser autoplay policies with one-tap camera start.
* **HTTPS Secure Origin**: Works seamlessly over HTTPS tunnels or cloud domains for instant WebRTC/MediaDevices camera permissions.

---

## 🏗️ System Architecture

```
                 ┌─────────────────────────────────────────────────┐
                 │          Android Smartphone (Controller)        │
                 │  - Front/Back Camera (getUserMedia)             │
                 │  - MediaPipe Pose (33 3D keypoints @ 30 FPS)    │
                 │  - 60 FPS Multi-frame Temporal Optical Flow     │
                 │  - Neon Wireframe Skeleton Canvas Overlay       │
                 │  - Accelerometer / Gyroscope (DeviceMotion)     │
                 │  - Haptic Feedback Engine (navigator.vibrate)   │
                 └────────────────────────┬────────────────────────┘
                                          │
                                          │  WebSocket (JSON @ 30-60 packets/sec)
                                          ▼
                 ┌─────────────────────────────────────────────────┐
                 │       Node.js Cloud / Local Server (server.js)  │
                 │  - WebSocket Room Manager (rooms.set(roomId))   │
                 │  - High-frequency Fast-Path Relay (< 5ms)       │
                 │  - External HTTP Webhook API (/api/action)      │
                 │  - Cloudflare Tunnel / Render Cloud Detection   │
                 │  - Static Asset Engine (WASM, 3D GLB, Audio)    │
                 └────────────────────────┬────────────────────────┘
                                          │
                                          │  WebSocket (Direct State Sync)
                                          ▼
                 ┌─────────────────────────────────────────────────┐
                 │           Smart TV Screen (Display)             │
                 │  - Native Android TV App: com.motiontv.arcade   │
                 │  - Super Mario Physics Engine (mario.js)        │
                 │  - ROMP TV Injection Wrapper (romp-tv.html)     │
                 │  - Neon Motion Strike Engine (tv.js)            │
                 │  - Procedural Web Audio Sound Synthesizer       │
                 └─────────────────────────────────────────────────┘
```

---

## 🌐 Cloud Deployment (Render.com)

The project is hosted live on **Render** (Free Tier):
* **Production URL**: `https://motion-tv-game.onrender.com`
* **GitHub Repository**: `https://github.com/javamahendran-mickey/motion-tv-game.git`

### URLs on Production:
| Purpose | URL |
| :--- | :--- |
| **TV Arcade Lobby** | `https://motion-tv-game.onrender.com/tv` |
| **Super Mario Motion** | `https://motion-tv-game.onrender.com/mario` |
| **ROMP 17 Games (TV Mode)** | `https://motion-tv-game.onrender.com/romp-tv` |
| **ROMP 17 Games (Direct)** | `https://motion-tv-game.onrender.com/romp/` |
| **Phone Motion Controller** | `https://motion-tv-game.onrender.com/phone` |
| **Agent / Admin Dashboard** | `https://motion-tv-game.onrender.com/dashboard` |
| **Server Diagnostic Info** | `https://motion-tv-game.onrender.com/api/info` |

---

## 📺 Android TV Native App (`com.motiontv.arcade`)

Located in `addons/motion-arcade/`:
* Pure Java Android Leanback Activity (`MainActivity.java`).
* Full-screen immersive mode with `FLAG_KEEP_SCREEN_ON`.
* Hardware-accelerated WebView with camera and storage permissions auto-granted.
* **Auto-Migration**: Automatically converts old local IP bookmarks to `https://motion-tv-game.onrender.com/tv`.
* **Remote Shortcuts**:
  * **DPAD**: Navigate menus.
  * **MENU**: Open custom Server URL configuration dialog.
  * **BACK**: Exit prompt.

### Rebuilding & Installing the TV App:
```powershell
# 1. Build release APK
cd addons/motion-arcade
.\gradlew.bat assembleRelease

# 2. Push to TV (ensure TV is awake and ADB is connected)
adb connect 192.168.31.132:5555
adb install -r app\build\outputs\apk\release\app-release.apk

# 3. Launch on TV
adb shell am start -a android.intent.action.VIEW --es url "https://motion-tv-game.onrender.com/tv" -n com.motiontv.arcade/.MainActivity
```
*(Or simply double-click `push_to_tv.bat` in the repository root).*

---

## 💻 Local Development & Testing

### Prerequisites
* Node.js v18+ installed.
* (Optional) `cloudflared.exe` for local HTTPS tunneling.

### Running Locally
```bash
cd motion-tv-game
npm install
node server.js
```

### Server Endpoints & Ports
* **Default Port**: `3000` (or `PORT` environment variable).
* If port 3000 is occupied, the server automatically frees stale processes on Windows.
* Automatically initializes Cloudflare Tunnel (`cloudflared.exe`) if present for mobile HTTPS camera testing.

---

## 🔌 External Webhook / API Reference

You can send controller events from third-party apps like **ActionAndLink** or physical microcontrollers (ESP32, Arduino) via HTTP GET:

```http
GET /api/action?action=[ACTION]&room=[ROOM_ID]
```

### Parameters:
* `action`: `left` | `right` | `jump` | `fire` | `duck` | `start`
* `room`: TV Room ID (e.g. `TV-5048`). If omitted, broadcasts to the currently active TV.

**Example**:
```bash
curl "https://motion-tv-game.onrender.com/api/action?action=jump&room=TV-5048"
```
**Response**:
```json
{"success": true, "action": "jump", "relayedTo": "TV-5048"}
```

---

## 🔧 Key Engineering Solutions & Troubleshooting

| Challenge | Cause | Solution Implemented |
| :--- | :--- | :--- |
| **TV WebView WebGL2 Failure** | Amlogic/Mali GPU drivers blocklist WebGL2 (ES3) in older WebViews. | Added `?sim` query fallback to ROMP and routed pose injection through `globalThis.__romp.players[0]`. |
| **Mario Direction Inversion** | Front camera mirror in CSS caused user's right movement to map left. | Inverted torso X computation: `effectiveX = invertBody ? rawTorsoX : (1.0 - rawTorsoX)`. |
| **Jump Momentum Loss** | Mario velocity reset to 0 upon jump execution. | Rewrote jump physics in `mario.js` to preserve `vx` and adjusted air drag to `0.97`. |
| **Mobile Camera Access Denied** | Chrome requires a Secure Origin (HTTPS) to access `getUserMedia`. | Integrated Cloudflare Tunnel locally (`*.trycloudflare.com`) and deployed to Render with permanent SSL (`https://`). |
| **TV Wi-Fi Sleep** | Smart TV powers off Wi-Fi after ~5 min idle. | Automated reconnect loop in `push_to_tv.bat` and added `FLAG_KEEP_SCREEN_ON` in the TV app. |
| **Git Push 403 on GitHub** | Windows Credential Manager cached different user account. | Added collaborator access on GitHub and mapped remote URL explicitly. |

---

## 📄 License

MIT License. Designed and built for seamless, zero-cost family motion gaming.
