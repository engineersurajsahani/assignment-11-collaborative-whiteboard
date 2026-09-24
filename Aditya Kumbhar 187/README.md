# Assignment 11: Real-Time Collaborative Whiteboard & Canvas (Socket.io)

**Student Name:** Aditya Kumbhar  
**Roll No:** 187  
**Track:** Backend & Real-Time Web  
**Tech Stack:** Node.js, Express.js, Socket.io, HTML5 Canvas API, CORS, Dotenv  
Live Link: https://assignment-11-collaborative-whiteboard-tmke.onrender.com
---

## 📌 Project Overview

This project is a **Real-Time Collaborative Multi-User Whiteboard Application** built using **Node.js, Express.js, and Socket.io**. It allows multiple users to join the same whiteboard room, draw synchronously in real time, view each other's live mouse cursors, undo previous continuous strokes, and clear the canvas across all connected peers.

---

## ✨ Features

- **Multi-Room Management:** Users can join isolated whiteboard rooms via query parameters (e.g., `?board=DESIGN_101`) or share an invite link.
- **Real-Time Vector Stroke Synchronization:** Continuous drawing paths stream instantly across connected peers with minimal latency.
- **In-Memory Board State & History Buffer:** New users immediately sync existing canvas drawings upon joining via `board:init`.
- **Live Collaborator Cursor Tracking:** High-frequency cursor streaming shows peer mouse positions with custom name badges and colors.
- **Undo & State Rollback:** Undo functionality rolls back the last continuous stroke action and syncs the canvas state for all participants.
- **Canvas Reset:** Synchronized `board:clear` event wipes the whiteboard across all active users.
- **Responsive Canvas & Toolbar:** Includes Pen and Eraser tools, quick color palette + custom color picker, stroke width slider, active collaborators avatars, and PNG export.

---

## 📁 Directory Structure

```text
Aditya Kumbhar 187, assignment 11/
├── public/
│   ├── index.html           # Full HTML5 Canvas collaborative interface
│   ├── canvas.js            # Client-side drawing & socket event emitter
│   └── styles.css           # Toolbars, color pickers & canvas layout
├── sockets/
│   ├── boardHandler.js      # Room join, stroke caching & canvas reset handlers
│   └── cursorHandler.js     # Live cursor coordinate streaming
├── server.js                # Express & Socket.io server bootstrap
├── package.json
├── .env
├── .env.example
├── .gitignore
└── README.md
```

---

## 🖌️ Real-Time Canvas Event Protocol

### 🔄 Room & Session Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `board:join` | `Client -> Server` | `{ "boardId": "DESIGN_101", "username": "Alice", "userColor": "#ff5722" }` | Join a collaborative canvas room |
| `board:init` | `Server -> Client` | `{ "strokes": [...], "activeUsers": [...] }` | Emits complete stroke history to the newly joined peer |
| `user:joined` | `Server -> Room` | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722" }` | Notifies other participants in the board room |
| `user:left` | `Server -> Room` | `{ "userId": "socket_id", "username": "Alice" }` | Broadcasted when a peer disconnects |

### ✏️ Drawing & Pointer Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `draw:stroke` | `Client -> Server` | `{ "boardId": "...", "stroke": { "prevX": 120, "prevY": 80, "currX": 125, "currY": 85, "color": "#000", "size": 3, "strokeId": "..." } }` | Client draws a line segment; server appends to room history |
| `draw:broadcast` | `Server -> Room` | `{ "stroke": { ... } }` | Relays drawing stroke to all other participants in the room |
| `cursor:move` | `Client -> Server` | `{ "boardId": "...", "x": 140, "y": 95 }` | High-frequency mouse pointer sync |
| `cursor:update` | `Server -> Room` | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722", "x": 140, "y": 95 }` | Relays peer cursor positions on screen |
| `board:clear` | `Client -> Server` | `{ "boardId": "DESIGN_101" }` | Clears all strokes for this room |
| `board:cleared` | `Server -> Room` | `{ "clearedBy": "Alice" }` | Notifies all room peers to wipe their local canvas |
| `draw:undo` | `Client -> Server` | `{ "boardId": "DESIGN_101" }` | Removes the last continuous stroke action |
| `board:sync` | `Server -> Room` | `{ "strokes": [...] }` | Broadcasts new state snapshot after undo |

---

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file (or copy from `.env.example`):
```env
PORT=5000
```

### 3. Start Server
```bash
# Start server with node
npm start

# Or run with nodemon in development mode
npm run dev
```

---

## 🧪 Testing & Validation

1. Start the server and visit `http://localhost:5000?board=demo&user=Alice`.
2. Open a second browser window at `http://localhost:5000?board=demo&user=Bob`.
3. **Real-time Drawing:** Draw in Window 1 and watch it appear in Window 2 simultaneously.
4. **Live Cursors:** Move mouse in Window 1; verify Bob's screen displays Alice's colored cursor with her name badge.
5. **State Sync for Late Joiners:** Open a third window/incognito tab at `http://localhost:5000?board=demo`; verify all existing strokes load immediately via `board:init`.
6. **Undo & Clear:** Click **Undo** to revert the last continuous stroke; click **Clear** to wipe the canvas across all connected windows.
