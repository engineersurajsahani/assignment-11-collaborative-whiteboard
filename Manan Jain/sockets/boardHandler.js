module.exports = function (io, socket, boardRooms) {
  // Handle joining a board room
  socket.on('board:join', (data) => {
    try {
      if (!data || !data.boardId || !data.username) {
        return;
      }

      const boardId = data.boardId.trim();
      const username = data.username.trim();
      const userColor = data.userColor || '#3b82f6';

      if (!boardId || !username) {
        return;
      }

      // Store boardId and username on socket instance
      socket.boardId = boardId;
      socket.username = username;
      socket.userColor = userColor;

      // Ensure room exists in memory
      if (!boardRooms[boardId]) {
        boardRooms[boardId] = {
          boardId: boardId,
          strokes: [],
          users: {}
        };
      }

      // Add user to room state
      boardRooms[boardId].users[socket.id] = {
        socketId: socket.id,
        username: username,
        color: userColor,
        cursor: { x: 0, y: 0 }
      };

      // Join Socket.io room
      socket.join(boardId);

      // Send existing state to newly joined user
      socket.emit('board:init', {
        strokes: boardRooms[boardId].strokes,
        users: boardRooms[boardId].users
      });

      // Notify other room members
      socket.to(boardId).emit('user:joined', {
        socketId: socket.id,
        username: username,
        userColor: userColor,
        users: boardRooms[boardId].users
      });
    } catch (err) {
      console.error('Error handling board:join:', err);
    }
  });

  // Handle drawing stroke
  socket.on('draw:stroke', (data) => {
    try {
      if (!data || !data.boardId || !data.stroke) {
        return;
      }

      const { boardId, stroke } = data;
      if (!boardRooms[boardId]) {
        return;
      }

      // Basic validation of stroke segment
      if (
        typeof stroke.prevX !== 'number' ||
        typeof stroke.prevY !== 'number' ||
        typeof stroke.currX !== 'number' ||
        typeof stroke.currY !== 'number'
      ) {
        return;
      }

      // Save stroke to in-memory strokes array
      boardRooms[boardId].strokes.push(stroke);

      // Broadcast stroke to other connected users in room
      socket.to(boardId).emit('draw:broadcast', stroke);
    } catch (err) {
      console.error('Error handling draw:stroke:', err);
    }
  });

  // Handle clear canvas
  socket.on('board:clear', (data) => {
    try {
      if (!data || !data.boardId) {
        return;
      }

      const { boardId } = data;
      if (!boardRooms[boardId]) {
        return;
      }

      // Reset in-memory strokes array
      boardRooms[boardId].strokes = [];

      // Broadcast clear event to ALL clients in room
      const clearedBy = socket.username || 'Someone';
      io.to(boardId).emit('board:cleared', {
        clearedBy: clearedBy
      });
    } catch (err) {
      console.error('Error handling board:clear:', err);
    }
  });

  // Handle stroke undo
  socket.on('draw:undo', (data) => {
    try {
      if (!data || !data.boardId) {
        return;
      }

      const { boardId } = data;
      if (!boardRooms[boardId]) {
        return;
      }

      const roomStrokes = boardRooms[boardId].strokes;
      if (roomStrokes.length > 0) {
        const lastStroke = roomStrokes[roomStrokes.length - 1];
        if (lastStroke && lastStroke.strokeId) {
          const targetStrokeId = lastStroke.strokeId;
          // Pop continuous stroke matching targetStrokeId
          while (
            boardRooms[boardId].strokes.length > 0 &&
            boardRooms[boardId].strokes[boardRooms[boardId].strokes.length - 1].strokeId === targetStrokeId
          ) {
            boardRooms[boardId].strokes.pop();
          }
        } else {
          // Fallback: pop single segment
          boardRooms[boardId].strokes.pop();
        }
      }

      // Broadcast updated strokes state to ALL users in room
      io.to(boardId).emit('board:sync', {
        strokes: boardRooms[boardId].strokes
      });
    } catch (err) {
      console.error('Error handling draw:undo:', err);
    }
  });

  // Handle disconnect / user exit
  socket.on('disconnect', () => {
    try {
      const boardId = socket.boardId;
      if (!boardId || !boardRooms[boardId]) {
        return;
      }

      // Remove user from room state
      delete boardRooms[boardId].users[socket.id];

      // Notify remaining users
      io.to(boardId).emit('user:left', {
        socketId: socket.id,
        username: socket.username,
        users: boardRooms[boardId].users
      });

      // Clean up empty room
      if (Object.keys(boardRooms[boardId].users).length === 0) {
        delete boardRooms[boardId];
      }
    } catch (err) {
      console.error('Error handling disconnect:', err);
    }
  });
};
