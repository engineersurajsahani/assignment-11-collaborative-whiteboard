const boardRooms = {};

const getRoom = (boardId) => {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
};

const setupBoardHandler = (io, socket) => {
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const bId = String(boardId).trim();
    const uname = (username || 'Anonymous').trim();
    const color = userColor || '#000000';

    socket.join(bId);
    socket.currentBoard = bId;
    socket.username = uname;
    socket.userColor = color;

    const room = getRoom(bId);
    room.users[socket.id] = {
      userId: socket.id,
      username: uname,
      color,
      cursor: { x: 0, y: 0 }
    };

    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    socket.to(bId).emit('user:joined', {
      userId: socket.id,
      username: uname,
      color
    });
  });

  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const bId = boardId || socket.currentBoard;
    if (!bId || !stroke) return;

    const room = getRoom(bId);
    room.strokes.push(stroke);

    socket.to(bId).emit('draw:broadcast', { stroke });
  });

  socket.on('board:clear', ({ boardId }) => {
    const bId = boardId || socket.currentBoard;
    if (!bId) return;

    const room = getRoom(bId);
    room.strokes = [];

    io.to(bId).emit('board:cleared', {
      clearedBy: socket.username || 'Anonymous'
    });
  });

  socket.on('draw:undo', ({ boardId }) => {
    const bId = boardId || socket.currentBoard;
    if (!bId) return;

    const room = getRoom(bId);
    if (room.strokes.length > 0) {
      const lastStroke = room.strokes[room.strokes.length - 1];
      if (lastStroke && lastStroke.strokeId) {
        const sid = lastStroke.strokeId;
        room.strokes = room.strokes.filter((s) => s.strokeId !== sid);
      } else {
        room.strokes.pop();
      }
    }

    io.to(bId).emit('board:sync', { strokes: room.strokes });
  });

  socket.on('disconnect', () => {
    const bId = socket.currentBoard;
    if (bId && boardRooms[bId] && boardRooms[bId].users[socket.id]) {
      delete boardRooms[bId].users[socket.id];
      socket.to(bId).emit('user:left', {
        userId: socket.id,
        username: socket.username
      });
    }
  });
};

module.exports = { setupBoardHandler, boardRooms };
