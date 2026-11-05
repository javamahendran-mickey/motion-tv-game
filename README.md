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
* **Casting & Playback Architecture**:
  * **Why Casting is Used on Smart TVs**: ROMP's 3D engine (PlayCanvas 2.x) strictly requires **WebGL 2 (OpenGL ES 3.0)** for uniform buffer layouts (`layout(std140)`). Smart TVs with Mali-450 / Amlogic SoCs only support WebGL 1 (OpenGL ES 2.0); running PlayCanvas directly inside the TV's WebView results in an unsupported WebGL driver error (showing only the CSS blue background).
  * **Option A: Built-in 1-Tap WebRTC Cast**: Open ROMP on your smartphone (`https://motion-tv-game.onrender.com/romp/`) and tap the glowing **"📺 Cast to TV"** button. The phone renders the 3D game and AI pose skeleton at 60 FPS and streams low-latency 1080p video directly to the TV receiver (`/romp-tv`).
  * **Option B: Native Android Smart View / Google Cast**: Swipe down on your phone's notification shade, tap **"Smart View"** or **"Cast Screen"**, and choose your Thomson TV.
  * **Option C: Native TV Games (Mario & Neon Strike)**: Super Mario (`/mario`) and Neon TV Arcade (`/tv`) use HTML5 Canvas 2D and run natively on the TV hardware at 60 FPS while being controlled remotely by your phone camera!

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

### ⏰ 24/7 Keep-Alive Monitoring (Zero Cold Starts)
Render's free tier spins down services after 15 minutes of inactivity. To prevent sleep and keep the server hot 24/7 for free:
* **UptimeRobot Monitor**: [UptimeRobot Monitor #804546759](https://dashboard.uptimerobot.com/monitors/804546759)
* **Target Endpoint**: `https://motion-tv-game.onrender.com/api/info` (HTTP ping every 5–10 minutes).
* **Result**: Keeps the Render container active continuously, giving you 0 cold starts and instant connection on both TV and phone without paying any monthly fees.

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
| **Motion Sensor Jitter & Clip** | Fixed 14° linear clipping and step filter caused twitchy or sluggish tilt. | Replaced with velocity-adaptive filter ($\alpha \in [0.48, 0.92]$), $1.2^\circ$ deadzone, and non-linear power curve up to $26^\circ$. |
| **Game Browsing on Mobile** | Players had to navigate TV menus with physical remotes. | Added full vertical Games List on the phone controller with 1-tap TV switching across 11 games. |
| **Intrusive Sensor Permission Popups** | Browser permission checks nagged player on load. | Replaced with silent auto-initialization on first touch/click without modal prompts. |

---

## 🕹️ Full 11-Game Suite Catalog

| Game | Mode | Category | Controls & Motion Feedback |
| :--- | :--- | :--- | :--- |
| **Super Mario Motion** | `mario` | Platformer | Tilt phone left/right or use D-Pad to run; swing or tap to jump and fire! |
| **Fruit Ninja Motion** | `fruit` | Sword Slicer | Slice flying fruit with physical sword swings using your phone's IMU. |
| **Neon Saber Rhythm** | `saber` | Rhythm Blade | Slice incoming neon beat cubes to the rhythm of high-energy cyber tracks. |
| **Neon Kart Racer** | `kart` | Tilt Steering | Turn phone like a steering wheel to steer, drift & hit turbo nitro. |
| **Galaxy Rider** | `dodge` | Space Dodger | Steer starship through asteroid storms, avoid mines, and collect gems. |
| **Wii Grand Slam Tennis**| `tennis` | Sports Smash | Serve, volley, and smash tennis balls with natural racket swings. |
| **Wizard Spell Duel** | `wizard` | Magic Wand | Flick your wand to cast explosive fire and lightning spells. |
| **Balloon Pop Carnival** | `balloon` | Darts Arcade | Aim and flick darts to pop vibrant flying carnival prize balloons. |
| **Monster Alien Bonk** | `boxing` | Punch Whack | Whack pesky space aliens as they pop up with rapid punches. |
| **Soccer Penalty Striker**| `soccer` | Penalty Kick | Curve kicks into the goal net or block shots as goalkeeper. |
| **ROMP 17-in-1 Suite** | `romp` | Full-Body Fitness | 17 motion games: Jump, Duck, Pulse, Goalie, Slice, Sprint, Forge & more. |

---

## 📱 High-Precision Motion Sensor Engine

The mobile motion sensor engine (`public/phone.js` and `public/tv.js`) delivers console-grade responsiveness:
* **Micro-Deadzone ($1.2^\circ$)**: Filters out natural hand micro-tremors without introducing dead feeling.
* **Progressive Non-Linear Steering Curve**: $E = \text{sign}(\theta) \times (|\theta - 1.2| / 24.8)^{1.15}$ provides pixel-level fine aiming at small angles while allowing full steering deflection at a comfortable $26^\circ$ wrist tilt.
* **Continuous Velocity-Adaptive Smoothing**: Dynamically scales the low-pass filter factor $\alpha \in [0.48, 0.92]$ based on angular velocity $\Delta \theta$, eliminating sluggishness during rapid turns and preventing jitter when still.
* **3D Vector Jerk Strike Detection**: Combines pure linear acceleration with 3D jerk $\Delta a / \Delta t$ to distinguish deliberate sword strikes, racket swings, and punches from casual phone motion.
* **Live Steering HUD**: Real-time visual track and degree readout right on the controller so the player always knows their tilt angle and neutral balance point.

---

## 📄 License

MIT License. Designed and built for seamless, zero-cost family motion gaming.
