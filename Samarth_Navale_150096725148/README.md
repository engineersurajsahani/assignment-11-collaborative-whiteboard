# 🎨 Real-Time Collaborative Whiteboard & Canvas (Assignment 11)

🚀 **Live Deployment Links:**
- **Render:** [https://samarth-assignment-11-collaborative-whiteboard.onrender.com](https://samarth-assignment-11-collaborative-whiteboard.onrender.com)
- **Vercel:** [https://samarth-assignment-11-whiteboard.vercel.app](https://samarth-assignment-11-whiteboard.vercel.app)

---

- **Name:** Samarth Navale
- **Roll No:** 150096725148
- **Cohort:** Sam Altman

---

A high-performance **Real-Time Collaborative Multi-User Whiteboard Application** built using **Node.js, Express.js, Socket.io, and HTML5 Canvas**. Features live continuous vector stroke synchronization, room partitioning, collaborator cursor coordinate streaming, and coordinated canvas actions (`undo`, `clear`).

---

## 🚀 Features

- 🔄 **Multi-Tenant Room Partitioning**: Create and join distinct canvas rooms using `boardId`.
- ✏️ **Real-Time Stroke Streaming**: High-frequency vector stroke synchronization with stroke history buffering for newly joined peers.
- 🖱️ **Collaborator Pointer Tracking**: Live broadcast of collaborator mouse coordinates and user badges.
- ↩️ **Global Undo & Wipe Actions**: Coordinated canvas reset and stroke rollback across all room participants.
- 🎨 **Minimalistic Canvas Interface**: Lightweight toolbar with brush size, custom color picker, and active user count.

---

## 🛠️ Tech Stack & Dependencies

- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-Time Protocol:** Socket.io & WebSockets
- **Frontend UI:** Vanilla HTML5 Canvas & JavaScript

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
```

---

## 🧪 Testing

```bash
npm install
npm test
```
