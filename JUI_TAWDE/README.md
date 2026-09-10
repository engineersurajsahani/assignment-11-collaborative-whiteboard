# 🎨 Assignment 11 — Real-Time Collaborative Whiteboard & Canvas

A real-time multi-user whiteboard built with **Node.js, Express.js, Socket.io and HTML5 Canvas**. Multiple users can join the same board room, draw together, see collaborator cursors, undo the latest drawing action, and clear the shared canvas.

## ✨ Features
- Real-time collaborative drawing with Socket.io
- Multi-room support using `boardId`
- In-memory stroke history per room
- New users receive the complete board state on `board:init`
- Live collaborator cursor tracking
- User names and custom colors
- Shared `Undo` and `Clear Canvas`
- Responsive, polished frontend UI
- Export the current canvas as PNG
- Copyable room URL
- Health endpoint at `/api/health`

## 🛠 Tech Stack
Node.js · Express.js · Socket.io · CORS · dotenv · HTML5 Canvas · CSS · Vanilla JavaScript

## 📁 Structure
```text
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html
│   ├── canvas.js
│   └── styles.css
├── sockets/
│   ├── boardHandler.js
│   └── cursorHandler.js
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 🚀 Run locally
```bash
npm install
npm start
```
Open **http://localhost:5000?board=demo**.

For development:
```bash
npm run dev
```

## 🧪 Test collaboration
1. Open `http://localhost:5000?board=demo` in two browser windows.
2. Draw in the first window.
3. The stroke appears in the second window in real time.
4. Move the mouse to see the collaborator cursor.
5. Open the same URL in an incognito window; existing strokes load immediately.
6. Test Undo and Clear Canvas.
7. Change the URL to `?board=another-room` to test room isolation.

## 🔌 Event Protocol
### Room & session
- `board:join` → client to server
- `board:init` → server to new client
- `user:joined` → server to room
- `user:left` → server to room

### Drawing & pointer
- `draw:stroke` → client to server
- `draw:broadcast` → server to other room members
- `cursor:move` → client to server
- `cursor:update` → server to other room members
- `board:clear` → client to server
- `board:cleared` → server to room
- `draw:undo` → client to server
- `board:sync` → server to room

## ⚠️ Notes
Board data is stored **in server memory**, as required by the assignment. Restarting the server clears all boards. This project is intended as an educational real-time WebSocket application rather than a production persistence layer.
