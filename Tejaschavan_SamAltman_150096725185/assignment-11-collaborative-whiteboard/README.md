# Real-Time Collaborative Whiteboard (DrawSync)

A full-stack, real-time collaborative whiteboard web application built using **Node.js**, **Express.js**, **Socket.io**, and the **HTML5 Canvas API** (Vanilla JavaScript, zero frontend frameworks).

Multiple users can join the same whiteboard room via URL parameters or the join dialog, draw simultaneously with zero perceived latency, see live collaborator cursor movements with labeled badges, undo multi-segment strokes atomically, and clear the canvas across all connected clients.

---

## 🚀 Quick Start

### 1. Installation & Setup
```bash
# Clone or navigate to the repository
cd assignment-11-whiteboard-socket

# Install dependencies
npm install

# Start the server (production mode)
npm start

# Or start in development mode with auto-reload (nodemon)
npm run dev
```

### 2. Open Whiteboard in Browser
Open your browser and navigate to:
```
http://localhost:5000?board=demo
```

To test real-time collaboration, open the same URL `http://localhost:5000?board=demo` in a second browser window, incognito tab, or another device on the same local network.

---

## 📁 Project Structure

```
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html       # Whiteboard interface, toolbar, cursor overlay & join modal
│   ├── canvas.js        # Canvas drawing logic, local rendering & Socket.io client
│   └── styles.css       # Clean, modern UI styling, cursor badges & animations
├── sockets/
│   ├── boardStore.js    # In-memory singleton whiteboard room store
│   ├── boardHandler.js  # Room joins, drawing broadcasts, undo, clear & disconnects
│   └── cursorHandler.js # Throttled live cursor tracking handler
├── server.js            # Express app, HTTP server & Socket.io connection setup
├── package.json         # Project metadata, scripts, and dependencies
├── .env.example         # Environment variables template
├── .env                 # Local environment configuration
├── .gitignore           # Git ignore rules
└── README.md            # Comprehensive documentation & testing guide
```

---

## ⚡ Real-Time Event Protocol

The client and server communicate using the following real-time Socket.io event protocol:

| Event Name | Direction | Payload Structure | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client ➔ Server | `{ boardId, username, userColor }` | Client joins a whiteboard room. Server stores user state and joins socket room. |
| `board:init` | Server ➔ Joining Client Only | `{ strokes, activeUsers }` | Sent directly to the joiner immediately with existing strokes history and active users. |
| `user:joined` | Server ➔ Rest of Room | `{ userId, username, color }` | Broadcast to peers when a new collaborator joins. |
| `user:left` | Server ➔ Rest of Room | `{ userId, username }` | Broadcast on socket `disconnect`. Server removes user from room users map. |
| `draw:stroke` | Client ➔ Server | `{ boardId, stroke: { prevX, prevY, currX, currY, color, size, strokeGroupId } }` | Client sends a stroke segment during mouse/touch drag. |
| `draw:broadcast` | Server ➔ Rest of Room | `{ stroke }` | Server adds timestamp/metadata and broadcasts to peers (sender already drew locally). |
| `cursor:move` | Client ➔ Server | `{ boardId, x, y }` | High-frequency mouse movement payload emitted by client. |
| `cursor:update` | Server ➔ Rest of Room | `{ userId, x, y }` | Server throttles incoming cursor updates and broadcasts to peers. |
| `board:clear` | Client ➔ Server | `{ boardId }` | Client requests clearing the canvas for the entire room. |
| `board:cleared` | Server ➔ Entire Room | `{ clearedBy: username }` | Broadcast to all clients (including sender) to clear canvas surface. |
| `draw:undo` | Client ➔ Server | `{ boardId }` | Client triggers an undo action. |
| `board:sync` | Server ➔ Entire Room | `{ strokes }` | Authoritative stroke array broadcast after undo for atomic full redraw. |

---

## 🎨 Undo Algorithm & `strokeGroupId`

### The Problem: Segment vs. Stroke Action
When a user draws a line, their continuous mouse drag (`mousedown` ➔ `mousemove` ➔ `mouseup`) emits dozens to hundreds of tiny line segments (`prevX, prevY` ➔ `currX, currY`). 

If undo only popped the single last segment from the array, undoing would erase just a fractional millimeter of a line, leaving a broken, half-erased stroke.

