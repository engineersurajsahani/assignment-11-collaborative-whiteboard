/**
 * Automated test script for CollabBoard Socket.io functionality.
 * Tests: join, drawing, undo (complete stroke), clear, multi-room isolation, cursor, sync.
 *
 * Run: node test-sockets.js
 */

const { io } = require("socket.io-client");

const URL = "http://localhost:5000";
let passed = 0;
let failed = 0;

// Use unique board names per test run to avoid server state leaking between runs
const RUN_ID = Date.now().toString(36);
const BOARD_DEMO = `demo-${RUN_ID}`;
const BOARD_DESIGN = `design-${RUN_ID}`;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectClient(name) {
  return new Promise((resolve, reject) => {
    const client = io(URL, { forceNew: true });
    client.on("connect", () => resolve(client));
    client.on("connect_error", (err) => reject(err));
    client._name = name;
  });
}

async function runTests() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║     CollabBoard Socket.io Integration Tests    ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  // ── TEST 1: Connect and Join ──
  console.log("── TEST 1: Connect & Join Board ──");
  const client1 = await connectClient("Client1");
  const client2 = await connectClient("Client2");

  assert(client1.connected, "Client1 connected");
  assert(client2.connected, "Client2 connected");

  // Client1 joins board
  const initPromise1 = new Promise((resolve) => {
    client1.once("board:init", (data) => resolve(data));
  });
  client1.emit("board:join", { boardId: BOARD_DEMO, username: "Alice", userColor: "#ef4444" });
  const initData1 = await initPromise1;
  assert(Array.isArray(initData1.strokes), "Client1 received board:init with strokes array");
  assert(Array.isArray(initData1.activeUsers), "Client1 received activeUsers in board:init");
  assert(initData1.activeUsers.length === 1, "Client1 is the only user on fresh board");

  // Small delay to let server fully process Client1
  await wait(50);

  // Client2 joins same board
  const joinedPromise = new Promise((resolve) => {
    client1.once("user:joined", (data) => resolve(data));
  });
  const initPromise2 = new Promise((resolve) => {
    client2.once("board:init", (data) => resolve(data));
  });
  client2.emit("board:join", { boardId: BOARD_DEMO, username: "Bob", userColor: "#3b82f6" });
  const [joinedData, initData2] = await Promise.all([joinedPromise, initPromise2]);
  assert(joinedData.username === "Bob", "Client1 received user:joined for Bob");
  assert(initData2.activeUsers.length === 2, "Client2 sees 2 active users on init");

  console.log("");

  // ── TEST 2: Real-time Drawing ──
  console.log("── TEST 2: Real-time Drawing Broadcast ──");
  const strokeGroupId1 = "test-stroke-group-1";
  const broadcastPromise = new Promise((resolve) => {
    client2.once("draw:broadcast", (data) => resolve(data));
  });

  client1.emit("draw:stroke", {
    boardId: BOARD_DEMO,
    stroke: {
      prevX: 100, prevY: 100,
      currX: 150, currY: 150,
      color: "#ef4444", size: 4,
      strokeGroupId: strokeGroupId1
    }
  });

  const broadcastData = await broadcastPromise;
  assert(broadcastData.stroke.prevX === 100, "Broadcast stroke has correct prevX");
  assert(broadcastData.stroke.strokeGroupId === strokeGroupId1, "⭐ strokeGroupId preserved in broadcast");

  // Send more segments in the same stroke group (simulating mouse drag)
  for (let i = 0; i < 3; i++) {
    client1.emit("draw:stroke", {
      boardId: BOARD_DEMO,
      stroke: {
        prevX: 150 + i * 10, prevY: 150 + i * 10,
        currX: 160 + i * 10, currY: 160 + i * 10,
        color: "#ef4444", size: 4,
        strokeGroupId: strokeGroupId1
      }
    });
  }
  await wait(100);
  console.log("  ℹ️  Sent 4 segments in stroke group 1");

  // Draw a second complete stroke with different group
  const strokeGroupId2 = "test-stroke-group-2";
  for (let i = 0; i < 3; i++) {
    client1.emit("draw:stroke", {
      boardId: BOARD_DEMO,
      stroke: {
        prevX: 300 + i * 10, prevY: 300 + i * 10,
        currX: 310 + i * 10, currY: 310 + i * 10,
        color: "#22c55e", size: 6,
        strokeGroupId: strokeGroupId2
      }
    });
  }
  await wait(100);
  console.log("  ℹ️  Sent 3 segments in stroke group 2");

  console.log("");

  // ── TEST 3: UNDO — The Critical Test ──
  console.log("── TEST 3: UNDO — Complete Stroke Removal ──");

  // Verify state via a new client joining
  const client3 = await connectClient("Client3");
  const initPromise3 = new Promise((resolve) => {
    client3.once("board:init", (data) => resolve(data));
  });
  client3.emit("board:join", { boardId: BOARD_DEMO, username: "Charlie", userColor: "#8b5cf6" });
  const initData3 = await initPromise3;
  const totalSegmentsBefore = initData3.strokes.length;
  console.log(`  ℹ️  Board has ${totalSegmentsBefore} total stroke segments before undo`);
  assert(totalSegmentsBefore === 7, "Board has 7 segments (4 + 3) before undo");

  // Undo from Client2 — should remove ALL of stroke group 2 (3 segments)
  const syncPromise1 = new Promise((resolve) => {
    client1.once("board:sync", (data) => resolve(data));
  });
  const syncPromise2 = new Promise((resolve) => {
    client2.once("board:sync", (data) => resolve(data));
  });

  client2.emit("draw:undo", { boardId: BOARD_DEMO });

  const [syncData1, syncData2] = await Promise.all([syncPromise1, syncPromise2]);

  assert(syncData1.strokes.length === 4, "⭐ After undo #1: Client1 has 4 segments (stroke group 2 fully removed)");
  assert(syncData2.strokes.length === 4, "⭐ After undo #1: Client2 has 4 segments (synchronized)");

  // Verify remaining strokes all belong to group 1
  const allGroup1 = syncData1.strokes.every(s => s.strokeGroupId === strokeGroupId1);
  assert(allGroup1, "⭐ All remaining segments belong to stroke group 1");

  // Second undo — should remove ALL of stroke group 1 (4 segments)
  const syncPromise3 = new Promise((resolve) => {
    client1.once("board:sync", (data) => resolve(data));
  });
  client1.emit("draw:undo", { boardId: BOARD_DEMO });
  const syncData3 = await syncPromise3;
  assert(syncData3.strokes.length === 0, "⭐ After undo #2: board is completely empty");

  console.log("");

  // ── TEST 4: Clear Canvas ──
  console.log("── TEST 4: Clear Canvas ──");

  // Draw something first
  client1.emit("draw:stroke", {
    boardId: BOARD_DEMO,
    stroke: { prevX: 10, prevY: 10, currX: 20, currY: 20, color: "#000", size: 3, strokeGroupId: "clear-test" }
  });
  await wait(50);

  const clearedPromise1 = new Promise((resolve) => {
    client1.once("board:cleared", (data) => resolve(data));
  });
  const clearedPromise2 = new Promise((resolve) => {
    client2.once("board:cleared", (data) => resolve(data));
  });

  client1.emit("board:clear", { boardId: BOARD_DEMO });
  const [cleared1, cleared2] = await Promise.all([clearedPromise1, clearedPromise2]);
  assert(cleared1.clearedBy === "Alice", "board:cleared received by Client1 with correct username");
  assert(cleared2.clearedBy === "Alice", "board:cleared received by Client2");

  // Verify board is now empty via new client
  const client4 = await connectClient("Client4");
  const initPromise4 = new Promise((resolve) => {
    client4.once("board:init", (data) => resolve(data));
  });
  client4.emit("board:join", { boardId: BOARD_DEMO, username: "Diana", userColor: "#f97316" });
  const initData4 = await initPromise4;
  assert(initData4.strokes.length === 0, "New client after clear sees empty board");
  client4.disconnect();

  console.log("");

  // ── TEST 5: Multi-Room Isolation ──
  console.log("── TEST 5: Multi-Room Isolation ──");

  const clientDesign = await connectClient("DesignClient");
  const initDesign = new Promise((resolve) => {
    clientDesign.once("board:init", (data) => resolve(data));
  });
  clientDesign.emit("board:join", { boardId: BOARD_DESIGN, username: "Eve", userColor: "#eab308" });
  await initDesign;

  // Draw on the design board
  clientDesign.emit("draw:stroke", {
    boardId: BOARD_DESIGN,
    stroke: { prevX: 50, prevY: 50, currX: 100, currY: 100, color: "#eab308", size: 5, strokeGroupId: "design-stroke" }
  });
  await wait(100);

  // Verify demo board was NOT affected
  let demoReceivedStroke = false;
  client1.once("draw:broadcast", () => { demoReceivedStroke = true; });
  await wait(200);
  assert(!demoReceivedStroke, "⭐ Drawing on 'design' board did NOT leak to 'demo' board");

  // Verify design board has its own stroke
  const clientDesign2 = await connectClient("DesignClient2");
  const initDesign2 = new Promise((resolve) => {
    clientDesign2.once("board:init", (data) => resolve(data));
  });
  clientDesign2.emit("board:join", { boardId: BOARD_DESIGN, username: "Frank", userColor: "#22c55e" });
  const designInit = await initDesign2;
  assert(designInit.strokes.length === 1, "Design board has its own stroke");
  assert(designInit.strokes[0].color === "#eab308", "Design board stroke has correct color");

  clientDesign.disconnect();
  clientDesign2.disconnect();

  console.log("");

  // ── TEST 6: Cursor Tracking ──
  console.log("── TEST 6: Cursor Tracking ──");

  const cursorPromise = new Promise((resolve) => {
    client2.once("cursor:update", (data) => resolve(data));
  });
  client1.emit("cursor:move", { boardId: BOARD_DEMO, x: 250, y: 375 });
  const cursorData = await cursorPromise;
  assert(cursorData.x === 250, "Cursor x coordinate received");
  assert(cursorData.y === 375, "Cursor y coordinate received");
  assert(cursorData.username === "Alice", "Cursor update includes username");
  assert(cursorData.color === "#ef4444", "Cursor update includes color");

  console.log("");

  // ── TEST 7: User Leave ──
  console.log("── TEST 7: User Leave ──");

  const leftPromise = new Promise((resolve) => {
    client1.once("user:left", (data) => resolve(data));
  });
  client3.disconnect();
  const leftData = await leftPromise;
  assert(leftData.username === "Charlie", "user:left received with correct username");

  console.log("");

  // ── TEST 8: Board State Persistence (Reconnect) ──
  console.log("── TEST 8: Board State Persistence on Reconnect ──");

  // Draw something on demo board
  client1.emit("draw:stroke", {
    boardId: BOARD_DEMO,
    stroke: { prevX: 50, prevY: 50, currX: 80, currY: 80, color: "#000", size: 3, strokeGroupId: "persist-test" }
  });
  await wait(100);

  // New client connects and should see the stroke
  const client5 = await connectClient("Client5");
  const initPromise5 = new Promise((resolve) => {
    client5.once("board:init", (data) => resolve(data));
  });
  client5.emit("board:join", { boardId: BOARD_DEMO, username: "Grace", userColor: "#a855f7" });
  const initData5 = await initPromise5;
  assert(initData5.strokes.length >= 1, "New client receives persisted strokes on join");
  client5.disconnect();

  console.log("");

  // ── TEST 9: Undo on empty board is safe ──
  console.log("── TEST 9: Undo on Empty Board (no crash) ──");
  // Clear the board first
  client1.emit("board:clear", { boardId: BOARD_DEMO });
  await wait(100);
  // Undo on empty board should not crash
  client1.emit("draw:undo", { boardId: BOARD_DEMO });
  await wait(200);
  assert(client1.connected, "Server did not crash on undo with empty board");

  console.log("");

  // ── Summary ──
  client1.disconnect();
  client2.disconnect();

  await wait(200);

  console.log("╔════════════════════════════════════════════════╗");
  console.log(`║  Results: ${passed} passed, ${failed} failed                ║`);
  console.log("╚════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Review the output above.\n");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed!\n");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
