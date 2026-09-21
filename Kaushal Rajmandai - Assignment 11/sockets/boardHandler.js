// In-memory whiteboard store
const boardRooms = {};

const getOrCreateBoard = (boardId) => {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
};

const registerBoardHandlers = (io, socket) => {
  socket.on('board:join', ({ boardId, username, userColor }) => {
    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = username;

    const board = getOrCreateBoard(boardId);
    board.users[socket.id] = { username, color: userColor, cursor: { x: 0, y: 0 } };

    // Send full history + active users to the newly joined peer
    socket.emit('board:init', {
      strokes: board.strokes,
      activeUsers: Object.entries(board.users).map(([id, u]) => ({
        userId: id,
        username: u.username,
        color: u.color
      }))
    });

    // Notify everyone else in the room
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor
    });
  });

  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const board = getOrCreateBoard(boardId);
    board.strokes.push(stroke);
    socket.to(boardId).emit('draw:broadcast', { stroke });
  });

  socket.on('board:clear', ({ boardId }) => {
    const board = getOrCreateBoard(boardId);
    board.strokes = [];
    const username = socket.data.username || 'Someone';
    io.to(boardId).emit('board:cleared', { clearedBy: username });
  });

  socket.on('draw:undo', ({ boardId }) => {
    const board = getOrCreateBoard(boardId);

    if (board.strokes.length > 0) {
      // Remove the last continuous stroke "action" —
      // strokes drawn in one continuous motion share the same strokeId
      const lastStroke = board.strokes[board.strokes.length - 1];
      const strokeId = lastStroke.strokeId;

      if (strokeId !== undefined) {
        board.strokes = board.strokes.filter((s) => s.strokeId !== strokeId);
      } else {
        board.strokes.pop();
      }
    }

    io.to(boardId).emit('board:sync', { strokes: board.strokes });
  });

  socket.on('disconnect', () => {
    const boardId = socket.data.boardId;
    const username = socket.data.username;

    if (boardId && boardRooms[boardId]) {
      delete boardRooms[boardId].users[socket.id];
      socket.to(boardId).emit('user:left', { userId: socket.id, username });
    }
  });
};

module.exports = { registerBoardHandlers, boardRooms };