### The Solution
1. **Client-Side Grouping**:
   - On `mousedown` (or `touchstart`), the client generates a unique UUID `strokeGroupId` using `crypto.randomUUID()`.
   - Every `draw:stroke` segment emitted during that continuous drag carries that identical `strokeGroupId`.
   - On `mouseup`, the drag finishes. The next `mousedown` generates a new `strokeGroupId`.

2. **Server-Side Filtering**:
   - The server appends each stroke with its `strokeGroupId` into `boardRooms[boardId].strokes`.
   - When any user emits `draw:undo`, the server inspects the **last stroke** in the array:
     ```js
     const lastStroke = room.strokes[room.strokes.length - 1];
     const targetGroupId = lastStroke.strokeGroupId;
     ```
   - The server filters out **all** segments that match that `strokeGroupId`:
     ```js
     room.strokes = room.strokes.filter((s) => s.strokeGroupId !== targetGroupId);
     ```
   - The server broadcasts `board:sync` with the updated authoritative stroke history to all clients in the room, causing an instant, clean full-stroke removal on every screen.

---

## 🖱️ Cursor Throttling

Mouse movement events fire at high rates (~60–120+ events per second per client). Broadcasting every raw event to all room participants creates unnecessary network congestion ($O(N)$ messages per move across $N$ users).

To solve this, dual-layer throttling is implemented:
1. **Client-Side Throttling (`30ms` / ~33 fps)**: Prevents flooding the local socket buffer before packets leave the browser.
2. **Server-Side Throttling (`40ms` / ~25 fps)**:
   - Configured via `CURSOR_THROTTLE_MS = 40` in `sockets/cursorHandler.js`.
   - Tracks `socket.data.lastCursorEmit` timestamp per socket.
   - Drops redundant intermediate events if less than 40ms has elapsed since the previous broadcast.
   - Smooth CSS transitions (`transition: transform 0.04s linear`) on `.peer-cursor` ensure fluid visual pointer movement without jitter.

---

## 🧠 Server State & Architectural Assumptions

### Server State Model (`sockets/boardStore.js`)
```js
const boardRooms = {
  // "demo": {
  //   boardId: "demo",
  //   strokes: [
  //     { prevX, prevY, currX, currY, color, size, strokeGroupId, timestamp }
  //   ],
  //   users: {
  //     "socket-id-abc": {
  //       username: "Alice",
  //       color: "#3B82F6",
  //       cursor: { x: 140, y: 220 }
  //     }
  //   }
  // }
};
```

### Key Architectural Decisions:
1. **`board:init` Active Users**: Returns all currently active participants in the room, allowing the joining client to immediately display the collaborator count and peer cursor placeholders.
2. **Empty Room Persistence**: When the last user in a room disconnects, `boardRooms[boardId].users` becomes empty, but `boardRooms[boardId].strokes` **is preserved in memory**. When new or reconnecting users join later, they retain access to all previously drawn artwork.
3. **Optimistic Local Drawing**: Local strokes are rendered immediately to the canvas before socket confirmation, guaranteeing instantaneous response time and zero drawing lag regardless of network latency.

---

## 🧪 Testing Walkthrough

Follow these steps to test all functionality:

1. **Start the Server**:
   ```bash
   npm start
   ```
   Open two browser windows side by side to `http://localhost:5000?board=demo`. Set display names (e.g. "Alice" in Window 1, "Bob" in Window 2).

2. **Real-Time Drawing**:
   - Draw freehand shapes in Window 1.
   - Verify Window 2 renders the strokes in real time without lag.

3. **Live Cursor Tracking**:
   - Move the mouse across the canvas in Window 1.
   - Verify a colored pointer badge labeled "Alice" moves smoothly in Window 2.

4. **Catch-Up Initialization (`board:init`)**:
   - Open a third Incognito window or new tab to `http://localhost:5000?board=demo` as "Charlie".
   - Verify that all strokes previously drawn by Alice and Bob appear immediately.

5. **Clear Canvas Broadcast**:
   - Click the **Clear** button in Window 1 and confirm.
   - Verify that the canvas in Windows 1, 2, and 3 instantly clears and a toast notification announces that Alice cleared the board.

6. **Atomic Multi-Segment Undo**:
   - In Window 1, draw a continuous squiggle line, then release the mouse.
   - In Window 2, draw a separate line, then release the mouse.
   - In Window 1, click **Undo** (or press `Ctrl+Z` / `Cmd+Z`).
   - Verify that Bob's entire squiggle stroke disappears atomically across all windows (not just a single line segment).
