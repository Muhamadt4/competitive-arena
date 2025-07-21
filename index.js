const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const setupGameSocket = require('./sockets/gameSocket');
const { handleError } = require('./utils/errorHandler');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8
});

// Add debug logging for Socket.IO server
console.log('Socket.IO server configured with transports:', io.engine.opts.transports);
console.log('Socket.IO server version:', require('socket.io').version);

// Add more detailed engine logging
io.engine.on('connection', (socket) => {
  console.log(`Engine connection established: ${socket.id}`);
  console.log(`Transport used: ${socket.transport.name}`);
});

io.engine.on('connection_error', (err) => {
  console.error('Engine connection error:', err.code, err.message, err.context);
});

// 🛠 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🎮 Socket.IO Game Logic
setupGameSocket(io);

// 🧪 Health Check Route
app.get('/', (req, res) => {
  res.send('🎮 Competitive Quiz Game Server is Running!');
});

// 🛡️ Error Handler (must be last middleware)
app.use((err, req, res, next) => {
  handleError(err, res);
});

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
console.log('Environment PORT value:', process.env.PORT);
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});