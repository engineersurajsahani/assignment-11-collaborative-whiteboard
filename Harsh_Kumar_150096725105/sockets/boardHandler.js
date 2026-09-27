const boardRooms = {};

module.exports = (io, socket) => {
  socket.on('board:join', ({ boardId, username, userColor }) => {
    socket.join(boardId);
    socket.boardId = boardId;
    socket.username = username;
    socket.userColor = userColor;

    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [],
        users: {}
      };
    }

    boardRooms[boardId].users[socket.id] = {
      username,
      color: userColor,
      cursor: { x: 0, y: 0 }
    };

    // Send complete history to the new joiner
    socket.emit('board:init', {
      strokes: boardRooms[boardId].strokes,
      activeUsers: Object.values(boardRooms[boardId].users)
    });

    // Notify others
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor
    });
  });

  socket.on('draw:stroke', ({ boardId, stroke }) => {
    if (boardRooms[boardId]) {
      // Adding userId to the stroke for undo feature
      const newStroke = { ...stroke, userId: socket.id };
      boardRooms[boardId].strokes.push(newStroke);
      socket.to(boardId).emit('draw:broadcast', { stroke: newStroke });
    }
  });

  socket.on('board:clear', ({ boardId }) => {
    if (boardRooms[boardId]) {
      boardRooms[boardId].strokes = [];
      io.to(boardId).emit('board:cleared', { clearedBy: socket.username });
    }
  });

  socket.on('draw:undo', ({ boardId }) => {
    if (boardRooms[boardId]) {
      const strokes = boardRooms[boardId].strokes;
      // Find the last stroke made by this user
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].userId === socket.id) {
          strokes.splice(i, 1);
          break;
        }
      }
      io.to(boardId).emit('board:sync', { strokes: boardRooms[boardId].strokes });
    }
  });

  socket.on('disconnect', () => {
    const boardId = socket.boardId;
    if (boardId && boardRooms[boardId]) {
      delete boardRooms[boardId].users[socket.id];
      socket.to(boardId).emit('user:left', { userId: socket.id, username: socket.username });
    }
  });
};

module.exports.boardRooms = boardRooms;
