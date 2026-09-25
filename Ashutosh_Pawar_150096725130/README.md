# Real-Time Collaborative Whiteboard

Assignment 11 - Ashutosh Pawar (150096725130)

A multi-user whiteboard built on Node.js, Express and Socket.io. Everyone who
opens the same board URL draws on one shared HTML5 canvas in real time. The
server keeps a stroke history per room in memory, so anyone who joins late
immediately gets the full drawing. Live collaborator cursors, a shared
clear, and an undo that removes the last continuous stroke round it out. The
plain HTML frontend in `public/` is served by the same server.

## Live demo

https://assignment-11-collaborative-whiteboard-r3bd.onrender.com

Open it in two browser tabs (or on two devices) to draw together. The app runs
as one Render web service on the free tier (which supports WebSockets): the
first visit after a period of inactivity can take up to a minute, and board
history lives in memory, so it is cleared whenever the server restarts.
Deployed with root directory `Ashutosh_Pawar_150096725130`, build
`npm install`, start `npm start`; Render provides `PORT`.

## Tech stack

- Node.js, Express 5
- Socket.io (WebSocket transport)
- HTML5 Canvas API + fetch + SweetAlert2 for the frontend
- dotenv, cors

## Project structure

```text
Ashutosh_Pawar_150096725130/
├── public/
│   ├── index.html          # canvas, toolbar and collaborator list
│   ├── canvas.js           # client drawing, socket events, remote cursors
│   └── styles.css          # toolbar, canvas and layout
├── sockets/
│   ├── boardHandler.js     # room join, stroke history, clear and undo
│   └── cursorHandler.js    # live cursor coordinate streaming
├── server.js               # Express + Socket.io bootstrap
├── jsconfig.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

- App: `http://localhost:5000/index.html`
- Join a specific board with `?board=<id>`, for example
  `http://localhost:5000?board=demo`.

On macOS, port 5000 is used by AirPlay Receiver / Control Center. If the
server will not start, set another port in `.env` (`PORT=3000`) or turn
AirPlay Receiver off in System Settings.

## How to use

1. Open `http://localhost:5000?board=demo` and enter a display name.
2. Open the same URL in a second window (or an incognito tab).
3. Draw in one window. The stroke appears in the other instantly.
4. Move the mouse over the canvas. A colored, labelled cursor tracks it in
   the other window.
5. A window opened later loads every prior stroke straight away.
6. **UNDO** removes the last continuous stroke for everyone. **CLEAR CANVAS**
   wipes the board for the whole room.

## Server-side board state

State lives in memory, keyed by `boardId`. It is created on the first join
and dropped when the last user of a board disconnects.

```javascript
boardRooms = {
  "demo": {
    boardId: "demo",
    strokes: [ /* { prevX, prevY, currX, currY, color, size, strokeId, userId } */ ],
    users: { "<socketId>": { username, color, cursor: { x, y } } }
  }
};
```

## Socket event protocol

### Room and session

| Event | Direction | Payload | Description |
| --- | --- | --- | --- |
| `board:join` | Client to Server | `{ boardId, username, userColor }` | Join a board room |
| `board:init` | Server to Client | `{ strokes, activeUsers }` | Full history sent to the new peer |
| `user:joined` | Server to Room | `{ userId, username, color }` | A peer joined |
| `user:left` | Server to Room | `{ userId, username }` | A peer disconnected |

### Drawing and pointer

| Event | Direction | Payload | Description |
| --- | --- | --- | --- |
| `draw:stroke` | Client to Server | `{ boardId, stroke }` | One line segment, appended to history |
| `draw:broadcast` | Server to Room | `{ stroke }` | Segment relayed to the other peers |
| `cursor:move` | Client to Server | `{ boardId, x, y }` | High-frequency pointer position |
| `cursor:update` | Server to Room | `{ userId, x, y }` | Peer cursor position relayed |
| `board:clear` | Client to Server | `{ boardId }` | Wipe all strokes in the room |
| `board:cleared` | Server to Room | `{ clearedBy }` | Tell peers to clear their canvas |
| `draw:undo` | Client to Server | `{ boardId }` | Remove the last continuous stroke |
| `board:sync` | Server to Room | `{ strokes }` | New snapshot after an undo |

## How it works

- **Coordinate space.** The canvas has a fixed internal resolution of
  1280x720 and is scaled to fit with CSS. Pointer coordinates are mapped into
  that space before sending, so a stroke lands on the same spot on every
  screen regardless of window size.
- **Stroke history.** Each `draw:stroke` is pushed to the room's `strokes`
  array and relayed with `socket.to(boardId)` so it reaches everyone except
  the sender (who already drew it locally). A late joiner replays the whole
  array from `board:init`.
- **Continuous strokes and undo.** A drawing gesture (pointer down to up) gets
  one `strokeId`, shared by all its segments. `draw:undo` reads the last
  segment's `strokeId` and drops every segment in that group, then broadcasts
  the new snapshot with `board:sync`. So undo removes a whole line, not a
  single segment.
- **Clear.** `board:clear` empties the array and tells the room to wipe their
  canvas with `board:cleared`, tagged with who did it.
- **Cursors.** `cursor:move` is throttled on the client (about every 30 ms)
  and relayed as `cursor:update`. Each peer's cursor is an absolutely
  positioned dot and name label over the canvas, placed by percentage so it
  stays aligned when the canvas is scaled.
- **Presence.** `board:join` records the user under their socket id and tells
  the room. `disconnect` removes them, broadcasts `user:left`, and deletes the
  room once it is empty.

## Testing

1. `npm run dev`.
2. Open `http://localhost:5000?board=demo` in two windows side by side.
3. Draw in one and confirm the other renders the same stroke live.
4. Move the mouse and confirm the collaborator cursor follows in the other
   window.
5. Open a third window on the same board and confirm it loads the existing
   drawing at once.
6. Click **CLEAR CANVAS** and confirm every window clears.
