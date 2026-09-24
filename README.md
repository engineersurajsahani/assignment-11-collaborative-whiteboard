# 🎨 Real-Time Collaborative Whiteboard

A real-time multi-user collaborative whiteboard built using Node.js, Express.js, Socket.io and HTML5 Canvas.

## 🚀 Features

- Real-time collaborative drawing
- Multiple users can join the same board
- Board rooms using `boardId`
- In-memory stroke history
- New users receive existing board strokes
- Live collaborator cursor coordinates
- Clear canvas for all users
- Undo drawing actions
- User names and colors
- Responsive HTML5 Canvas interface

## 🛠️ Tech Stack

- Node.js
- Express.js
- Socket.io
- HTML5 Canvas
- JavaScript
- CSS
- CORS
- dotenv

## 📁 Project Structure

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
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md