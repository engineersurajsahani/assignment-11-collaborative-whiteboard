const { boardRooms } = require('./boardStore');

/**
 * Registers all whiteboard room and drawing event handlers for a socket connection.
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {import('socket.io').Socket} socket - Socket instance for connected client
 */
function registerBoardHandlers(io, socket) {
  // 1. Client joins a whiteboard room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const normalizedBoardId = String(boardId).trim();
    const safeUsername = (username && String(username).trim()) || `User-${socket.id.substring(0, 4)}`;
    const safeColor = userColor || '#3B82F6';

    socket.join(normalizedBoardId);

    // Initialize room state if it doesn't exist yet
    if (!boardRooms[normalizedBoardId]) {
      boardRooms[normalizedBoardId] = {
        boardId: normalizedBoardId,
        strokes: [],
        users: {}
      };
    }

    // Store user data in room state
    boardRooms[normalizedBoardId].users[socket.id] = {
      username: safeUsername,
      color: safeColor,
      cursor: { x: 0, y: 0 }
    };

    // Attach metadata to socket for lifecycle reference (e.g., disconnect)
    socket.data.boardId = normalizedBoardId;
    socket.data.username = safeUsername;
    socket.data.color = safeColor;

    // Compile active users list in the room (including all current participants)
    const activeUsers = Object.entries(boardRooms[normalizedBoardId].users).map(([userId, u]) => ({
      userId,
      username: u.username,
      color: u.color,
      cursor: u.cursor
    }));

    // Emit initial room state to joining client only
    socket.emit('board:init', {
      strokes: boardRooms[normalizedBoardId].strokes,
      activeUsers
    });

    // Notify other peers in the room about the new user
    socket.to(normalizedBoardId).emit('user:joined', {
      userId: socket.id,
      username: safeUsername,
      color: safeColor
    });
  });

  // 2. Client sends a continuous drawing stroke segment
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const targetBoardId = boardId || socket.data.boardId;
    if (!targetBoardId || !stroke) return;

    if (!boardRooms[targetBoardId]) {
      boardRooms[targetBoardId] = {
        boardId: targetBoardId,
        strokes: [],
        users: {}
      };
    }

    // Attach server-side timestamp and ensure strokeGroupId exists
    const strokeData = {
      ...stroke,
      strokeGroupId: stroke.strokeGroupId || `grp-${Date.now()}-${socket.id}`,
      timestamp: Date.now()
    };

    boardRooms[targetBoardId].strokes.push(strokeData);

    // Broadcast only to other peers in the room (sender rendered locally)
    socket.to(targetBoardId).emit('draw:broadcast', { stroke: strokeData });
  });

  // 3. Client requests clearing the canvas
  socket.on('board:clear', ({ boardId }) => {
    const targetBoardId = boardId || socket.data.boardId;
    if (!targetBoardId) return;

    if (boardRooms[targetBoardId]) {
      boardRooms[targetBoardId].strokes = [];
    }

    const clearedBy = socket.data.username || 'A collaborator';

    // Broadcast clear event to the entire room (including sender)
    io.to(targetBoardId).emit('board:cleared', { clearedBy });
  });

  // 4. Client requests undoing the last full continuous stroke
  socket.on('draw:undo', ({ boardId }) => {
    const targetBoardId = boardId || socket.data.boardId;
    if (!targetBoardId) return;

    const room = boardRooms[targetBoardId];
    if (room && room.strokes.length > 0) {
      // Identify the strokeGroupId of the last recorded segment
      const lastStroke = room.strokes[room.strokes.length - 1];
      const targetGroupId = lastStroke.strokeGroupId;

      // Filter out all segments sharing that strokeGroupId (the whole drag action)
      room.strokes = room.strokes.filter((s) => s.strokeGroupId !== targetGroupId);
    }

    const currentStrokes = room ? room.strokes : [];

    // Broadcast full authoritative stroke list to the entire room
    io.to(targetBoardId).emit('board:sync', { strokes: currentStrokes });
  });

  // 5. Socket disconnection cleanup
  socket.on('disconnect', () => {
    const boardId = socket.data.boardId;
    const username = socket.data.username;

    if (boardId && boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
      delete boardRooms[boardId].users[socket.id];

      // Broadcast user departure to the rest of the room
      socket.to(boardId).emit('user:left', {
        userId: socket.id,
        username: username || 'A collaborator'
      });
      // NOTE: Strokes are preserved in memory even if the room is currently empty,
      // allowing reconnecting or new users to access previous drawings.
    }
  });
}

module.exports = { registerBoardHandlers };
