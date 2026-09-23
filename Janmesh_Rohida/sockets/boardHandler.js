/**
 * boardHandler.js
 * Handles room join/leave, stroke caching, canvas reset (clear), and action-level state undo.
 */

module.exports = function registerBoardHandlers(io, socket, boardRooms) {
  // Event: board:join
  // Payload: { boardId, username, userColor }
  socket.on("board:join", ({ boardId = "default", username = "Guest", userColor = "#6F4E37" }) => {
    // Lazily create room state if it doesn't exist
    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [],
        users: {}
      };
    }

    // Join Socket.io room
    socket.join(boardId);

    // Save session info on socket object for cleanup on disconnect
    socket.boardId = boardId;
    socket.username = username;
    socket.userColor = userColor;

    // Store user in room state
    boardRooms[boardId].users[socket.id] = {
      username,
      color: userColor,
      cursor: { x: 0, y: 0 }
    };

    // Prepare active users list array format
    const activeUsers = Object.entries(boardRooms[boardId].users).map(([userId, u]) => ({
      userId,
      username: u.username,
      color: u.color
    }));

    // Send full state to joining client only
    socket.emit("board:init", {
      strokes: boardRooms[boardId].strokes,
      activeUsers
    });

    // Notify other peers in the room
    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username,
      color: userColor
    });
  });

  // Event: draw:stroke
  // Payload: { boardId, stroke: { prevX, prevY, currX, currY, color, size, actionId } }
  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;

    const room = boardRooms[boardId];
    if (room) {
      // Append stroke segment to room history buffer
      room.strokes.push(stroke);

      // Broadcast stroke segment to all other participants in the room
      socket.to(boardId).emit("draw:broadcast", { stroke });
    }
  });

  // Event: board:clear
  // Payload: { boardId }
  socket.on("board:clear", ({ boardId }) => {
    if (!boardId) return;

    const room = boardRooms[boardId];
    if (room) {
      // Wipe full stroke history buffer for this room
      room.strokes = [];

      // Notify ALL clients in the room (including sender) to clear local canvas
      io.to(boardId).emit("board:cleared", {
        clearedBy: socket.username || "Collaborator"
      });
    }
  });

  // Event: draw:undo
  // Payload: { boardId }
  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId) return;

    const room = boardRooms[boardId];
    if (room && room.strokes.length > 0) {
      // Identify the actionId of the most recent stroke segment
      const lastStroke = room.strokes[room.strokes.length - 1];
      const targetActionId = lastStroke ? lastStroke.actionId : null;

      if (targetActionId) {
        // Remove ALL stroke segments that belong to this pen stroke action
        room.strokes = room.strokes.filter(s => s.actionId !== targetActionId);
      } else {
        // Fallback: pop single segment if no actionId attached
        room.strokes.pop();
      }

      // Broadcast updated state snapshot to ALL clients in room for authoritative resync
      io.to(boardId).emit("board:sync", {
        strokes: room.strokes
      });
    }
  });
};
