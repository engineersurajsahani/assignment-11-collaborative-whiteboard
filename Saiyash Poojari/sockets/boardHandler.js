const boardRooms = {};

function getOrCreateRoom(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId: boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

function registerBoardHandlers(io, socket) {
  // Join room
  socket.on('board:join', (data) => {
    const { boardId, username, userColor } = data || {};
    if (!boardId) return;

    const room = getOrCreateRoom(boardId);

    if (socket.boardId && socket.boardId !== boardId) {
      handleDisconnect(io, socket);
    }

    socket.boardId = boardId;
    socket.username = username || 'Anonymous';
    socket.userColor = userColor || '#3b82f6';

    socket.join(boardId);

    const user = {
      userId: socket.id,
      username: socket.username,
      color: socket.userColor,
      cursor: { x: 0, y: 0 }
    };
    room.users[socket.id] = user;

    // Send complete stroke history & active users to newly joined peer
    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    // Notify other room participants
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username: user.username,
      color: user.color
    });
  });

  // Handle incoming stroke
  socket.on('draw:stroke', (data) => {
    const { boardId, stroke } = data || {};
    if (!boardId || !stroke) return;

    const room = getOrCreateRoom(boardId);
    room.strokes.push(stroke);

    socket.to(boardId).emit('draw:broadcast', { stroke });
  });

  // Undo stroke
  socket.on('draw:undo', (data) => {
    const { boardId } = data || {};
    if (!boardId) return;

    const room = boardRooms[boardId];
    if (!room || room.strokes.length === 0) return;

    const last = room.strokes[room.strokes.length - 1];
    if (last && last.strokeId) {
      const targetId = last.strokeId;
      while (
        room.strokes.length > 0 &&
        room.strokes[room.strokes.length - 1].strokeId === targetId
      ) {
        room.strokes.pop();
      }
    } else {
      room.strokes.pop();
    }

    io.to(boardId).emit('board:sync', { strokes: room.strokes });
  });

  // Clear board
  socket.on('board:clear', (data) => {
    const { boardId } = data || {};
    if (!boardId) return;

    const room = boardRooms[boardId];
    if (!room) return;

    room.strokes = [];
    io.to(boardId).emit('board:cleared', { clearedBy: socket.username || 'Someone' });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    handleDisconnect(io, socket);
  });
}

function handleDisconnect(io, socket) {
  const boardId = socket.boardId;
  if (!boardId || !boardRooms[boardId]) return;

  const room = boardRooms[boardId];
  delete room.users[socket.id];

  socket.to(boardId).emit('user:left', {
    userId: socket.id,
    username: socket.username
  });
}

module.exports = {
  registerBoardHandlers,
  boardRooms
};
