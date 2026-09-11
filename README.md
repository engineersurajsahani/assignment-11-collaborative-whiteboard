# 🎨 CollabBoard — Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard application that allows multiple users to draw, interact, and collaborate on the same canvas simultaneously.

Built with **Node.js, Express.js, Socket.io, and HTML5 Canvas**.

---

## 🚀 Live Demo

🌐 **https://itm-assignment-11-whiteboard-socket.onrender.com/**

Open a specific collaborative board by adding a board ID to the URL.

**Example:**  
https://itm-assignment-11-whiteboard-socket.onrender.com/?board=demo

Users who open the same board ID can collaborate in real time, while different board IDs maintain separate whiteboards.

---

## ✨ Features

### 🖌️ Real-Time Drawing

Draw on the canvas and see strokes appear instantly for everyone connected to the same board.

### 👥 Multi-User Collaboration

Multiple users can work on the same whiteboard simultaneously.

Each collaborator is identified by their username and a unique color.

### 🖱️ Live Collaborator Cursors

See where other users are currently pointing on the canvas with real-time cursor tracking.

### 🏠 Multiple Whiteboard Rooms

Every whiteboard is identified using a unique board ID.

Examples:

Board: design  
Board: project  
Board: demo

Each room maintains its own independent drawing state.

### 🔄 Drawing History Synchronization

The server maintains the drawing history for each board in memory.

When a new user joins an existing board, the previous drawing is automatically synchronized to their canvas.

### ↩️ Undo

Undo removes the most recent complete continuous drawing action rather than removing only a single line segment.

The updated board state is synchronized with all connected users.

### 🗑️ Clear Canvas

Clear the current board for everyone connected to that room.

### 📡 Real-Time Communication

Socket.io handles communication between clients and the server for drawing, cursor movement, room activity, undo, and clear operations.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | Web server |
| Socket.io | Real-time communication |
| HTML5 Canvas | Drawing interface |
| JavaScript | Client-side interaction |
| CSS | User interface and responsive styling |
| CORS | Cross-origin support |
| dotenv | Environment configuration |

---

## 📁 Project Structure

assignment-11-whiteboard-socket/

├── public/

│   ├── index.html

│   ├── canvas.js

│   └── styles.css

├── sockets/

│   ├── boardHandler.js

│   └── cursorHandler.js

├── server.js

├── package.json

├── .env

├── .gitignore

└── README.md

---

## ⚙️ Getting Started

### 1. Clone the Repository

git clone https://github.com/pallavi-676/itm-assignment-11-whiteboard-socket.git

### 2. Open the Project

cd assignment-11-whiteboard-socket

### 3. Install Dependencies

npm install

### 4. Configure Environment

Create a .env file in the project root.

PORT=5000

### 5. Start the Server

npm start

The application will run at:

http://localhost:5000

---

## 🧪 Testing Real-Time Collaboration

### Step 1 — Open the Board

Open:

http://localhost:5000/?board=demo

### Step 2 — Open a Second Window

Open the same URL in another browser window or tab.

### Step 3 — Join

Enter different usernames in each window.

### Step 4 — Draw

Draw something in the first window.

The drawing should appear in the second window in real time.

### Step 5 — Test Collaborator Cursor

Move the mouse around the canvas.

The collaborator cursor should appear in the other window.

### Step 6 — Test Undo

Create multiple continuous strokes and use the Undo button.

The most recent complete stroke should be removed and the updated state should appear for all connected users.

### Step 7 — Test Clear

Use the Clear Canvas button.

The canvas should be cleared for every user connected to that board.

### Step 8 — Test History Synchronization

Open another browser window using the same board URL.

Previously created drawings should automatically appear for the new user.

---

## 🔌 Socket.io Event Flow

### Room & Session Events

board:join  
board:init  
user:joined  
user:left

### Drawing Events

draw:stroke  
draw:broadcast

### Cursor Tracking Events

cursor:move  
cursor:update

### Board Action Events

board:clear  
board:cleared  
draw:undo  
board:sync

---

## 🧠 How It Works

The application uses Socket.io rooms to separate collaborative boards.

When a user joins a board, the server adds their socket to the corresponding room and sends the current board state.

Drawing actions are sent from the client to the server and then broadcast to other users in the same room.

The server maintains an in-memory history of drawing actions. This allows newly connected users to receive the existing canvas state.

Cursor movement is transmitted separately so collaborators can see each other's positions in real time.

Undo updates the shared board history and broadcasts the new state to all users in the room.

Clear removes the drawing history for the current board and synchronizes the cleared state with connected clients.

---

## 📌 Assignment Requirements Covered

✅ Socket.io connection  
✅ Multi-room whiteboard management  
✅ Real-time drawing synchronization  
✅ In-memory drawing history  
✅ New-user board synchronization  
✅ Live collaborator cursor tracking  
✅ Undo functionality  
✅ Clear Canvas functionality  
✅ Responsive canvas interface  
✅ Organized client and server-side code  

---

## 👩‍💻 Author

**Pallavi Sarovar**

ITM — Assignment 11  
Real-Time Collaborative Whiteboard & Canvas
