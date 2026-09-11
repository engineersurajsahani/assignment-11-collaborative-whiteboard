# Assignment 11: Real-Time Collaborative Whiteboard & Canvas

## Student Details

- Name: Pallavi
- Roll No: __________________
- Cohort: __________________

## Objective

Build a high-performance real-time collaborative multi-user whiteboard application using Node.js, Express.js, Socket.io, HTML5 Canvas API and CORS.

## Features Implemented

- Socket.io real-time connection
- Multi-user board rooms using `boardId`
- In-memory stroke history per board
- Immediate board synchronization for new users
- Real-time drawing/stroke broadcasting
- Live collaborator cursor tracking
- Clear Canvas for all connected users
- Undo of the most recent continuous drawing action
- Responsive HTML5 Canvas interface
- Organized server-side socket handlers

## Project Structure

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

## Installation

Open Terminal inside the project folder and run:

npm install

## Run the Application

For normal mode:

npm start

For development mode with automatic restart:

npm run dev

The server runs at:

http://localhost:5000

## Testing the Assignment

1. Start the server.
2. Open two browser windows at:
   http://localhost:5000?board=demo
3. Enter different usernames and click Join Board if needed.
4. Draw in Window 1.
5. Confirm the same drawing appears in Window 2 in real time.
6. Move the mouse in Window 1 and confirm the collaborator cursor is visible in Window 2.
7. Open a third window/incognito tab using the same board URL.
8. Confirm previous strokes load immediately.
9. Click Clear Canvas and confirm all users' canvases are cleared.
10. Draw again and click Undo. Confirm the latest continuous stroke is removed for all users.

## Socket Event Protocol

### Room and Session Events

- `board:join`
- `board:init`
- `user:joined`
- `user:left`

### Drawing and Pointer Events

- `draw:stroke`
- `draw:broadcast`
- `cursor:move`
- `cursor:update`
- `board:clear`
- `board:cleared`
- `draw:undo`
- `board:sync`

## Notes

The assignment stores board state in server memory, as required. Restarting the Node.js server clears the in-memory drawing history.

Before submitting, update the Roll No and Cohort fields above with your actual details.

Submission repository name required by the assignment:

itm-assignment-11-whiteboard-socket
