const { getOrCreateBoard, getActiveUsers, undoLastStroke, boardRooms } = require("./store");

const socketBoardMap = {};

function registerBoardHandlers(io, socket) {

  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId || !username) return;

    const board = getOrCreateBoard(boardId);
    board.users[socket.id] = {
      username,
      color: userColor || "#000000",
      cursor: { x: 0, y: 0 },
    };

    socket.join(boardId);
    socketBoardMap[socket.id] = boardId;


    socket.emit("board:init", {
      strokes: board.strokes,
      activeUsers: getActiveUsers(boardId),
    });


    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username,
      color: userColor || "#000000",
    });
  });


  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    const board = getOrCreateBoard(boardId);

    board.strokes.push({
      ...stroke,
      userId: socket.id,
    });


    socket.to(boardId).emit("draw:broadcast", { stroke: { ...stroke, userId: socket.id } });
  });


  socket.on("board:clear", ({ boardId }) => {
    if (!boardId) return;
    const board = getOrCreateBoard(boardId);
    board.strokes = [];

    const clearedBy = board.users[socket.id]?.username || "Someone";


    io.to(boardId).emit("board:cleared", { clearedBy });
  });


  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId) return;
    const remainingStrokes = undoLastStroke(boardId);


    io.to(boardId).emit("board:sync", { strokes: remainingStrokes });
  });

  socket.on("disconnect", () => {
    const boardId = socketBoardMap[socket.id];
    if (!boardId) return;

    const board = boardRooms[boardId];
    const username = board?.users[socket.id]?.username;

    if (board) {
      delete board.users[socket.id];
    }
    delete socketBoardMap[socket.id];


    socket.to(boardId).emit("user:left", {
      userId: socket.id,
      username,
    });
  });
}

module.exports = { registerBoardHandlers };
