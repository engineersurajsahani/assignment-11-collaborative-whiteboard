# Assignment 11: Real-Time Collaborative Whiteboard & Canvas

A lightweight, high-performance real-time collaborative whiteboard web application built using **Node.js**, **Express.js**, **Socket.io**, and the **HTML5 Canvas API**.

Multiple users can join the same board room, sketch simultaneously with synchronized strokes, view each other's live cursor positions in real-time, undo actions, change colors/brush sizes, and clear the shared canvas.



Render Link  -    https://assignment-11-collaborative-whiteboard-61gq.onrender.com
---

## 🚀 Features

- **Multi-Room Collaboration**: Join distinct whiteboard rooms by specifying a Board ID.
- **Real-Time Stroke Synchronization**: Sub-millisecond stroke broadcasting across all participants in a room.
- **Live Collaborator Cursors**: See real-time mouse/pointer movement and colored nametags of other active participants.
- **State Hydration on Join (`board:init`)**: Newly connected users automatically receive the current canvas drawing state and online user roster.
- **Stroke-Level Undo (`draw:undo`)**: Continuous line undo with atomic canvas sync (`board:sync`) for all room members.
- **Global Canvas Clear (`board:clear`)**: Instant synchronized clearing with interactive toast notifications.
- **Drawing Tools & Controls**:
  - Brush tool with size adjustment slider (1px – 40px)
  - Color palette presets + custom HTML5 color picker
  - Eraser tool
- **Responsive & High-DPI Ready**: Canvas automatically scales crisply across Retina/High-DPI displays and resizes smoothly.
- **Zero Database Requirement**: Fast in-memory state management using server memory.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js | JavaScript server runtime |
| **Web Framework** | Express.js (`^4.21.2`) | Static asset serving and HTTP middleware |
| **Real-Time Engine** | Socket.io (`^4.8.1`) | Bi-directional WebSocket communication and room management |
| **Frontend UI** | HTML5 Canvas & Vanilla JS | Direct 2D context rendering with zero framework overhead |
| **Styling** | Vanilla CSS | Modern dark glassmorphism interface with smooth animations |
| **Configuration** | `dotenv` (`^16.4.7`) | Environment variable loading |
| **Dev Tooling** | `nodemon` (`^3.1.9`) | Automatic server reload during development |

---

## 📁 Project Structure

```text
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html        # Main HTML layout, canvas element, and floating toolbar
│   ├── canvas.js         # Client-side drawing engine and Socket.io event listeners
│   └── styles.css        # Dark glassmorphism styling and animations
├── sockets/
│   ├── boardHandler.js   # Socket handlers for room join, drawing strokes, undo, clear, disconnect
│   └── cursorHandler.js  # Socket handlers for real-time cursor tracking
├── .env                  # Port configuration (PORT=5000)
├── package.json          # Project metadata, scripts, and dependencies
├── server.js             # Express server setup, Socket.io initialization, and in-memory board state
└── README.md             # Project documentation
```

---

