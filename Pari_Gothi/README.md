# 🎨 CollabCanvas — Real-Time Collaborative Multi-User Whiteboard

A high-performance, real-time collaborative whiteboard web application built using **Node.js, Express.js, Socket.io, and the HTML5 Canvas API**. Supports multi-room canvas partitioning, live collaborator cursor tracking, zero-latency vector stroke synchronization, synchronized undo, and instant board clearing.

---

## 🌟 Live Link: 
https://pari-gothi-150096725097assignment-11.onrender.com

---

## 🌟 Key Features

1. **Multi-Room Canvas Support**: Partition boards using a room query parameter (e.g., `?board=demo` or `?board=design-101`) or using the built-in room join switcher.
2. **Real-Time Stroke Synchronization**: Vector drawing segments broadcast across peers instantly with high-frequency precision.
3. **In-Memory History Buffer**: Complete stroke history per room is preserved in server memory. New joiners immediately receive all existing drawings on connect via `board:init`.
4. **Live Collaborator Cursor Tracking**: See other users' mouse pointers move across the canvas in real time with unique colors and display names.
5. **Continuous Stroke Undo**: Removes the last complete drawn stroke action (not just single line segments) and broadcasts the updated canvas snapshot (`board:sync`).
6. **Room Canvas Wipe**: Instantly reset and clear the whiteboard across all connected peers (`board:clear` & `board:cleared`).
7. **Clean Disconnect & Lifecycle Handling**: Automatically cleans up peers, removes active cursors, and updates collaborator lists when a peer disconnects.
8. **High-DPI Retina Display Crispness**: Scaled for device pixel ratio with custom tools (Brush, Eraser, Swatches, Custom Color Picker, Size Slider, PNG Export).

---

## 📁 Project Directory Structure

```text
Pari_Gothi/
├── public/
│   ├── index.html          # Full HTML5 Canvas collaborative UI & join modal
│   ├── canvas.js           # Client-side drawing logic & Socket.io event layer
│   └── styles.css          # Glassmorphic dark UI, toolbar & cursor styles
├── sockets/
│   ├── boardHandler.js     # Room join, stroke caching, clear & undo handlers
│   └── cursorHandler.js    # Live cursor coordinate streaming & relay
├── server.js               # Express + Socket.io bootstrap & CORS configuration
├── package.json            # Node.js dependencies & scripts
├── .env                    # Environment variables (PORT)
├── .env.example            # Environment variables template
├── .gitignore              # Ignored files (node_modules, .env)
└── README.md               # Documentation & setup guide
```

---

## 🔄 Socket.io Event Protocol Specification

### 1. Room & Session Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `board:join` | `Client ➔ Server` | `{ "boardId": "demo", "username": "Pari", "userColor": "#3b82f6" }` | Joins a collaborative whiteboard room (`socket.join(boardId)`). |
| `board:init` | `Server ➔ Client` | `{ "strokes": [...], "activeUsers": [...] }` | Emits full existing stroke history and active user list to the joining peer. |
| `user:joined` | `Server ➔ Room` | `{ "userId": "socket_id", "username": "Pari", "color": "#3b82f6" }` | Broadcast to existing room peers when a new member connects. |
| `user:left` | `Server ➔ Room` | `{ "userId": "socket_id", "username": "Pari" }` | Broadcast when a collaborator disconnects. |

### 2. Drawing & Pointer Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `draw:stroke` | `Client ➔ Server` | `{ "boardId": "demo", "stroke": { "strokeId": "...", "prevX": 100, "prevY": 50, "currX": 105, "currY": 55, "color": "#3b82f6", "size": 4, "mode": "brush" } }` | Appends a stroke line-segment to room memory buffer. |
| `draw:broadcast` | `Server ➔ Room (broadcast)` | `{ "stroke": { ... } }` | Relays the stroke to all other room participants in real time. |
| `cursor:move` | `Client ➔ Server` | `{ "boardId": "demo", "x": 120, "y": 80 }` | High-frequency mouse/touch coordinates from client. |
| `cursor:update` | `Server ➔ Room (broadcast)` | `{ "userId": "socket_id", "x": 120, "y": 80 }` | Relays peer cursor positions to show live collaborator cursors. |
| `board:clear` | `Client ➔ Server` | `{ "boardId": "demo" }` | Requests server-side canvas reset for the room. |
| `board:cleared` | `Server ➔ Room` | `{ "clearedBy": "Pari" }` | Instructs all room participants to wipe local canvas. |
| `draw:undo` | `Client ➔ Server` | `{ "boardId": "demo" }` | Removes the last continuous stroke action by `strokeId`. |
| `board:sync` | `Server ➔ Room` | `{ "strokes": [...] }` | Broadcasts full state snapshot to redraw canvas after undo. |

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
Navigate into the `Pari_Gothi` directory and install the packages:

```bash
cd Pari_Gothi
npm install
```

### 2. Run the Application
For production start:
```bash
npm start
```

For development mode (with hot reloading via `nodemon`):
```bash
npm run dev
```

### 3. Open in Browser
Visit `http://localhost:5000` or open multi-tab tests:
- Window 1: `http://localhost:5000?board=demo`
- Window 2: `http://localhost:5000?board=demo`

---

## 🧪 Testing Verification Flow

1. **Zero-Lag Drawing**: Draw in Window 1 — Window 2 immediately renders the exact stroke.
2. **Live Collaborator Cursor**: Move pointer in Window 1 — Window 2 displays a colored cursor tag following the pointer in real time.
3. **New Joiner History Sync**: Open Window 3 in an Incognito Tab with `?board=demo` — it instantly receives and displays all prior strokes via `board:init`.
4. **Synchronized Undo**: Press Undo (`Ctrl+Z` or Undo button) in Window 1 — the last continuous stroke vanishes in all connected windows via `board:sync`.
5. **Canvas Clear**: Click Clear in Window 1 — all connected windows reset their canvas synchronously via `board:cleared`.

---

## ☁️ Deployment Instructions

### A. Upload to GitHub

1. Ensure Git is initialized and commit your code:
```bash
cd Pari_Gothi
git init
git add .
git commit -m "feat: complete real-time collaborative whiteboard with socket.io"
```

2. Create a new repository on [GitHub](https://github.com/new), for example named `itm-assignment-11-whiteboard-socket`.

3. Link your remote repository and push:
```bash
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/itm-assignment-11-whiteboard-socket.git
git push -u origin main
```

---

### B. Deploy on Render (Web Service)

1. Sign in to [Render](https://render.com/).
2. Click **New +** ➔ **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repository (`itm-assignment-11-whiteboard-socket`).
4. Configure the Web Service settings:
   - **Name**: `collab-whiteboard` (or any custom name)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Once deployed, Render will provide a live public URL (e.g. `https://collab-whiteboard.onrender.com`).
7. Test the live multi-user whiteboard by opening:
   `https://collab-whiteboard.onrender.com?board=demo` in two separate browser tabs.
