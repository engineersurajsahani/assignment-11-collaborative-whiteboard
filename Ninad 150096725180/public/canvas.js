const socket = io();

// UI Elements
const joinScreen = document.getElementById('join-screen');
const boardScreen = document.getElementById('board-screen');
const joinBtn = document.getElementById('join-btn');
const boardIdInput = document.getElementById('board-id-input');
const usernameInput = document.getElementById('username-input');
const userColorInput = document.getElementById('user-color-input');
const roomInfo = document.getElementById('room-info');

// Canvas Elements
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const cursorsLayer = document.getElementById('cursors-layer');

// Tools
const colorPicker = document.getElementById('stroke-color');
const sizePicker = document.getElementById('stroke-size');
const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');

// State
let isDrawing = false;
let currentPathId = null;
let lastX = 0;
let lastY = 0;
let currentBoardId = '';
let activeUsers = {};
let localStrokes = [];

function resizeCanvas() {
    canvas.width = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;
    redrawCanvas();
}

window.addEventListener('resize', resizeCanvas);

// Join logic
joinBtn.addEventListener('click', () => {
    const boardId = boardIdInput.value.trim();
    const username = usernameInput.value.trim();
    const userColor = userColorInput.value;

    if (boardId && username) {
        currentBoardId = boardId;
        socket.emit('board:join', { boardId, username, userColor });
        joinScreen.style.display = 'none';
        boardScreen.style.display = 'flex';
        roomInfo.textContent = `Room: ${boardId} | User: ${username}`;
        
        setTimeout(resizeCanvas, 0);
    }
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('board')) {
    boardIdInput.value = urlParams.get('board');
}

// Drawing Logic
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
    currentPathId = generateId();
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    socket.emit('cursor:move', {
        boardId: currentBoardId,
        x: pos.x,
        y: pos.y
    });

    if (!isDrawing) return;

    const stroke = {
        pathId: currentPathId,
        prevX: lastX,
        prevY: lastY,
        currX: pos.x,
        currY: pos.y,
        color: colorPicker.value,
        size: sizePicker.value
    };

    drawStroke(stroke);
    localStrokes.push(stroke);

    socket.emit('draw:stroke', {
        boardId: currentBoardId,
        stroke
    });

    lastX = pos.x;
    lastY = pos.y;
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    currentPathId = null;
});
canvas.addEventListener('mouseout', () => {
    isDrawing = false;
    currentPathId = null;
});

function drawStroke(stroke) {
    ctx.beginPath();
    ctx.moveTo(stroke.prevX, stroke.prevY);
    ctx.lineTo(stroke.currX, stroke.currY);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStrokes.forEach(drawStroke);
}

// Button Listeners
clearBtn.addEventListener('click', () => {
    socket.emit('board:clear', { boardId: currentBoardId });
});

undoBtn.addEventListener('click', () => {
    socket.emit('draw:undo', { boardId: currentBoardId });
});

// Socket Events
socket.on('board:init', ({ strokes, activeUsers: users }) => {
    localStrokes = strokes;
    redrawCanvas();
});

socket.on('user:joined', (user) => {
    activeUsers[user.userId] = user;
});

socket.on('user:left', ({ userId, username }) => {
    delete activeUsers[userId];
    const cursor = document.getElementById(`cursor-${userId}`);
    if (cursor) cursor.remove();
});

socket.on('draw:broadcast', ({ stroke }) => {
    localStrokes.push(stroke);
    drawStroke(stroke);
});

socket.on('board:cleared', ({ clearedBy }) => {
    localStrokes = [];
    redrawCanvas();
});

socket.on('board:sync', ({ strokes }) => {
    localStrokes = strokes;
    redrawCanvas();
});

socket.on('cursor:update', ({ userId, x, y }) => {
    let cursor = document.getElementById(`cursor-${userId}`);
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = `cursor-${userId}`;
        cursor.className = 'cursor';
        
        const label = document.createElement('div');
        label.className = 'cursor-label';
        
        const userColor = activeUsers[userId]?.color || '#000';
        const userName = activeUsers[userId]?.username || 'User';
        
        cursor.style.backgroundColor = userColor;
        label.textContent = userName;
        cursor.appendChild(label);
        
        cursorsLayer.appendChild(cursor);
    }
    
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
});
