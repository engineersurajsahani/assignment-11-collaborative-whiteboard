// In-Memory Whiteboard Store
const boardRooms = {};

function setupBoardHandlers(io, socket) {
  // 1. Join Board Room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId) return;

    // Initialize room state if not existing
    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [], // Array of stroke line segment objects
        users: {}    // Map socketId -> user details
      };
    }

    socket.join(boardId);
    socket.boardId = boardId;
    socket.username = username || 'Anonymous';
    socket.userColor = userColor || '#ff5722';

    // Store user session details
    boardRooms[boardId].users[socket.id] = {
      userId: socket.id,
      username: socket.username,
      color: socket.userColor,
      cursor: { x: 0, y: 0 }
    };

    // Emit initial canvas state to joining client
    socket.emit('board:init', {
      strokes: boardRooms[boardId].strokes,
      activeUsers: Object.values(boardRooms[boardId].users)
    });

    // Notify other peers in room
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username: socket.username,
      color: socket.userColor
    });
  });

  // 2. Continuous Line Segment Draw Event
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const targetBoardId = boardId || socket.boardId;
    if (!targetBoardId || !boardRooms[targetBoardId] || !stroke) return;

    // Append to server history buffer
    boardRooms[targetBoardId].strokes.push(stroke);

    // Relay segment to all other participants
    socket.to(targetBoardId).emit('draw:broadcast', { stroke });
  });

  // 3. Clear Board Event
  socket.on('board:clear', ({ boardId }) => {
    const targetBoardId = boardId || socket.boardId;
    if (!targetBoardId || !boardRooms[targetBoardId]) return;

    // Wipe stroke history buffer
    boardRooms[targetBoardId].strokes = [];

    // Notify all peers in room
    io.to(targetBoardId).emit('board:cleared', {
      clearedBy: socket.username || 'A collaborator'
    });
  });

  // 4. Undo Last Action Event
  socket.on('draw:undo', ({ boardId }) => {
    const targetBoardId = boardId || socket.boardId;
    if (!targetBoardId || !boardRooms[targetBoardId]) return;

    const strokes = boardRooms[targetBoardId].strokes;
    if (strokes.length === 0) return;

    // Find strokeId of the most recent segment and remove all segments sharing that strokeId
    const lastStrokeId = strokes[strokes.length - 1].strokeId;
    if (lastStrokeId) {
      boardRooms[targetBoardId].strokes = strokes.filter(s => s.strokeId !== lastStrokeId);
    } else {
      boardRooms[targetBoardId].strokes.pop();
    }

    // Broadcast updated state snapshot to all room users
    io.to(targetBoardId).emit('board:sync', {
      strokes: boardRooms[targetBoardId].strokes
    });
  });

  // 5. Disconnect Cleanup
  socket.on('disconnect', () => {
    const boardId = socket.boardId;
    if (boardId && boardRooms[boardId]) {
      delete boardRooms[boardId].users[socket.id];

      socket.to(boardId).emit('user:left', {
        userId: socket.id,
        username: socket.username
      });

      // Cleanup room if empty
      if (Object.keys(boardRooms[boardId].users).length === 0) {
        delete boardRooms[boardId];
      }
    }
  });
}

module.exports = { setupBoardHandlers, boardRooms };