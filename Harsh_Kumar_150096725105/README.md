# 🎨 Real-Time Collaborative Whiteboard

A high-performance Real-Time Collaborative Multi-User Whiteboard Application using Node.js, Express.js, and Socket.io.

## 👨‍🎓 Student Details

**Name:** Harsh Kumar  
**Roll No.:** 150096725105  
**Course:** BTech CSE  
**Assignment:** 11 — Real-Time Collaborative Whiteboard & Canvas (Socket.io)  

## ✨ Features

- **Real-Time Drawing:** Synchronize continuous vector stroke streams across multiple clients using Socket.io.
- **Stroke History:** Maintains an in-memory stroke history buffer per room so new joiners immediately sync the existing drawing state.
- **Collaborative Cursors:** Broadcasts cursor coordinate deltas to display live collaborator cursors in real time.
- **Whiteboard Rooms:** Manages multi-tenant whiteboard rooms (`roomId`) for isolated collaborative sessions.
- **Canvas Actions:** Coordinated canvas actions such as `clear` and `undo`.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **WebSockets:** Socket.io
- **Frontend:** HTML5 Canvas API, CSS, JavaScript (Vanilla)
- **Utilities:** cors, dotenv

## 📁 Project Structure

```text
Harsh-Assignment-11-Collaborative-Whiteboard/
├── public/
│   ├── index.html           # Full HTML5 Canvas collaborative interface
│   ├── canvas.js            # Client-side drawing & socket event emitter
│   └── styles.css           # Toolbars, color pickers & canvas layout
├── sockets/
│   ├── boardHandler.js      # Room join, stroke caching & canvas reset handlers
│   └── cursorHandler.js     # Live cursor coordinate streaming
├── .env.example
├── .gitignore
├── package.json
└── server.js                # Express & Socket.io server bootstrap
```

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your machine

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/harsh4421/Harsh-Assignment-11-Collaborative-Whiteboard.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Harsh-Assignment-11-Collaborative-Whiteboard
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file (optional, defaults to port 5000):
   ```env
   PORT=5000
   ```

5. Start the server:
   ```bash
   npm start
   ```

   For development with nodemon:
   ```bash
   npm run dev
   ```

6. Open your browser to `http://localhost:5000`. You can test collaboration by opening multiple tabs (use `http://localhost:5000?board=demo` to explicitly join the same board).
