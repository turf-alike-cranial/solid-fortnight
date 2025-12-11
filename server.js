const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Middleware to verify JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Generate token endpoint
app.post('/api/token', (req, res) => {
  const token = jwt.sign({ user: 'client' }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
  
  if (!verifyToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'Live preview connected' }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received:', message);
      
      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'update',
            data: message.content,
            timestamp: new Date().toISOString()
          }));
        }
      });
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
});
