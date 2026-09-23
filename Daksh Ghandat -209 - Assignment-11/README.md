# Assignment 11 — Real-Time Collaborative Whiteboard & Canvas (Socket.io)

A real-time collaborative multi-user whiteboard built with **Node.js, Express,
Socket.io and the HTML5 Canvas API**. Stroke segments stream over WebSockets,
group into seamless draw actions, are cached in a per-room in-memory history
buffer, and are persisted to **MongoDB** so the canvas survives restarts.

> See `ASSIGNMENT-SPEC.md` for the full assignment brief, event protocol and
> grading rubric.

---

## ✨ Features

| Area | Implementation |
| --- | --- |
| Multi-room whiteboards | `socket.join(boardId)` isolates rooms; share `?board=<id>` URLs |
| Live stroke streaming | `draw:stroke` → `draw:broadcast` relays segments with near-zero latency |
| History buffer sync | New joiners receive the full canvas via `board:init` (memory + MongoDB) |
| Collaborator cursors | `cursor:move` → `cursor:update` streams at ~60fps with color-coded cursors |
| Undo | `draw:undo` pops the last continuous stroke action; `board:sync` rebroadcasts state |
| Clear | `board:clear` → `board:cleared` wipes every peer's canvas instantly |
| Persistence | Strokes per board stored in MongoDB (`whiteboard_socket` database) |

## 🧱 Tech Stack

- **Node.js** + **Express** — HTTP server & static files
- **Socket.io** — full-duplex real-time events
- **HTML5 Canvas API** — high-DPI drawing surface
- **Mongoose (MongoDB)** — durable board/stroke storage
- **CORS** — cross-origin policy
- **dotenv** + **nodemon** — config & dev workflow

## 📁 Directory Structure

```
Daksh Ghandat -209 - Assignment-11/
├── public/
│   ├── index.html           # HTML5 Canvas collaborative interface
│   ├── canvas.js            # Client-side drawing & socket emitter
│   └── styles.css           # Toolbars, color pickers & canvas layout
├── sockets/
│   ├── store.js             # In-memory board rooms + MongoDB persistence
│   ├── boardHandler.js      # Room join, stroke caching & reset handlers
│   └── cursorHandler.js     # Live cursor coordinate streaming
├── config/
│   └── db.js                # MongoDB connection (with local fallback)
├── models/
│   └── Board.js             # Mongoose schema for persistent boards
├── data/
│   └── sample-board.json    # Sample persisted board (ready to import)
├── server.js                # Express + Socket.io server bootstrap
├── .env.example             # Environment template (copy to .env)
├── .gitignore
├── ASSIGNMENT-SPEC.md       # Original assignment brief
└── README.md
```

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in a MongoDB URI (create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)):

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/whiteboard_socket?retryWrites=true&w=majority
```

> **No MongoDB handy?** The server automatically falls back to a local MongoDB
> at `mongodb://127.0.0.1:27017/whiteboard_socket`, and if none is reachable it
> runs **in-memory only** — real-time collaboration always works.

### 3. Run the server

```bash
npm run dev      # nodemon (development)
npm start        # node (production)
```

Server starts at **http://localhost:5000**.

> **macOS users:** "AirPlay Receiver"/ControlCenter sometimes occupies port
> 5000. If you get `EADDRINUSE`, change `PORT` in `.env` (e.g. `5050`) and open
> `http://localhost:5050?board=demo`.

## 🗂 Import the sample board (optional)

Pre-populate the `demo` board so it's testable immediately:

```bash
mongosh "mongodb://localhost:27017/whiteboard_socket" \
  --eval 'db.boards.insertOne(JSON.parse(require("fs").readFileSync("data/sample-board.json","utf8")))'
```

Opening `?board=demo` will then show Alice's and Bob's sample strokes.

## 🧪 Testing & Validation

1. Open two windows side-by-side on `http://localhost:5000?board=demo`.
2. **Draw** in Window 1 → Window 2 renders the exact stroke in real time.
3. **Move the mouse** in Window 1 → a color-coded collaborator cursor moves in Window 2.
4. Open a **third incognito window** on the same URL → it loads all prior
   strokes via `board:init`.
5. **Undo** in Window 1 → the last continuous stroke disappears everywhere.
6. **Clear Canvas** in Window 1 → all windows wipe instantly.

## 📡 Event Protocol

| Event | Direction | Payload |
| --- | --- | --- |
| `board:join` | Client → Server | `{ boardId, username, userColor }` |
| `board:init` | Server → Client | `{ strokes, activeUsers }` |
| `user:joined` | Server → Room | `{ userId, username, color }` |
| `user:left` | Server → Room | `{ userId, username }` |
| `draw:stroke` | Client → Server | `{ boardId, stroke: { prevX, prevY, currX, currY, color, size } }` |
| `draw:broadcast` | Server → Room | `{ stroke }` |
| `cursor:move` | Client → Server | `{ boardId, x, y }` |
| `cursor:update` | Server → Room | `{ userId, x, y }` |
| `board:clear` | Client → Server | `{ boardId }` |
| `board:cleared` | Server → Room | `{ clearedBy }` |
| `draw:undo` | Client → Server | `{ boardId }` |
| `board:sync` | Server → Room | `{ strokes }` |

## 🖥 Keyboard Shortcut

`Ctrl/Cmd + Z` → undo the last stroke.