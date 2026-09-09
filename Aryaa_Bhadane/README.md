# 🎨 Real-Time Collaborative Whiteboard & Canvas (Socket.io)

> **Author:** Aryaa Bhadane  
> **Tech Stack:** Node.js, Express.js, Socket.io, HTML5 Canvas API, CORS, Dotenv  

---

## 📌 1. Project Overview & Architecture

**SyncBoard** is a high-performance, real-time collaborative multi-user whiteboard application built using **Node.js**, **Express.js**, and **Socket.io**.

It allows multiple remote participants to:
- Simultaneously draw continuous vector strokes with ultra-low latency.
- Share synchronized canvas draw history across dynamically partitioned multi-tenant rooms (`boardId`).
- Track live collaborator cursors and nametags with sub-millisecond updates.
- Execute coordinated canvas management actions, including synchronized state rollbacks (`draw:undo`) and board clears (`board:clear`).

```
+-----------------------------------------------------------------------------------+
|                               Client Browser A                                    |
|   (HTML5 Canvas API, Pointer & Touch Tracking, Socket.io Client, Throttled Sync)   |
+------------------------------------------+----------------------------------------+
                                           |
                              WebSocket / WSS Stream
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                                Node.js & Express                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                           Socket.io Engine                                  |  |
|  |                                                                             |  |
|  |  +--------------------------+          +---------------------------------+  |  |
|  |  |   sockets/boardHandler   |          |      sockets/cursorHandler      |  |  |
|  |  |   (Rooms, Strokes, Undo) |          |      (Lightweight Cursors)      |  |  |
|  |  +--------------------------+          +---------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                    In-Memory Board State Store (boardRooms)                 |  |
|  |                                                                             |  |
|  |  "DESIGN_101": {                                                            |  |
|  |     boardId: "DESIGN_101",                                                  |  |
|  |     strokes: [ { prevX, prevY, currX, currY, color, size, actionId }, ... ],|  |
|  |     users:   { socketId: { username, color, cursor: { x, y } } }            |  |
|  |  }                                                                          |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 2. Quick Start & Setup Instructions

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### Installation & Execution

1. **Navigate to the project root:**
   ```bash
   cd Desktop/assignment-11-collaborative-whiteboard/Aryaa_Bhadane
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server with live reload:**
   ```bash
   npm run dev
   ```

4. **Or start in production mode:**
   ```bash
   npm start
   ```

