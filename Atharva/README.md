# 🎨 Real-Time Collaborative Whiteboard

A real-time multi-user collaborative whiteboard built using **Node.js**, **Express.js**, **Socket.io**, and the **HTML5 Canvas API**. Multiple users can join the same room, draw together, see live cursors, and synchronize board actions in real time.

## 🌐 Live Deployment

### Frontend

https://assignment-11-collaborative-whitebo.vercel.app/

### Backend

https://assignment-11-collaborative-whiteboard-bzun.onrender.com

## 🛠️ Tech Stack

* Node.js
* Express.js
* Socket.io
* HTML5 Canvas API
* Vanilla JavaScript
* CORS
* dotenv

## ✨ Features

* Real-time collaborative drawing
* Multi-room whiteboard support
* Multiple users can draw simultaneously
* Live collaborator cursors
* User presence and join/leave notifications
* Clear board synchronization
* Undo complete continuous strokes
* In-memory stroke history
* New users receive existing board drawings
* Touch support for tablets
* Automatic canvas resize and redraw
* Real-time Socket.io communication

## 🏠 Room Support

Users can join different boards using a board ID.

```text
?board=demo
```

Each board has its own drawing history and connected users.

## 🔄 Main Socket Events

| Event            | Purpose                        |
| ---------------- | ------------------------------ |
| `board:join`     | Join a whiteboard room         |
| `board:init`     | Send existing board state      |
| `draw:stroke`    | Send drawing strokes           |
| `draw:broadcast` | Broadcast strokes to users     |
| `cursor:move`    | Send cursor position           |
| `cursor:update`  | Update collaborator cursors    |
| `board:clear`    | Clear the shared board         |
| `board:cleared`  | Notify users of board clearing |
| `draw:undo`      | Undo the latest stroke         |
| `board:sync`     | Synchronize board after undo   |

## 📁 Project Structure

```text
assignment-11-whiteboard-socket/
├── public/
│   ├── index.html
│   ├── canvas.js
│   └── styles.css
├── sockets/
│   ├── store.js
│   ├── boardHandler.js
│   └── cursorHandler.js
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Optional: create environment file
cp .env.example .env

# Run in development mode
npm run dev

# Run in production mode
npm start
```

The server runs on:

```text
http://localhost:5000
```

## 🧪 Testing

1. Open the whiteboard in one browser window.
2. Join a board with a username and color.
3. Open the same board in another browser/incognito window.
4. Join with another user.
5. Draw in one window and verify the stroke appears in the other.
6. Move the cursor and verify the collaborator cursor appears.
7. Test **Clear** and **Undo**.
8. Open a new user on the same board and verify previous strokes are loaded.

## 💾 Data Storage

The whiteboard uses **in-memory storage** for board rooms and stroke history.

No external database is required.

## 📤 Submission

* GitHub Repository: `itm-assignment-11-whiteboard-socket`
* Frontend: Vercel
* Backend: Render

---

### Assignment 11 – Real-Time Collaborative Whiteboard & Canvas
