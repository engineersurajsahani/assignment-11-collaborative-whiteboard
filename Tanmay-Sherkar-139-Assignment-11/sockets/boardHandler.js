const registerBoardHandlers = (io, socket, boardRooms) => {
  const getOrCreateRoom = (boardId) => {
    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [],
        users: {}
      };
    }
    return boardRooms[boardId];
  };

  socket.on('board:join', (payload) => {
    const boardId = (payload && payload.boardId) ? payload.boardId.trim() : 'DEFAULT_BOARD';
    const username = (payload && payload.username) ? payload.username.trim() : `User_${socket.id.substring(0, 5)}`;
    const userColor = (payload && payload.userColor) ? payload.userColor : '#3b82f6';

    socket.boardId = boardId;
    socket.username = username;
    socket.userColor = userColor;

    socket.join(boardId);

    const room = getOrCreateRoom(boardId);
    room.users[socket.id] = {
      username,
      color: userColor,
      cursor: { x: 0, y: 0 }
    };

    const activeUsers = Object.entries(room.users).map(([userId, u]) => ({
      userId,
      username: u.username,
      color: u.color,
      cursor: u.cursor
    }));

    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers
    });

    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor
    });
  });

  socket.on('draw:stroke', (payload) => {
    if (!payload || !payload.boardId || !payload.stroke) return;
    const room = getOrCreateRoom(payload.boardId);

    room.strokes.push(payload.stroke);

    socket.to(payload.boardId).emit('draw:broadcast', {
      stroke: payload.stroke
    });
  });

  socket.on('board:clear', (payload) => {
    const boardId = (payload && payload.boardId) ? payload.boardId : socket.boardId;
    if (!boardId) return;

    const room = getOrCreateRoom(boardId);
    room.strokes = [];

    io.to(boardId).emit('board:cleared', {
      clearedBy: socket.username || 'Collaborator'
    });
  });

  socket.on('draw:undo', (payload) => {
    const boardId = (payload && payload.boardId) ? payload.boardId : socket.boardId;
    if (!boardId) return;

    const room = getOrCreateRoom(boardId);
    if (room.strokes.length > 0) {
      const lastStroke = room.strokes[room.strokes.length - 1];
      if (lastStroke && lastStroke.strokeId) {
        const targetStrokeId = lastStroke.strokeId;
        room.strokes = room.strokes.filter((s) => s.strokeId !== targetStrokeId);
      } else {
        room.strokes.pop();
      }
    }

    io.to(boardId).emit('board:sync', {
      strokes: room.strokes
    });
  });

  socket.on('disconnect', () => {
    if (socket.boardId && boardRooms[socket.boardId]) {
      const room = boardRooms[socket.boardId];
      if (room.users[socket.id]) {
        delete room.users[socket.id];
      }

      socket.to(socket.boardId).emit('user:left', {
        userId: socket.id,
        username: socket.username || 'User'
      });
    }
  });
};

module.exports = registerBoardHandlers;
