# Assignment 11 - Real-Time Collaborative Whiteboard & Canvas

🔗 **Live Demo:** https://assignment-11-whiteboard-socket.onrender.com

A real-time multi-user collaborative whiteboard built with Node.js, Express.js, Socket.io and the HTML5 Canvas API.

## Features

* Real-time collaborative drawing
* Multi-user board rooms using `boardId`
* In-memory stroke history per room
* New users immediately receive existing strokes
* Live collaborator cursor tracking
* Clear canvas for everyone in a room
* Undo the latest stroke
* User join/leave notifications
* Adjustable brush size and color
* Responsive HTML5 Canvas interface

## Tech Stack

* Node.js
* Express.js
* Socket.io
* CORS
* dotenv
* HTML5 Canvas
* Vanilla JavaScript

## Project Structure

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
```

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/itm-assignment-11-whiteboard-socket.git
cd itm-assignment-11-whiteboard-socket
```

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` if desired:

```bash
cp .env.example .env
```

## Run Locally

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

Open the application locally:

```text
http://localhost:5001?board=demo
```

## Live Deployment

The application is deployed using Render.

**Live URL:**

https://assignment-11-whiteboard-socket.onrender.com

To test a collaborative board, open the same board URL in multiple browser windows:

```text
https://assignment-11-whiteboard-socket.onrender.com/?board=demo
```

## Testing

1. Open the board in two browser windows.
2. Enter different usernames/colors.
3. Click **Join Board** in both windows.
4. Draw in either window.
5. Verify the stroke appears in the other window.
6. Move the pointer and verify the collaborator cursor.
7. Open a third window with the same `board=demo` URL.
8. Verify previous strokes are loaded for the new user.
9. Test **Undo**.
10. Test **Clear Canvas** and verify every connected client clears.
11. Test different board IDs to verify room isolation.

## Room Isolation

Different board IDs create separate rooms:

```text
https://assignment-11-whiteboard-socket.onrender.com/?board=design
https://assignment-11-whiteboard-socket.onrender.com/?board=team-a
https://assignment-11-whiteboard-socket.onrender.com/?board=project-1
```

Users in one board do not receive drawing or cursor events from another board.

## In-Memory Data Storage

This project does not use a database.

The assignment uses an **in-memory stroke history buffer** to store the drawing data for each active board room.

The board state is stored on the Node.js server while it is running. Therefore, drawings are cleared when the server restarts or is redeployed.

## Deployment

The application is deployed as a Node.js Web Service on Render.

The server uses the `PORT` environment variable provided by Render:

```js
const PORT = process.env.PORT || 5001;
```

The application uses Socket.io for real-time communication between connected clients.

## Submission

**GitHub Repository:**

`itm-assignment-11-whiteboard-socket`

**Live Demo:**

https://assignment-11-whiteboard-socket.onrender.com

For the live demonstration, show two or three browser windows connected to the same board and demonstrate:

* Simultaneous drawing
* Cursor synchronization
* History synchronization for a new joiner
* Undo functionality
* Clear canvas
* User join/leave notifications
* Different board room isolation