5. **Open the application:**
   Navigate to [http://localhost:5000](http://localhost:5000) or open a specific room directly with query parameter [http://localhost:5000?board=demo](http://localhost:5000?board=demo).

---

## 📡 3. Real-Time Canvas Event Protocol

### 🔄 Room & Session Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `board:join` | `Client -> Server` | `{ "boardId": "DESIGN_101", "username": "Alice", "userColor": "#ff5722" }` | Client joins a collaborative canvas room |
| `board:init` | `Server -> Client` | `{ "strokes": [...], "activeUsers": [...] }` | Emits complete stroke history and participant list to newly joined peer |
| `user:joined` | `Server -> Room` | `{ "userId": "socket_id", "username": "Alice", "color": "#ff5722" }` | Notifies other participants in the board room of arrival |
| `user:left` | `Server -> Room` | `{ "userId": "socket_id", "username": "Alice" }` | Broadcasted to room peers when a collaborator disconnects |

### ✏️ Drawing & Pointer Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `draw:stroke` | `Client -> Server` | `{ "boardId": "...", "stroke": { "prevX": 120, "prevY": 80, "currX": 125, "currY": 85, "color": "#000", "size": 3, "actionId": "..." } }` | Client draws a line segment; server appends to room history |
| `draw:broadcast` | `Server -> Room (broadcast.to)` | `{ "stroke": { ... } }` | Relays drawing stroke to all other participants in the room |
| `cursor:move` | `Client -> Server` | `{ "boardId": "...", "x": 140, "y": 95 }` | High-frequency mouse pointer coordinate sync |
| `cursor:update` | `Server -> Room (broadcast.to)` | `{ "userId": "socket_id", "x": 140, "y": 95 }` | Relays peer cursor positions on screen |
| `board:clear` | `Client -> Server` | `{ "boardId": "DESIGN_101" }` | Requests clearing of all strokes for this room |
| `board:cleared` | `Server -> Room` | `{ "clearedBy": "Alice" }` | Notifies all room peers to wipe their local canvas |
| `draw:undo` | `Client -> Server` | `{ "boardId": "DESIGN_101" }` | Removes the last continuous stroke action |
| `board:sync` | `Server -> Room` | `{ "strokes": [...] }` | Broadcasts authoritative state snapshot after an undo |

---

## 🧠 4. Key Architectural & Design Decisions

### 1. Multi-Tenant Room Isolation (`socket.join(boardId)`)
- Every connection payload carries a target `boardId`.
- The server scopes all state mutations (`strokes` buffer, `users` registry) to `boardRooms[boardId]`.
- All broadcast emissions use `socket.to(boardId).emit(...)` or `io.to(boardId).emit(...)`, guaranteeing zero cross-board data leakage.

### 2. Intelligent Continuous Stroke Undo Algorithm
- Rather than undoing an isolated sub-pixel delta segment (which leads to unnatural chopped stroke segments), each continuous mouse-down-to-mouse-up drag gesture is assigned a unique `actionId`.
- When `draw:undo` is triggered, the server identifies the trailing `actionId` in `boardRooms[boardId].strokes` and filters out all segments belonging to that action.
- The server then broadcasts `board:sync` with the authoritative updated `strokes` array, prompting all connected peers to re-render in unison.

### 3. Disconnect Handling & Stroke Persistence
- When a client disconnects (`socket.on('disconnect')`), the user is removed from `boardRooms[boardId].users` and `user:left` is broadcast to peers.
- **Cache Persistence Strategy:** If all users disconnect from a room, the `strokes` history buffer is **deliberately preserved in server memory**. This ensures that late joiners or users reloading their browser can immediately resume collaborative sessions without data loss.

### 4. High-Frequency Cursor Throttling
- Mouse move events can fire hundreds of times per second. To prevent network saturation, the client throttles `cursor:move` emissions to ~25ms (~40 FPS) using `performance.now()`.
- The server cursor handler (`sockets/cursorHandler.js`) mutates cursor coordinates in-place without object re-allocation, minimizing garbage collection overhead.

### 5. HiDPI & Responsive Canvas Scaling
- Uses `window.devicePixelRatio` to scale internal canvas dimensions while maintaining CSS layout coordinates, ensuring razor-sharp lines on Retina and 4K displays.

---

## 📁 5. Directory Structure

```text
Aryaa_Bhadane/
├── public/
│   ├── index.html           # Full HTML5 Canvas collaborative interface & modals
│   ├── canvas.js            # Client-side drawing engine, HiDPI scaling & socket sync
│   └── styles.css           # Modern toolbar, color palette, cursor badges & layout
├── sockets/
│   ├── boardHandler.js      # Room join, stroke caching, undo rollback & canvas reset
│   └── cursorHandler.js     # Low-latency cursor coordinate streaming
├── server.js                # Express & Socket.io server bootstrap
├── package.json             # Dependencies and npm scripts
├── .gitignore               # Ignored files (node_modules, .env)
└── README.md                # Project documentation & protocol specifications
```

---

## 🧪 6. Testing & Validation

1. **Start the server:**
   ```bash
   npm run dev
   ```
2. **Open two browser windows side-by-side:**
   - Window 1: `http://localhost:5000?board=demo`
   - Window 2: `http://localhost:5000?board=demo`
3. **Verify real-time drawing:**
   - Draw in Window 1 $\rightarrow$ verify Window 2 renders the exact stroke simultaneously.
4. **Verify live collaborator cursors:**
   - Move mouse across Window 1 $\rightarrow$ verify a colored cursor tag moves smoothly in Window 2.
5. **Verify late joiner synchronization:**
   - Open a third browser window in an Incognito tab on `http://localhost:5000?board=demo`.
   - Verify all prior strokes immediately load from `board:init`.
6. **Verify undo & clear:**
   - Press **Undo** or `Ctrl+Z` in Window 1 $\rightarrow$ verify the last drawn stroke disappears across all open windows.
   - Click **Clear Canvas** $\rightarrow$ verify all windows wipe their canvas synchronously.

---

## 🚀 7. Deployment Instructions (Render)

### Step 1: Push Repository to GitHub
Ensure the project is pushed to your GitHub repository (`itm-assignment-11-whiteboard-socket`).

### Step 2: Create Web Service on Render
1. Log in to [Render](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the build and start settings:
   - **Root Directory:** `Aryaa_Bhadane`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Click **Create Web Service**.

> **Note on WebSockets & Cold Starts:**
> - Render automatically supports WebSockets over HTTPS/WSS.
> - On the Free tier, Render instances spin down after inactivity. The first request after idling may experience a brief cold-start spin-up delay.
