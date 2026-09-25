# 🎨 Real-Time Collaborative Whiteboard & Canvas

A multi-user collaborative whiteboard built with **Node.js**, **Express.js**, and **Socket.io**, using the **HTML5 Canvas API** for drawing.

## Features

- Multi-room whiteboards via `boardId` (`socket.join(boardId)`)
- In-memory stroke history buffer per room — new joiners instantly see the existing drawing
- Real-time stroke streaming between peers with minimal latency
- Live collaborator cursor tracking (colored, labeled cursors)
- `Clear Canvas` — wipes the board for every connected peer
- `Undo` — removes the last continuous stroke drawn by any user, synced to the room

## Tech Stack

Node.js, Express.js, Socket.io, HTML5 Canvas API, CORS, dotenv

## Setup

```bash
npm install
npm start        # production
npm run dev       # nodemon, auto-restart
```

Server runs at `http://localhost:5000` by default (configurable via `PORT` in `.env`, see `.env.example`).

## Testing With Multiple Users

1. Start the server: `npm start`
2. Open two browser windows at `http://localhost:5000?board=demo` (the `board` query param pre-fills the Board ID field)
3. Enter a name in each window and click **Join Board**
4. Draw in Window 1 → the stroke appears instantly in Window 2
5. Move your mouse in Window 1 → a colored, labeled cursor moves in Window 2
6. Open a third window/incognito tab with the same board URL → it loads the full existing drawing via `board:init`
7. Click **Undo** → removes the last stroke for everyone; click **Clear** → wipes the board for everyone

## Directory Structure

```
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html        # Canvas collaborative interface
│   ├── canvas.js         # Client-side drawing & socket event emitter
│   └── styles.css        # Toolbar, color picker & canvas layout
├── sockets/
│   ├── store.js          # In-memory board/stroke/user state
│   ├── boardHandler.js   # Room join, stroke caching, clear & undo
│   └── cursorHandler.js  # Live cursor coordinate streaming
├── server.js              # Express & Socket.io server bootstrap
├── package.json
└── .env.example
```

## Socket Event Protocol

### Room & Session

| Event | Direction | Payload |
|---|---|---|
| `board:join` | Client → Server | `{ boardId, username, userColor }` |
| `board:init` | Server → Client | `{ strokes: [...], activeUsers: [...] }` |
| `user:joined` | Server → Room | `{ userId, username, color }` |
| `user:left` | Server → Room | `{ userId, username }` |

### Drawing & Pointer

| Event | Direction | Payload |
|---|---|---|
| `draw:stroke` | Client → Server | `{ boardId, stroke: { strokeId, prevX, prevY, currX, currY, color, size } }` |
| `draw:broadcast` | Server → Room | `{ stroke }` |
| `cursor:move` | Client → Server | `{ boardId, x, y }` |
| `cursor:update` | Server → Room | `{ userId, x, y }` |
| `board:clear` | Client → Server | `{ boardId }` |
| `board:cleared` | Server → Room | `{ clearedBy }` |
| `draw:undo` | Client → Server | `{ boardId }` |
| `board:sync` | Server → Room | `{ strokes: [...] }` |

Each stroke carries a `strokeId` (generated client-side per pointer-down) so the server can group segments into one continuous action and remove exactly the most recent one on `draw:undo`.
