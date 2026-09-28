# Real-Time Collaborative Whiteboard & Canvas (Socket.io)

Real-time multi-user collaborative whiteboard and canvas web application built with Node.js, Express.js, Socket.io, and the HTML5 Canvas API.

## Tech Stack

- Node.js
- Express.js
- Socket.io
- HTML5 Canvas API
- cors
- dotenv
- nodemon

## Project Architecture

```
Tanmay-Sherkar-139-Assignment-11/
├── public/
│   ├── index.html
│   ├── canvas.js
│   └── styles.css
├── sockets/
│   ├── boardHandler.js
│   └── cursorHandler.js
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Setup & Running Locally

1. Install dependencies:
```bash
npm install
```

2. Configure environment in `.env`:
```env
PORT=5000
```

3. Start development server with auto-reload:
```bash
npm run dev
```

4. Start production server:
```bash
npm start
```

5. Open browser at `http://localhost:5000` or `http://localhost:5000?board=DESIGN_101`.

## Real-Time Socket Event Protocol

### Room & Session Events

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `board:join` | Client -> Server | `{"boardId":"DESIGN_101","username":"Alice","userColor":"#ff5722"}` | Joins a collaborative canvas room |
| `board:init` | Server -> Client | `{"strokes":[...],"activeUsers":[...]}` | Emits complete stroke history to newly joined peer |
| `user:joined` | Server -> Room | `{"userId":"socket_id","username":"Alice","color":"#ff5722"}` | Notifies other participants in the board room |
| `user:left` | Server -> Room | `{"userId":"socket_id","username":"Alice"}` | Broadcasted when a peer disconnects |

### Drawing & Pointer Events

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `draw:stroke` | Client -> Server | `{"boardId":"...","stroke":{"prevX":120,"prevY":80,"currX":125,"currY":85,"color":"#000","size":3,"tool":"brush","strokeId":"..."}}` | Client draws stroke segment; server appends to room history |
| `draw:broadcast` | Server -> Room | `{"stroke":{...}}` | Relays drawing stroke to all other participants in the room |
| `cursor:move` | Client -> Server | `{"boardId":"...","x":140,"y":95}` | Mouse pointer sync |
| `cursor:update` | Server -> Room | `{"userId":"socket_id","x":140,"y":95}` | Relays peer cursor positions on screen |
| `board:clear` | Client -> Server | `{"boardId":"DESIGN_101"}` | Clears all strokes for this room |
| `board:cleared` | Server -> Room | `{"clearedBy":"Alice"}` | Notifies all room peers to wipe local canvas |
| `draw:undo` | Client -> Server | `{"boardId":"DESIGN_101"}` | Removes the last continuous stroke action |
| `board:sync` | Server -> Room | `{"strokes":[...]}` | Broadcasts new state snapshot after undo |

## Features & Implementation

- **Multi-Tenant Room Partitioning**: Canvas sessions are partitioned via `socket.join(boardId)` with room-specific state.
- **In-Memory Stroke Buffer**: Server caches full stroke history per room so newly joined peers instantly receive prior drawings via `board:init`.
- **Live Peer Cursors**: Live collaborator cursors stream coordinates using `cursor:move` and display custom user colors and names.
- **Continuous Stroke Undo**: Grouped stroke IDs allow undoing entire drawn brush lines in one click instead of individual segments.
- **Responsive High-DPI Canvas**: Canvas coordinates scale with `devicePixelRatio` to prevent blur on Retina displays.
- **Tools**: Freehand brush, eraser with destination-out blending, straight line guide, custom colors, size slider, PNG export.

## Testing & Validation

1. Start server at `http://localhost:5000`.
2. Open two browser windows side-by-side at `http://localhost:5000?board=demo`.
3. Draw in Window 1: verify that Window 2 renders strokes in real time.
4. Move mouse in Window 1: verify collaborator cursor moves smoothly with matching name tag in Window 2.
5. Open a third browser window in an incognito tab with the same board URL: verify it immediately loads all prior strokes via `board:init`.
6. Click **Clear Canvas** in Window 1: verify all windows clear instantly via `board:cleared`.
7. Click **Undo** in Window 1: verify the last drawn stroke reverts across all connected peers via `board:sync`.
