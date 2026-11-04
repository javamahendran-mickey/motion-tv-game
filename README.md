# 🎮 Neon Motion Strike: Smart TV Motion Gaming with Android

A real-time motion capture and motion controller arcade game designed for **Smart TVs** (Android TV, Google TV, Samsung Tizen, LG webOS, Fire TV) powered by an **Android smartphone** as the wireless motion tracking controller.

**Zero installations required on either the TV or the Phone!** Everything runs directly in the browser using WebSockets, Web Audio API, HTML5 Canvas, Device Motion sensors, and Google MediaPipe Pose.

---

## ✨ Features

- **🗡️ Mode 1: Handheld Motion Saber (IMU Sensors)**
  - Hold your Android phone in hand like a sword hilt or racket.
  - Real-time 3D tilt tracking (`DeviceOrientation` - pitch, roll, yaw).
  - Physical swing and slash gesture detection (`DeviceMotion` G-force acceleration).
  - Built-in **haptic vibration feedback** (`navigator.vibrate`) when you hit targets on TV!

- **🧍 Mode 2: Optical Full-Body Camera Tracking (Kinect Style)**
  - Prop your phone upright facing your play area (2–3 meters away).
  - Uses the phone's front or rear camera with **Google MediaPipe Pose**.
  - Tracks player movement left/right to dodge barriers and forward hand punches to strike.

- **📺 Smart TV Arcade Canvas**
  - High-performance 60 FPS cyberpunk rhythm / dodge arcade game.
  - Multi-lane perspective grid, particle explosion effects, and floating damage numbers.
  - **3 Game Modes**: *Neon Saber* (rhythm slashes), *Cyber Dodge* (lane evasion), and *Shadow Punch* (boxing).
  - Procedural Web Audio synthesizer (zero audio asset downloads required).
  - Live QR code pairing and sub-10ms latency relay.

---

## 🚀 Quick Start Guide

### 1. Start the Server on your Computer
Open a terminal in this directory (`motion-tv-game`) and run:

```bash
npm start
```
*(Or `node server.js`)*

The console will output your local network address:
```
======================================================
📡 Local Network IP: 192.168.1.50
📺 Smart TV URL:     http://192.168.1.50:3000/tv
📱 Phone Controller: http://192.168.1.50:3000/phone
======================================================
```

### 2. Open on your Smart TV
1. Open the web browser on your Smart TV (Chrome, TV Bro, Silk, Samsung Internet, or LG Web Browser).
2. Type in the **Smart TV URL** shown in the console (e.g., `http://192.168.1.50:3000/tv`).
3. You will see the lobby screen with a large **QR code**.

### 3. Connect your Android Phone
1. Open your Android phone's camera app or QR scanner.
2. Scan the QR code displayed on your TV screen.
3. Tap the link to open the controller web app.
4. The TV will instantly indicate **"PHONE CONNECTED"** with a green status light.
5. Choose your mode:
   - **Handheld Saber**: Hold your phone and swing!
   - **Body Camera Track**: Tap "Body Camera Track", prop the phone up, and tap "Start Body Tracker".
6. Press **START GAME** on the TV or phone to play!

---

## 🛠️ Architecture & Tech Stack

```
[ Android Phone ]
   ├── Gyroscope & Accelerometer (devicemotion, deviceorientation)
   ├── MediaPipe Pose (33 skeletal keypoints at 30 FPS)
   └── Haptic Engine (navigator.vibrate)
              │
              ▼ (JSON over WebSocket < 10ms latency)
     [ Node.js Relay Server ] (server.js)
              │
              ▼ (Relays motion packets & returns hit vibrations)
      [ Smart TV Browser ]
         ├── HTML5 60 FPS Canvas Game Engine
         ├── Perspective 3D Grid & Particle System
         └── Web Audio API Sound Synthesizer
```

---

## 💡 Tips for Best Experience

1. **Local Wi-Fi**: Ensure your PC, Smart TV, and Android phone are all connected to the same Wi-Fi network (5 GHz recommended for minimum latency).
2. **Wrist Safety**: When using Handheld Mode, hold your phone firmly or use a phone case / lanyard.
3. **Lighting for Camera Mode**: In Optical Body Tracking mode, ensure the room has good lighting so the camera can clearly detect your shoulders and wrists.
# motion-tv-game
