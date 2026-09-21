function handleBoardJoin(io, socket, boardRooms) {
  return (data) => {
    const { boardId, username, userColor } = data;
    
    let room = boardRooms.get(boardId);
    if (!room) {
      room = {
        boardId,
        strokes: [],
        users: new Map()
      };
      boardRooms.set(boardId, room);
    }

    socket.join(boardId);
    socket.boardId = boardId;
    socket.username = username;
    socket.userColor = userColor;

    room.users.set(socket.id, {
      username,
      color: userColor,
      cursor: { x: 0, y: 0 }
    });

    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Array.from(room.users.entries()).map(([id, user]) => ({
        userId: id,
        username: user.username,
        color: user.color
      }))
    });

    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor
    });

    console.log(`${username} joined board ${boardId}`);
  };
}

function handleDrawStroke(io, socket, boardRooms) {
  return (data) => {
    const { boardId, stroke } = data;
    
    const room = boardRooms.get(boardId);
    if (!room) return;

    room.strokes.push(stroke);

    socket.to(boardId).emit('draw:broadcast', { stroke });
  };
}

function handleBoardClear(io, socket, boardRooms) {
  return (data) => {
    const { boardId } = data;
    
    const room = boardRooms.get(boardId);
    if (!room) return;

    room.strokes = [];

    io.to(boardId).emit('board:cleared', {
      clearedBy: socket.username
    });

    console.log(`Board ${boardId} cleared by ${socket.username}`);
  };
}

function handleDrawUndo(io, socket, boardRooms) {
  return (data) => {
    const { boardId } = data;
    
    const room = boardRooms.get(boardId);
    if (!room) return;

    if (room.strokes.length > 0) {
      room.strokes.pop();

      io.to(boardId).emit('board:sync', {
        strokes: room.strokes
      });

      console.log(`Undo by ${socket.username} on board ${boardId}`);
    }
  };
}

function handleDisconnect(io, socket, boardRooms) {
  return () => {
    if (socket.boardId) {
      const room = boardRooms.get(socket.boardId);
      if (room) {
        room.users.delete(socket.id);

        socket.to(socket.boardId).emit('user:left', {
          userId: socket.id,
          username: socket.username
        });

        console.log(`${socket.username} left board ${socket.boardId}`);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  };
}

module.exports = {
  handleBoardJoin,
  handleDrawStroke,
  handleBoardClear,
  handleDrawUndo,
  handleDisconnect
};
