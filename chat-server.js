const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = process.env.CHAT_PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

// Store active users
const users = new Map();

// Generate token endpoint
app.post('/api/chat/token', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io event handlers
io.on('connection', (socket) => {
  const username = socket.username;
  users.set(socket.id, { username, joinedAt: new Date() });
  
  console.log(`${username} connected`);
  
  // Notify all clients of new user
  io.emit('user:joined', {
    username,
    userCount: users.size,
    users: Array.from(users.values()).map(u => u.username)
  });

  // User list update
  socket.emit('users:list', {
    users: Array.from(users.values()).map(u => u.username)
  });

  // Handle chat messages
  socket.on('message:send', (data) => {
    io.emit('message:receive', {
      username,
      content: data.content,
      timestamp: new Date().toISOString()
    });
  });

  // Handle editor updates
  socket.on('editor:update', (data) => {
    socket.broadcast.emit('editor:update', {
      username,
      content: data.content,
      cursor: data.cursor
    });
  });

  // Handle typing indicator
  socket.on('typing:start', () => {
    socket.broadcast.emit('typing:indicator', { username, typing: true });
  });

  socket.on('typing:stop', () => {
    socket.broadcast.emit('typing:indicator', { username, typing: false });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    users.delete(socket.id);
    console.log(`${username} disconnected`);
    
    io.emit('user:left', {
      username,
      userCount: users.size,
      users: Array.from(users.values()).map(u => u.username)
    });
  });

  socket.on('error', (error) => {
    console.error(`Socket error for ${username}:`, error);
  });
});

server.listen(PORT, () => {
  console.log(`Chat editor server running on http://localhost:${PORT}`);
});
