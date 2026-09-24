const socket = io();

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

const usernameInput = document.getElementById('username');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');

const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');

const status = document.getElementById('status');
const collaborators = document.getElementById('collaborators');


// Get board ID from URL
const params = new URLSearchParams(window.location.search);

const boardId = params.get('board') || 'demo';

let username = usernameInput.value || 'User';

let drawing = false;

let lastX = 0;
let lastY = 0;

let remoteCursors = {};


// Resize canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 100;
}

resizeCanvas();

window.addEventListener('resize', resizeCanvas);


// Join board
socket.on('connect', () => {

  username = usernameInput.value || 'User';

  socket.emit('board:join', {
    boardId,
    username,
    userColor: colorInput.value
  });

  status.textContent = `Connected • Board: ${boardId}`;
});


// Receive initial board state
socket.on('board:init', ({ strokes, activeUsers }) => {

  redrawCanvas(strokes);

  remoteCursors = {};

  activeUsers.forEach(user => {

    if (user.userId !== socket.id) {

      remoteCursors[user.userId] = {
        username: user.username,
        color: user.color,
        x: user.cursor.x,
        y: user.cursor.y
      };

    }

  });

  updateCollaborators();
});


// Receive drawing from another user
socket.on('draw:broadcast', ({ stroke }) => {

  drawStroke(stroke);

});


// Receive board sync after undo
socket.on('board:sync', ({ strokes }) => {

  redrawCanvas(strokes);

});


// Board cleared
socket.on('board:cleared', ({ clearedBy }) => {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  status.textContent = `Canvas cleared by ${clearedBy}`;

});


// User joined
socket.on('user:joined', user => {

  remoteCursors[user.userId] = {
    username: user.username,
    color: user.color,
    x: 0,
    y: 0
  };

  updateCollaborators();

});


// User left
socket.on('user:left', user => {

  delete remoteCursors[user.userId];

  updateCollaborators();

});


// Cursor update
socket.on('cursor:update', data => {

  if (!remoteCursors[data.userId]) {
    remoteCursors[data.userId] = {
      username: 'User',
      color: '#000000'
    };
  }

  remoteCursors[data.userId].x = data.x;
  remoteCursors[data.userId].y = data.y;

  updateCollaborators();

});


// Start drawing
canvas.addEventListener('mousedown', event => {

  drawing = true;

  lastX = event.offsetX;
  lastY = event.offsetY;

});


// Draw
canvas.addEventListener('mousemove', event => {

  const x = event.offsetX;
  const y = event.offsetY;


  // Send cursor position
  socket.emit('cursor:move', {
    boardId,
    x,
    y
  });


  if (!drawing) {
    return;
  }


  const stroke = {
    prevX: lastX,
    prevY: lastY,
    currX: x,
    currY: y,
    color: colorInput.value,
    size: Number(sizeInput.value)
  };


  drawStroke(stroke);


  socket.emit('draw:stroke', {
    boardId,
    stroke
  });


  lastX = x;
  lastY = y;

});


// Stop drawing
canvas.addEventListener('mouseup', () => {
  drawing = false;
});

canvas.addEventListener('mouseleave', () => {
  drawing = false;
});


// Undo
undoBtn.addEventListener('click', () => {

  socket.emit('draw:undo', {
    boardId
  });

});


// Clear
clearBtn.addEventListener('click', () => {

  socket.emit('board:clear', {
    boardId
  });

});


// Draw one stroke
function drawStroke(stroke) {

  ctx.beginPath();

  ctx.moveTo(stroke.prevX, stroke.prevY);

  ctx.lineTo(stroke.currX, stroke.currY);

  ctx.strokeStyle = stroke.color;

  ctx.lineWidth = stroke.size;

  ctx.lineCap = 'round';

  ctx.stroke();

  ctx.closePath();

}


// Redraw entire canvas
function redrawCanvas(strokes) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  strokes.forEach(stroke => {
    drawStroke(stroke);
  });

}


// Update collaborator display
function updateCollaborators() {

  const users = Object.values(remoteCursors);

  if (users.length === 0) {

    collaborators.innerHTML = 'No other users';

    return;

  }

  collaborators.innerHTML = `
    <strong>Collaborators</strong>
    <br>
    ${users
      .map(user => `
        <span style="color:${user.color}">
          ● ${user.username}
        </span>
      `)
      .join('<br>')}
  `;

}