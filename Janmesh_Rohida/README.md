# Real-Time Collaborative Whiteboard & Canvas (Socket.io)

A high-performance real-time collaborative multi-user whiteboard application built with **Node.js**, **Express.js**, **Socket.io**, and native **HTML5 Canvas API**.

---

## 🎨 Theme & UI Design Rationale

The user interface follows a rich **Brown & White** palette (`#6F4E37` coffee brown, `#FBF7F0` warm off-white background, and `#E4D5C3` soft tan borders).

| Token | Hex / Value | Description / Element Usage |
| :--- | :--- | :--- |
| `--color-bg` | `#FBF7F0` | Warm off-white page background |
| `--color-canvas-bg` | `#FFFFFF` | Clean white drawing canvas surface |
| `--color-surface` | `#FFFFFF` | Toolbar & panel backgrounds |
| `--color-primary` | `#6F4E37` | Coffee brown - Header & primary tool buttons |
| `--color-primary-dark`| `#4A3222` | Darker brown - Active highlights & hover states |
| `--color-primary-light`| `#A9745B` | Lighter brown - Secondary buttons & sub-borders |
| `--color-accent` | `#D2B48C` | Tan - Selected tool highlight & user badges |
| `--color-border` | `#E4D5C3` | Soft tan border framing the canvas & panels |
| `--color-text` | `#3B2A20` | Dark brown readable typography |
| `--color-text-muted` | `#8B6F5B` | Muted brown for secondary labels |

---

## ⚡ Socket.io Event Protocol Reference

### Room & Session Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `board:join` | Client → Server | `{ boardId, username, userColor }` | Client requests to join a multi-user board room. |
| `board:init` | Server → Client | `{ strokes, activeUsers }` | Sent exclusively to newly joined client with full stroke history and active user list. |
| `user:joined` | Server → Room (excl. sender) | `{ userId, username, color }` | Broadcasts new collaborator presence to existing room participants. |
| `user:left` | Server → Room | `{ userId, username }` | Broadcasts peer departure on socket disconnect or room leave. |

### Drawing & Pointer Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `draw:stroke` | Client → Server | `{ boardId, stroke: { prevX, prevY, currX, currY, color, size, actionId } }` | Transmits a continuous vector stroke segment tagged with a stroke `actionId`. |
| `draw:broadcast` | Server → Room (excl. sender) | `{ stroke }` | Relays incoming stroke segment to all other participants in the room. |
| `cursor:move` | Client → Server | `{ boardId, x, y }` | Throttled (~30ms) pointer coordinate update sent by client. |
| `cursor:update` | Server → Room (excl. sender) | `{ userId, x, y }` | Streams live peer cursor coordinates to render floating colored cursor tags. |
| `board:clear` | Client → Server | `{ boardId }` | Triggers a room-wide canvas wipe. |
| `board:cleared` | Server → Room | `{ clearedBy }` | Instructs all room clients to clear local canvas surface. |
| `draw:undo` | Client → Server | `{ boardId }` | Pops all stroke segments sharing the most recent `actionId`. |
| `board:sync` | Server → Room | `{ strokes }` | Broadcasts authoritative state snapshot after state rollback/undo. |

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v16+ recommended)
- npm (v8+)

### Installation & Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run in Development Mode** (auto-reload via nodemon):
   ```bash
   npm run dev
   ```

3. **Run in Production Mode**:
   ```bash
   npm start
   ```

4. **Access the Whiteboard**:
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## 🔗 Multi-Tenant Room Partitioning (`?board=<id>`)

The client automatically reads the `?board` query parameter from the URL bar:

- **Default Room**: `http://localhost:5000` (defaults to room `DESIGN_101`)
- **Custom Room**: `http://localhost:5000?board=demo`
- **Team Brainstorming Room**: `http://localhost:5000?board=sprint-planning`

Participants on the same `board` query parameter will draw, undo, clear, and view cursors together in real time.

---

## 🧪 Testing & Verification Checklist

- [x] **Server Bootstrap**: Server starts cleanly on port `5000` (or `process.env.PORT`).
- [x] **Real-Time Vector Sync**: Drawing in Window 1 immediately renders in Window 2 with zero perceived latency.
- [x] **Live Peer Cursors**: Moving pointer in Window 1 renders a colored floating tag with username in Window 2.
- [x] **Instant Catch-up Sync**: Opening a 3rd incognito window loads all prior room strokes via `board:init`.
- [x] **Full Continuous Undo**: Clicking "Undo" removes the last full continuous pen stroke (all segments matching `actionId`), not just a single tiny dot.
- [x] **Synchronized Clear**: Clicking "Clear Canvas" resets the canvas surface for all connected clients simultaneously.

---

## 🌐 Deploying to Render.com

1. Push your repository to GitHub.
2. Log into [Render.com](https://render.com/) and click **New + → Web Service**.
3. Connect your GitHub repository.
4. Set the following build options:
   - **Root Directory**: `Janmesh_Rohida`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**. WebSockets are supported natively on Render's free tier.

Deployment Link - https://assignment-11-collaborative-whiteboard-ezyy.onrender.com
