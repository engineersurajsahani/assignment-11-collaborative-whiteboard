const boardRooms = {};

const registerBoardHandlers = (io, socket) => {

  // Join a board room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId || !username) {
      return;
    }

    socket.join(boardId);

    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [],
        users: {}
      };
    }

    boardRooms[boardId].users[socket.id] = {
      username,
      color: userColor || '#000000',
      cursor: {
        x: 0,
        y: 0
      }
    };

    const room = boardRooms[boardId];

    // Send existing board state to the new user
    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Object.entries(room.users).map(
        ([userId, user]) => ({
          userId,
          username: user.username,
          color: user.color,
          cursor: user.cursor
        })
      )
    });

    // Notify other users
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor || '#000000'
    });

    console.log(`${username} joined board ${boardId}`);
  });


  // Receive a drawing stroke
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    if (!boardId || !stroke || !boardRooms[boardId]) {
      return;
    }

    boardRooms[boardId].strokes.push(stroke);

    socket.to(boardId).emit('draw:broadcast', {
      stroke
    });
  });


  // Clear the entire board
  socket.on('board:clear', ({ boardId }) => {
    if (!boardId || !boardRooms[boardId]) {
      return;
    }

    boardRooms[boardId].strokes = [];

    const user = boardRooms[boardId].users[socket.id];

    io.to(boardId).emit('board:cleared', {
      clearedBy: user ? user.username : 'Unknown user'
    });
  });


  // Undo the latest drawing action
  socket.on('draw:undo', ({ boardId }) => {
    if (!boardId || !boardRooms[boardId]) {
      return;
    }

    const strokes = boardRooms[boardId].strokes;

    if (strokes.length === 0) {
      return;
    }

    // Remove the most recent stroke
    strokes.pop();

    io.to(boardId).emit('board:sync', {
      strokes
    });
  });


  // Handle disconnect
  socket.on('disconnect', () => {
    for (const boardId in boardRooms) {

      const room = boardRooms[boardId];

      if (room.users[socket.id]) {
        const username = room.users[socket.id].username;

        delete room.users[socket.id];

        socket.to(boardId).emit('user:left', {
          userId: socket.id,
          username
        });
      }

      // Remove empty rooms
      if (Object.keys(room.users).length === 0) {
        delete boardRooms[boardId];
      }
    }
  });
};


module.exports = registerBoardHandlers;
module.exports.boardRooms = boardRooms;