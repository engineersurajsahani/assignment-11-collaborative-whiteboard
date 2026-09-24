# 🎨 Real-Time Collaborative Whiteboard & Canvas (Socket.io)

A high-performance, real-time multi-user collaborative whiteboard built with **Node.js**, **Express.js**, **Socket.io**, and **HTML5 Canvas**.

---

## 🌟 Features

- ⚡ **Zero-Latency Stroke Streaming:** Continuous vector stroke streaming renders locally immediately while broadcasting coordinates to peers.
- 👥 **Multi-Tenant Whiteboard Rooms (`boardId`):** Isolated rooms powered by `socket.join(boardId)`. Collaborate across distinct boards via URL query params (e.g., `?board=DESIGN_101`).
- 🔄 **In-Memory Stroke History Buffer:** Server caches full draw history per board. New joiners receive the complete snapshot instantly via `board:init`.
- 🖱️ **Live Collaborator Pointers:** High-frequency, ephemeral cursor delta broadcasting with user labels and color identification.
- ↩️ **Continuous Stroke Undo & Rollback:** Grouped continuous stroke actions rollback cleanly via `draw:undo` and `board:sync`.
- 🗑️ **Global Canvas Reset:** Coordinated canvas clear across all connected clients via `board:clear` and `board:cleared`.
- 📱 **High-DPI & Responsive Canvas:** Responsive full-screen canvas supporting retina displays and mobile touch devices.

---

## 🏗️ Directory Structure

```
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html        # Clean HTML5 UI with toolbar, avatars, and overlays
│   ├── canvas.js         # Canvas rendering, socket events, and cursor logic
│   └── styles.css        # Modern glassmorphic toolbar, avatars, and toasts
├── sockets/
│   ├── boardHandler.js   # Room lifecycle, strokes buffer, clear, & undo
│   └── cursorHandler.js  # Ephemeral high-frequency pointer sync
├── server.js             # Express & Socket.io server entry point
├── .env.example          # Environment variable template
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies and npm scripts
└── README.md             # Project documentation
```

---

## 🚀 Quick Start

### 1. Installation

Navigate into the project directory and install dependencies:

```bash
cd Dharmit_Sathvara/assignment-11-whiteboard-socket
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000` (or `process.env.PORT`).

### 3. Production Start

```bash
npm start
```

---

## 🧪 Testing with Multiple Windows

1. Open your browser and navigate to:
   ```
   http://localhost:5000?board=demo
   ```
2. Enter a display name (e.g., *Alice*) and pick an avatar color.
3. Open a second window (or incognito tab) to the same URL:
   ```
   http://localhost:5000?board=demo
   ```
4. Enter another name (e.g., *Bob*).
5. **Test Real-Time Sync:**
   - Draw in Window 1: Window 2 renders strokes in real time without lag.
   - Move mouse in Window 1: A colored collaborator cursor moves smoothly in Window 2.
   - Click **Undo**: The last drawn stroke group is undone across both windows.
   - Click **Clear Canvas**: Both windows clear instantly and display a notification.
6. **Test Late Joiner State:**
   - Draw several strokes, then open a third tab at `http://localhost:5000?board=demo`. All previous strokes are rendered immediately upon joining via `board:init`.

---

## 📡 Real-Time Canvas Event Protocol

### 🔄 Room & Session Events

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client → Server | `{ boardId, username, userColor }` | Joins a collaborative canvas room |
| `board:init` | Server → Client | `{ strokes: [...], activeUsers: [...] }` | Sends full stroke history to the newly joined peer |
| `user:joined` | Server → Room | `{ userId, username, color }` | Notifies other participants in the room |
| `user:left` | Server → Room | `{ userId, username }` | Broadcast on disconnect |

### ✏️ Drawing & Pointer Events

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `draw:stroke` | Client → Server | `{ boardId, stroke: { prevX, prevY, currX, currY, color, size, groupId } }` | Client draws a line segment; server appends to room history |
| `draw:broadcast` | Server → Room | `{ stroke: {...} }` | Relays stroke to all other room participants |
| `cursor:move` | Client → Server | `{ boardId, x, y }` | High-frequency pointer sync (ephemeral) |
| `cursor:update` | Server → Room | `{ userId, x, y, username, color }` | Relays peer cursor position to other participants |
| `board:clear` | Client → Server | `{ boardId }` | Clears all strokes for the room |
| `board:cleared` | Server → Room | `{ clearedBy }` | Tells peers to wipe local canvas |
| `draw:undo` | Client → Server | `{ boardId }` | Removes last continuous stroke action |
| `board:sync` | Server → Room | `{ strokes: [...] }` | Broadcasts new state snapshot after undo |

---

## 🧠 Architecture & Algorithmic Design

### In-Memory Server State
The server maintains state entirely in memory structured by room:
```javascript
const boardRooms = {
  "DESIGN_101": {
    boardId: "DESIGN_101",
    strokes: [], // Array of stroke objects
    users: {}    // socketId -> { username, color, cursor: { x, y } }
  }
};
```

### Undo Algorithm
1. Each continuous drawing gesture (mouse down → drag → mouse up) is tagged with a unique `groupId` on the client.
2. Every line segment within that continuous gesture inherits this `groupId`.
3. When `draw:undo` is received, the server looks up the `groupId` of the last stroke in `room.strokes` and filters out all segments with that `groupId`.
4. The server broadcasts a lightweight `board:sync` snapshot to all clients in the room, ensuring consistent canvas state.

### Ephemeral Cursor Throttling
Cursor updates are throttled to ~40fps (`25ms`) on the client and are broadcast without appending to `room.strokes`, ensuring negligible server memory overhead and smooth 60fps local rendering.

---

## ☁️ Deployment on Render

This application is ready for deployment as a Web Service on [Render](https://render.com/):

1. **Service Type:** Web Service (Node.js runtime)
2. **Root Directory:** `Dharmit_Sathvara/assignment-11-whiteboard-socket`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Environment Variables:** `PORT=5000` (automatically set by Render)

> **Note on Free-Tier Behavior:** Render's free tier spins down instances after periods of inactivity. Because state is kept in memory (`boardRooms`), any board history resets if the instance restarts. For production, stroke history can be persisted to a database (Redis/MongoDB/PostgreSQL).
