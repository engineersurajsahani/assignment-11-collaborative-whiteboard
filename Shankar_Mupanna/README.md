# Real-Time Collaborative Whiteboard & Canvas (Socket.io)

A high-performance Real-Time Collaborative Multi-User Whiteboard Application built using **Node.js**, **Express.js**, **Socket.io**, and **HTML5 Canvas API**.

This project enables real-time vector stroke streaming, synchronized draw history buffers in server memory per room (`boardId`), live multi-user cursor tracking, and coordinated room canvas actions such as `undo` and `clear`.

---

## 🎨 Features & Key Highlights

- **Multi-Tenant Room Partitioning (`boardId`)**: Users can join any whiteboard room (e.g. `DESIGN_101`) or switch rooms via query param `?board=YOUR_ROOM`.
- **Real-Time Vector Stroke Streaming**: High-frequency drawing stroke streaming with near-zero latency using Socket.io WebSocket connections.
- **In-Memory Board History (`board:init`)**: Server maintains stroke history per room; newly joined peers instantly sync and render existing canvas drawings.
- **Live Collaborator Cursors (`cursor:move` & `cursor:update`)**: Live mouse cursor position streaming displaying user names and custom avatar colors across connected peers.
- **Continuous Stroke Undo (`draw:undo` & `board:sync`)**: State rollback algorithm that removes the last continuous stroke action and broadcasts updated canvas snapshot to room participants.
- **Canvas Reset (`board:clear` & `board:cleared`)**: Instant coordinated canvas reset across all connected clients in a room.
- **Responsive High-DPI Canvas**: Canvas scales dynamically to high-DPI / retina displays with touch support for mobile/tablet devices.

---

## 🛠️ Directory Structure

```
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html           # Full HTML5 Canvas collaborative interface
│   ├── canvas.js            # Client-side drawing & socket event handler
│   └── styles.css           # Toolbars, color pickers, cursors & layout
├── sockets/
│   ├── boardHandler.js      # Room join, stroke caching & canvas reset handlers
│   └── cursorHandler.js     # Live cursor coordinate streaming
├── server.js                # Express & Socket.io server bootstrap
├── package.json             # Dependencies and npm scripts
├── .env                     # Server environment variables
└── README.md                # Project documentation & instructions
```

---

## 🔄 Real-Time Socket Event Protocol

### 1. Room & Session Events
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client -> Server | `{ "boardId": "DESIGN_101", "username": "Alice", "userColor": "#ff5722" }` | Join a collaborative canvas room |
| `board:init` | Server -> Client | `{ "strokes": [...], "activeUsers": [...] }` | Emits complete stroke history to newly joined peer |
| `user:joined` | Server -> Room | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722" }` | Notifies other participants in the board room |
| `user:left` | Server -> Room | `{ "userId": "socket_id", "username": "Alice" }` | Broadcasted when a peer disconnects |

### 2. Drawing & Pointer Events
| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `draw:stroke` | Client -> Server | `{ "boardId": "...", "stroke": { "strokeId": "...", "prevX": 120, "prevY": 80, "currX": 125, "currY": 85, "color": "#000", "size": 3 } }` | Client draws a line segment; server appends to room history |
| `draw:broadcast` | Server -> Room | `{ "stroke": { ... } }` | Relays drawing stroke to all other participants in the room |
| `cursor:move` | Client -> Server | `{ "boardId": "...", "x": 140, "y": 95 }` | High-frequency mouse pointer sync |
| `cursor:update` | Server -> Room | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722", "x": 140, "y": 95 }` | Relays peer cursor positions on screen |
| `board:clear` | Client -> Server | `{ "boardId": "DESIGN_101" }` | Clears all strokes for this room |
| `board:cleared` | Server -> Room | `{ "clearedBy": "Alice" }` | Notifies all room peers to wipe their local canvas |
| `draw:undo` | Client -> Server | `{ "boardId": "DESIGN_101" }` | Removes the last continuous stroke action |
| `board:sync` | Server -> Room | `{ "strokes": [...] }` | Broadcasts new state snapshot after undo |

---

## ⚡ Quick Start & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Or start production server:
```bash
npm start
```

Server will run at: `http://localhost:5000`

---

## 🧪 Testing & Validation Guide

1. Open **Window 1** in Chrome: [http://localhost:5000?board=demo&name=Alice](http://localhost:5000?board=demo&name=Alice).
2. Open **Window 2** side-by-side in Incognito mode: [http://localhost:5000?board=demo&name=Bob](http://localhost:5000?board=demo&name=Bob).
3. **Draw in Window 1**: Verify Window 2 renders exact stroke in real time without latency.
4. **Move Mouse in Window 1**: Verify colored collaborator cursor for "Alice" moves smoothly in Window 2.
5. **Open Window 3** in a 3rd tab: Verify it instantly receives `board:init` and syncs all existing canvas strokes automatically.
6. **Click Undo in Window 1**: Verify the last stroke is removed and synced across Windows 1, 2, and 3 via `board:sync`.
7. **Click Clear Canvas in Window 1**: Verify all 3 windows instantly wipe their canvas via `board:cleared`.
