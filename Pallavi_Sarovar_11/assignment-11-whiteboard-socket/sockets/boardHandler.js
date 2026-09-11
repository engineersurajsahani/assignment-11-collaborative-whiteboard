function getOrCreateBoard(boardRooms, boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

function registerBoardHandlers(io, socket, boardRooms) {
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const cleanBoardId = String(boardId).trim();
    const cleanUsername = String(username || "Anonymous").trim().slice(0, 30) || "Anonymous";
    const color = /^#[0-9a-fA-F]{6}$/.test(userColor) ? userColor : "#2196f3";

    // Leave a previous board if the same socket reconnects/changes boards.
    const previousBoardId = socket.data.boardId;
    if (previousBoardId && previousBoardId !== cleanBoardId) {
      socket.leave(previousBoardId);
      const previousBoard = boardRooms[previousBoardId];
      if (previousBoard?.users[socket.id]) {
        const previousUser = previousBoard.users[socket.id];
        delete previousBoard.users[socket.id];
        socket.to(previousBoardId).emit("user:left", {
          userId: socket.id,
          username: previousUser.username
        });
      }
    }

    const board = getOrCreateBoard(boardRooms, cleanBoardId);
    socket.join(cleanBoardId);
    socket.data.boardId = cleanBoardId;

    board.users[socket.id] = {
      username: cleanUsername,
      color,
      cursor: { x: 0, y: 0 }
    };

    const activeUsers = Object.entries(board.users).map(([userId, user]) => ({
      userId,
      username: user.username,
      color: user.color
    }));

    socket.emit("board:init", {
      strokes: board.strokes,
      activeUsers
    });

    socket.to(cleanBoardId).emit("user:joined", {
      userId: socket.id,
      username: cleanUsername,
      color
    });
  });

  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke || socket.data.boardId !== boardId) return;

    const board = boardRooms[boardId];
    if (!board) return;

    const normalizedStroke = {
      prevX: Number(stroke.prevX),
      prevY: Number(stroke.prevY),
      currX: Number(stroke.currX),
      currY: Number(stroke.currY),
      color: typeof stroke.color === "string" ? stroke.color : "#000000",
      size: Math.max(1, Math.min(50, Number(stroke.size) || 3)),
      userId: socket.id
    };

    if (![normalizedStroke.prevX, normalizedStroke.prevY, normalizedStroke.currX, normalizedStroke.currY].every(Number.isFinite)) {
      return;
    }

    board.strokes.push(normalizedStroke);

    socket.to(boardId).emit("draw:broadcast", {
      stroke: normalizedStroke
    });
  });

  socket.on("board:clear", ({ boardId }) => {
    if (!boardId || socket.data.boardId !== boardId || !boardRooms[boardId]) return;

    boardRooms[boardId].strokes = [];
    const user = boardRooms[boardId].users[socket.id];

    io.to(boardId).emit("board:cleared", {
      clearedBy: user?.username || "A collaborator"
    });
  });

  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId || socket.data.boardId !== boardId || !boardRooms[boardId]) return;

    const board = boardRooms[boardId];
    if (board.strokes.length === 0) return;

    // A "continuous stroke action" is represented by the same strokeGroupId.
    // Remove the most recent complete group.
    const lastStroke = board.strokes[board.strokes.length - 1];
    const groupId = lastStroke.strokeGroupId;

    if (groupId) {
      board.strokes = board.strokes.filter((stroke) => stroke.strokeGroupId !== groupId);
    } else {
      // Backward-safe fallback if a stroke has no group id.
      board.strokes.pop();
    }

    io.to(boardId).emit("board:sync", {
      strokes: board.strokes
    });
  });
}

module.exports = registerBoardHandlers;
