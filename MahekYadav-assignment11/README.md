# Assignment 11 - Real-Time Collaborative Whiteboard & Canvas

A real-time multi-user collaborative whiteboard built with Node.js, Express.js, Socket.io and the HTML5 Canvas API.

Live link : https://assignment-11-whiteboard-socket.onrender.com


## Features

- Real-time collaborative drawing
- Multi-user board rooms using `boardId`
- In-memory stroke history per room
- New users immediately receive existing strokes
- Live collaborator cursor tracking
- Clear canvas for everyone in a room
- Undo the latest stroke
- User join/leave notifications
- Adjustable brush size and color
- Responsive HTML5 Canvas interface

## Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- HTML5 Canvas
- Vanilla JavaScript

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
├── .env.example
├── .gitignore
└── README.md
```

## Installation

```bash
npm install
```

Create `.env` from `.env.example` if desired:

```bash
cp .env.example .env
```

## Run

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

Open:

```text
http://localhost:5000?board=demo
```

## Testing

1. Open the board in two browser windows.
2. Enter different usernames/colors.
3. Click **Join Board** in both windows.
4. Draw in either window.
5. Verify the stroke appears in the other window.
6. Move the pointer and verify the collaborator cursor.
7. Open a third window with the same `board=demo` URL.
8. Verify previous strokes are loaded.
9. Test **Undo**.
10. Test **Clear Canvas** and verify every connected client clears.

## Room Isolation

Different board IDs create separate rooms:

```text
http://localhost:5000?board=design
http://localhost:5000?board=team-a
http://localhost:5000?board=project-1
```

Users in one board do not receive drawing or cursor events from another board.

## Submission

Suggested GitHub repository name:

`itm-assignment-11-whiteboard-socket`

For the live demonstration, show two or three browser windows connected to the same board and demonstrate:

- simultaneous drawing
- cursor synchronization
- history synchronization for a new joiner
- undo
- clear
