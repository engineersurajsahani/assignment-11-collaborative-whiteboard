# 🎨 Assignment 11: Real-Time Collaborative Whiteboard & Canvas (Socket.io)

**Name:** Rishi Thakker
**Roll No:** 150096725068
**Cohort:** Sam Altman

**Deployed Link:** https://assignment-11-collaborative-whiteboard-d9mr.onrender.com/ 

A multi-user collaborative whiteboard built with **Node.js, Express, and Socket.io**. Peers join a `boardId` room, draw together in real time, see each other's live cursors, and can undo or clear the shared canvas.

## Features
- Room-based boards via `?board=<id>` in the URL (defaults to `demo`)
- New joiners instantly receive the full stroke history through `board:init`
- Live collaborator cursors, each labeled with the peer's name and color
- `Undo` removes the last continuous pen stroke (all segments sharing one mouse-down-to-mouse-up pass), not just the last pixel segment
- `Clear` wipes the board for every connected peer at once
- Touch support (mobile/tablet) in addition to mouse

## Testing (from assignment spec)
1. Start the server at `http://localhost:5000`.
2. Open two browser windows side-by-side at `http://localhost:5000?board=demo`.
3. Draw in Window 1 → confirm Window 2 renders the same stroke live.
4. Move the mouse in Window 1 → confirm a colored, labeled cursor moves in Window 2.
5. Open a third window/incognito tab on the same board URL → confirm it loads all prior strokes immediately via `board:init`.
6. Click **Clear** in Window 1 → confirm Windows 2 and 3 clear instantly.
7. Draw a stroke, click **Undo** → confirm only that last stroke disappears (not the whole board) across all windows.

## Real-Time Event Protocol
Matches the assignment spec exactly, with one addition: every `stroke` object also carries a
`strokeGroupId` (set client-side per mouse-down-to-mouse-up pass) so `draw:undo` can remove a
whole pen stroke instead of a single line segment.

| Event | Direction | Payload |
|---|---|---|
| `board:join` | Client → Server | `{ boardId, username, userColor }` |
| `board:init` | Server → Client | `{ strokes, activeUsers }` |
| `user:joined` | Server → Room | `{ userId, username, color }` |
| `user:left` | Server → Room | `{ userId, username }` |
| `draw:stroke` | Client → Server | `{ boardId, stroke }` |
| `draw:broadcast` | Server → Room | `{ stroke }` |
| `cursor:move` | Client → Server | `{ boardId, x, y }` |
| `cursor:update` | Server → Room | `{ userId, x, y }` |
| `board:clear` | Client → Server | `{ boardId }` |
| `board:cleared` | Server → Room | `{ clearedBy }` |
| `draw:undo` | Client → Server | `{ boardId }` |
| `board:sync` | Server → Room | `{ strokes }` |

## Folder Structure
```text
rishi-thakker-068-assignment-11/
├── public/
│   ├── index.html
│   ├── canvas.js
│   └── styles.css
├── sockets/
│   ├── boardHandler.js
│   └── cursorHandler.js
├── package.json
├── server.js
└── README.md
```