## ⚙️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16.x or higher)
- [npm](https://www.npmjs.com/) (version 8.x or higher)

### Steps

1. **Navigate to the project directory**:
   ```bash
   cd assignment-11-whiteboard-socket
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify `.env` configuration**:
   Ensure a `.env` file exists in the root directory with the desired port:
   ```env
   PORT=5000
   ```

---

## 🏃 How to Run

### Development Mode (with hot-reload via nodemon)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Once started, open your browser and navigate to:
```
http://localhost:5000
```

---

## 🧪 Testing Real-Time Collaboration (Two Browser Windows)

To test multi-user collaboration and synchronization:

1. **Open Window 1**:
   - Open `http://localhost:5000` in Google Chrome (or your default browser).
   - Enter Board ID: `demo` (or any custom room name).
   - Enter Username: `Alice`.
   - Click **Join Board**.

2. **Open Window 2**:
   - Open `http://localhost:5000` in an **Incognito Window** or a different browser (e.g., Firefox / Safari).
   - Enter the same Board ID: `demo`.
   - Enter Username: `Bob`.
   - Click **Join Board**.

3. **Verify Real-Time Synchronization**:
   - **Drawing**: Draw lines in Window 1. Observe that Window 2 renders the exact strokes instantaneously.
   - **Live Cursors**: Move your mouse across the canvas in Window 1. Observe Alice's colored cursor moving across Window 2 with her username badge.
   - **Active User Avatars**: Look at the top-right user list in the header to see all connected participants.
   - **Late Joiners / State Persistence**: Open a third window, join room `demo`, and verify that previously drawn strokes load immediately via `board:init`.
   - **Undo**: Draw multiple strokes in Window 1 and click **Undo**. The last continuous stroke will disappear across all windows simultaneously.
   - **Clear Canvas**: Click **Clear** in either window. Confirm the prompt and verify all connected windows clear together.

---

## 🔄 Socket.io Event Flow Architecture

```
 Client (Browser)                                    Server (Node.js)
        │                                                   │
        │─── emit('board:join', { boardId, username }) ────>│ (Adds user to room & in-memory state)
        │<── emit('board:init', { strokes, users }) ────────│ (Sends full canvas history to client)
        │<── broadcast('user:joined', { username, ... }) ───│ (Notifies other room participants)
        │                                                   │
        │─── emit('draw:stroke', { boardId, stroke }) ─────>│ (Saves stroke segment to memory)
        │<── broadcast('draw:broadcast', stroke) ───────────│ (Broadcasts stroke to others in room)
        │                                                   │
        │─── emit('cursor:move', { boardId, x, y }) ───────>│ (Updates cursor in memory)
        │<── broadcast('cursor:update', { userId, ... }) ───│ (Broadcasts live cursor position)
        │                                                   │
        │─── emit('draw:undo', { boardId }) ───────────────>│ (Removes last continuous stroke)
        │<── emit('board:sync', { strokes }) ───────────────│ (Broadcasts updated canvas to all)
        │                                                   │
        │─── emit('board:clear', { boardId }) ─────────────>│ (Resets strokes array)
        │<── emit('board:cleared', { clearedBy }) ──────────│ (Clears canvas for all clients)
        │                                                   │
```

### Event Reference Table

| Event Name | Direction | Payload Structure | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client ➔ Server | `{ boardId, username, userColor }` | Join or create a whiteboard room |
| `board:init` | Server ➔ Client | `{ strokes: [...], users: {...} }` | Initial state sent to a newly joined client |
| `user:joined` | Server ➔ Client (Broadcast) | `{ socketId, username, userColor, users }` | Notifies existing members of a new joiner |
| `draw:stroke` | Client ➔ Server | `{ boardId, stroke: { strokeId, prevX, prevY, currX, currY, color, size } }` | Sends drawn line segment |
| `draw:broadcast` | Server ➔ Client (Broadcast) | `{ strokeId, prevX, prevY, currX, currY, color, size }` | Renders remote stroke in real time |
| `cursor:move` | Client ➔ Server | `{ boardId, x, y }` | Sends current mouse position |
| `cursor:update` | Server ➔ Client (Broadcast) | `{ userId, username, color, x, y }` | Updates collaborator cursor badge on screen |
| `draw:undo` | Client ➔ Server | `{ boardId }` | Requests undo of last drawn stroke |
| `board:sync` | Server ➔ Client (All) | `{ strokes: [...] }` | Re-renders full canvas after undo |
| `board:clear` | Client ➔ Server | `{ boardId }` | Requests clearing the entire canvas |
| `board:cleared` | Server ➔ Client (All) | `{ clearedBy }` | Clears local canvas for all connected clients |
| `user:left` | Server ➔ Client (Broadcast) | `{ socketId, username, users }` | Removes user cursor and updates roster on disconnect |

---

## 💡 Important Note on In-Memory State

> [!NOTE]
> In accordance with the assignment specifications, board rooms, drawing strokes, and connected user lists are stored **in server memory** via the `boardRooms` JavaScript object in `server.js`.
> 
> No external databases (e.g., MongoDB, PostgreSQL, Redis) are utilized. Consequently:
> - Board data remains synchronized in real-time across active browser clients.
> - Restarting or terminating the Node.js server process will reset the in-memory board state.
