# 🎨 Real-Time Collaborative Whiteboard & Canvas

A multi-user collaborative drawing app — synchronized strokes, live collaborator cursors, room-based boards, clear/undo — built with **Node.js, Express, Socket.io, and the HTML5 Canvas API**.

## Tech Stack

- Node.js + Express (serves the static frontend)
- Socket.io (WebSocket transport for all real-time events)
- HTML5 Canvas API (client-side drawing)
- No database — board state lives in server memory for the lifetime of the process

## Setup

```bash
npm install
cp .env.example .env   # optionally change PORT
npm run dev            # nodemon, auto-restart
# or
npm start
```

Then open **`http://localhost:5000`** in a browser. Enter a name and a Board ID (any string, e.g. `demo`), click **Join Board**.

To test collaboration, open a second browser window (or an incognito tab) at `http://localhost:5000?board=demo` — the `?board=` query param pre-fills the Board ID field — and join with a different name. Draw in one window and watch it appear instantly in the other.

## Real-Time Event Protocol

**Room & session events**

| Event | Direction | Payload |
|---|---|---|
| `board:join` | Client → Server | `{ boardId, username, userColor }` |
| `board:init` | Server → Client | `{ strokes, activeUsers }` — full history sent only to the joining peer |
| `user:joined` | Server → Room | `{ userId, username, color }` |
| `user:left` | Server → Room | `{ userId, username }` |

**Drawing & pointer events**

| Event | Direction | Payload |
|---|---|---|
| `draw:stroke` | Client → Server | `{ boardId, stroke: { prevX, prevY, currX, currY, color, size, strokeGroupId } }` |
| `draw:broadcast` | Server → Room (excluding sender) | `{ stroke }` |
| `cursor:move` | Client → Server | `{ boardId, x, y }` |
| `cursor:update` | Server → Room (excluding sender) | `{ userId, x, y }` |
| `board:clear` | Client → Server | `{ boardId }` |
| `board:cleared` | Server → Room (including sender) | `{ clearedBy }` |
| `draw:undo` | Client → Server | `{ boardId }` |
| `board:sync` | Server → Room (including sender) | `{ strokes }` — full corrected state after undo |

## Key Design Notes

- **In-memory board store** (`sockets/boardStore.js`): `{ boardId: { strokes: [], users: {} } }`. No persistence — restarting the server clears all boards, matching the assignment's in-memory requirement.
- **Stroke grouping for undo**: each individual `draw:stroke` event carries a `strokeGroupId` generated once per continuous pen-down-to-pen-up gesture on the client. `draw:undo` removes every segment sharing that requesting user's most recent `strokeGroupId` — so a whole handwritten letter or curve disappears in one undo, not just the last tiny line segment. Undo only ever removes the *requesting user's own* last stroke, so it can't erase a collaborator's drawing.
- **Late joiners sync instantly**: `board:init` is emitted only to the socket that just joined (`socket.emit`, not `io.to`), carrying the full `strokes` buffer built up so far — this is what makes a third browser window immediately see prior drawing.
- **Cursor events are fire-and-forget**: unlike strokes, cursor positions are not stored in history — only the live broadcast matters, keeping the high-frequency `cursor:move` stream cheap.

## Testing Checklist (from the assignment spec)

Verified via an automated Socket.io integration test during development (two+ simulated clients in the same room):

1. ✅ Client B receives `board:init` with the correct existing state on join
2. ✅ Client A is notified via `user:joined` when Client B joins
3. ✅ A stroke drawn by Client A reaches Client B via `draw:broadcast` in real time
4. ✅ Cursor movement from Client A reaches Client B via `cursor:update`
5. ✅ A third client joining afterward immediately receives the full prior stroke history via `board:init`
6. ✅ `board:clear` from Client A reaches Client B via `board:cleared`
7. ✅ `draw:undo` removes only the most recent stroke group, leaving earlier strokes intact, and broadcasts the corrected state via `board:sync`

To verify visually yourself: open two browser windows side by side at `http://localhost:5000?board=demo`, draw in one, and watch the other update instantly — plus a live colored cursor label following your mouse.

## Project Structure

```
whiteboard-socket/
├── public/
│   ├── index.html
│   ├── canvas.js
│   └── styles.css
├── sockets/
│   ├── boardStore.js      # in-memory room/state store (shared)
│   ├── boardHandler.js    # join, stroke caching, clear, undo
│   └── cursorHandler.js   # live cursor coordinate streaming
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```
