# 🎨 Assignment 11: Real-Time Collaborative Whiteboard & Canvas (Socket.io)

A high-performance, real-time multi-user collaborative whiteboard application built with **Node.js**, **Express.js**, **Socket.io**, and the **HTML5 Canvas API**.

---

## 🌟 Key Features

- **Real-Time Vector Stroke Synchronization**: Continuous freehand drawing, straight lines, rectangles, circles, and eraser streams synchronized across all connected peers with low latency.
- **In-Memory History Buffer (`boardRooms`)**: Server retains room stroke history so newly connected clients immediately render prior drawing actions on join (`board:init`).
- **Live Collaborator Cursor Tracking**: Real-time peer cursor coordinates stream smoothly with user name tags and custom color pointers.
- **Multi-Tenant Room Partitioning (`boardId`)**: Isolated whiteboard rooms allowing concurrent collaborative sessions via custom room IDs or URL parameters (`?board=DESIGN_101`).
- **State Rollback & Canvas Reset**: Supports multi-user `draw:undo` stroke rollback and `board:clear` canvas wipes.
- **High-DPI Retina Display Support**: Dynamic HTML5 canvas scaling (`window.devicePixelRatio`) ensuring crisp vector rendering across all displays.
- **Glassmorphism Dark Theme Interface**: Sleek UI with floating toolbars, color palettes, size controls, online user lists, and export to PNG functionality.

---

## 🛠️ Tech Stack & Dependencies

- **Backend**: Node.js, Express.js, Socket.io, CORS, dotenv
- **Frontend**: HTML5 Canvas API, Vanilla JavaScript, CSS3 (Glassmorphism), FontAwesome Icons
- **Dev Tools**: Nodemon

---

## 📁 Directory Structure

```
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html           # Full HTML5 Canvas collaborative interface
│   ├── canvas.js            # Client-side drawing engine & socket event handlers
│   └── styles.css           # Toolbars, color pickers, modals & dark theme layout
├── sockets/
│   ├── boardHandler.js      # Room join, stroke caching, undo & clear handlers
│   └── cursorHandler.js     # Live peer cursor coordinate streaming
├── server.js                # Express & Socket.io server bootstrap
├── package.json
└── README.md
```

---

## 🔄 Real-Time Canvas Socket Event Protocol

### 1. Room & Session Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client -> Server | `{ "boardId": "DESIGN_101", "username": "Alice", "userColor": "#ff5722" }` | Join a collaborative canvas room |
| `board:init` | Server -> Client | `{ "strokes": [...], "activeUsers": [...] }` | Emits complete stroke history & user list to newly joined peer |
| `user:joined` | Server -> Room | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722" }` | Notifies other participants in the board room |
| `user:left` | Server -> Room | `{ "userId": "socket_id", "username": "Alice" }` | Broadcasted when a peer disconnects |

### 2. Drawing & Pointer Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `draw:stroke` | Client -> Server | `{ "boardId": "...", "stroke": { "prevX": 120, "prevY": 80, "currX": 125, "currY": 85, "color": "#000", "size": 3, "tool": "pencil" } }` | Client draws stroke; server appends to room history |
| `draw:broadcast` | Server -> Room | `{ "stroke": { ... } }` | Relays drawing stroke to all other room participants |
| `cursor:move` | Client -> Server | `{ "boardId": "...", "x": 140, "y": 95 }` | High-frequency mouse pointer sync |
| `cursor:update` | Server -> Room | `{ "userId": "socket_id", "x": 140, "y": 95 }` | Relays peer cursor positions on screen |
| `board:clear` | Client -> Server | `{ "boardId": "DESIGN_101" }` | Clears all strokes for this room |
| `board:cleared` | Server -> Room | `{ "clearedBy": "Alice" }` | Notifies room peers to wipe local canvas |
| `draw:undo` | Client -> Server | `{ "boardId": "DESIGN_101" }` | Removes the last continuous stroke action |
| `board:sync` | Server -> Room | `{ "strokes": [...] }` | Broadcasts state snapshot after undo |

---

## 🚀 Quick Start & Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd assignment-11-whiteboard-socket
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   # Production mode
   npm start

   # Development mode (with nodemon)
   npm run dev
   ```

4. Open your browser and navigate to:
   `http://localhost:5000`

---

## 🧪 Testing & Validation Guide

1. Start server at `http://localhost:5000`.
2. Open two browser windows side-by-side on `http://localhost:5000?board=demo`.
3. Join Window 1 as "Alice" and Window 2 as "Bob".
4. **Real-Time Drawing**: Draw in Window 1 and verify Window 2 renders the exact stroke live without lag.
5. **Cursor Tracking**: Move mouse in Window 1 and observe Alice's color-coded cursor moving smoothly in Window 2.
6. **State Persistence**: Open a 3rd browser window in Incognito mode at `http://localhost:5000?board=demo`. Verify it immediately loads all prior strokes via `board:init`.
7. **Canvas Clear**: Click **Clear Canvas** in Window 1 and verify Windows 2 and 3 instantly wipe their canvas context.
8. **Undo**: Draw several lines, click **Undo** (or press `Ctrl+Z`), and verify the last continuous stroke action is removed across all active peers.
