/**
 * In-Memory Whiteboard Store
 * Structure:
 * boardRooms = {
 *   [boardId]: {
 *     boardId: string,
 *     strokes: Array<StrokeObject>,
 *     users: { [socketId]: { username: string, color: string, cursor: { x: number, y: number } } }
 *   }
 * }
 */
const boardRooms = {};

/**
 * Lazily initializes or returns an existing room entry.
 * @param {string} boardId - Unique identifier for the whiteboard room.
 * @returns {object} The board room object containing strokes and active users.
 */
function getOrCreateBoard(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

/**
 * Registers whiteboard-related socket events.
 * @param {import('socket.io').Server} io - Socket.io Server instance
 * @param {import('socket.io').Socket} socket - Connected socket instance
 */
function registerBoardHandlers(io, socket) {
  // 1. Join Whiteboard Room
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const cleanBoardId = String(boardId).trim();
    const cleanUsername = username ? String(username).trim() : `User_${socket.id.slice(0, 4)}`;
    const cleanColor = userColor || "#3b82f6";

    socket.join(cleanBoardId);

    const room = getOrCreateBoard(cleanBoardId);
    room.users[socket.id] = {
      userId: socket.id,
      username: cleanUsername,
      color: cleanColor,
      cursor: { x: 0, y: 0 }
    };

    // Store state on socket instance for disconnect cleanup
    socket.boardId = cleanBoardId;
    socket.username = cleanUsername;
    socket.userColor = cleanColor;

    // Send full board history and active user list ONLY to the joining user
    socket.emit("board:init", {
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    // Notify other peers in the room about the new participant
    socket.to(cleanBoardId).emit("user:joined", {
      userId: socket.id,
      username: cleanUsername,
      color: cleanColor
    });
  });

  // 2. Continuous Stroke Broadcast
  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    const room = getOrCreateBoard(boardId);
    
    // Store stroke in room history
    room.strokes.push(stroke);

    // Relay stroke to all other participants in the room
    socket.to(boardId).emit("draw:broadcast", { stroke });
  });

  // 3. Clear Entire Board
  socket.on("board:clear", ({ boardId }) => {
    if (!boardId) return;
    const room = getOrCreateBoard(boardId);

    // Wipe server-side stroke buffer
    room.strokes = [];

    // Broadcast clear event to ALL participants in the room (including sender)
    io.to(boardId).emit("board:cleared", {
      clearedBy: socket.username || "Anonymous"
    });
  });

  // 4. Undo Last Stroke Action
  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId) return;
    const room = getOrCreateBoard(boardId);

    if (room.strokes.length > 0) {
      const lastStroke = room.strokes[room.strokes.length - 1];
      const targetGroupId = lastStroke?.groupId;

      if (targetGroupId) {
        // Remove all segments belonging to the last stroke group
        room.strokes = room.strokes.filter(s => s.groupId !== targetGroupId);
      } else {
        // Fallback: pop last segment if no groupId is present
        room.strokes.pop();
      }
    }

    // Broadcast updated state snapshot to ALL room participants
    io.to(boardId).emit("board:sync", {
      strokes: room.strokes
    });
  });

  // 5. Handle Disconnect Cleanup
  socket.on("disconnect", () => {
    const boardId = socket.boardId;
    if (boardId && boardRooms[boardId]) {
      const username = socket.username || "User";
      
      // Remove user from room state
      delete boardRooms[boardId].users[socket.id];

      // Broadcast user departure to peers
      socket.to(boardId).emit("user:left", {
        userId: socket.id,
        username
      });

      // Optional cleanup: remove room if completely empty
      if (Object.keys(boardRooms[boardId].users).length === 0) {
        // Keep room history in memory for reconnection, or delete if desired
        // delete boardRooms[boardId];
      }
    }
  });
}

module.exports = {
  boardRooms,
  getOrCreateBoard,
  registerBoardHandlers
};
