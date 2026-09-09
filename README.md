# Assignment 11 - Real-Time Collaborative Whiteboard & Canvas
https://saiyashpoojariassignment-11.onrender.com (Render URL)
## Overview

A real-time collaborative multi-user whiteboard application built using Node.js, Express.js, Socket.io and HTML5 Canvas.

The application allows multiple users to join shared whiteboard rooms, draw simultaneously, synchronize drawing strokes in real time, view collaborator cursors and perform coordinated canvas actions.

## Features

- Real-time multi-user collaboration
- Socket.io real-time communication
- Multiple independent whiteboard rooms
- Room-based board state management
- Real-time drawing synchronization
- In-memory drawing stroke history
- Board history synchronization for new users
- Live collaborator cursor tracking
- Active user tracking
- Clear canvas functionality
- Undo functionality
- Responsive canvas interface
- Username and user color support
- Express.js server
- CORS configuration
- Environment variable configuration

## Tech Stack

- Node.js
- Express.js
- Socket.io
- HTML5 Canvas API
- JavaScript
- CSS
- CORS
- dotenv

## Real-Time Events

### Room Events

```text
board:join
board:init
user:joined
user:left
