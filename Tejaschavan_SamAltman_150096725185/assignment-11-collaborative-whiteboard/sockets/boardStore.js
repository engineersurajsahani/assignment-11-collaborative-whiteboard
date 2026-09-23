// In-Memory Whiteboard Store — module-level singleton shared across handler files
const boardRooms = {
  // "DESIGN_101": {
  //   boardId: "DESIGN_101",
  //   strokes: [],   // array of stroke objects, each tagged with a strokeGroupId (see undo below)
  //   users: {}      // socketId -> { username, color, cursor: { x, y } }
  // }
};

module.exports = { boardRooms };
