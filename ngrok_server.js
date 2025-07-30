const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ngrok = require('ngrok');
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

// 🚀 Start Server and ngrok tunnel
const PORT = process.env.PORT || 3000;
console.log('Environment PORT value:', process.env.PORT);

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  try {
    console.log('🔑 Attempting to start ngrok tunnel...');
    console.log('⚠️  Note: ngrok requires authentication to work properly.');
    console.log('📝 To authenticate ngrok:');
    console.log('   1. Create an account at https://ngrok.com');
    console.log('   2. Get your authtoken from the ngrok dashboard');
    console.log('   3. Run: npx ngrok authtoken YOUR_AUTH_TOKEN');
    console.log('   4. Restart this server');
    
    // Try to upgrade ngrok config if needed
    try {
      console.log('🔄 Attempting to upgrade ngrok configuration...');
      await ngrok.upgradeConfig({ relocate: true });
      console.log('✅ ngrok configuration upgraded successfully');
    } catch (configErr) {
      console.log('⚠️ Could not upgrade ngrok configuration:', configErr.message);
      console.log('⚠️ This is not critical, continuing with tunnel setup...');
    }
    
    // Start ngrok tunnel with specific configuration for v5 beta
    // This will only work if ngrok is authenticated
    const authtoken = process.env.NGROK_AUTHTOKEN || '30C3suTQeNoWn9Y5tNAWBTd9GQh_AdnyXxpF7krWyMtFR4m4';
    
    // Using the correct API for ngrok v5 beta
    // According to npm docs, we should use connect() not forward()
    const url = await ngrok.connect({
      proto: 'http',
      addr: PORT,
      authtoken: authtoken,
      subdomain: process.env.NGROK_SUBDOMAIN, // Optional: if you have a reserved subdomain
      onStatusChange: (status) => {
        console.log(`🔔 ngrok tunnel status changed to: ${status}`);
      },
      onLogEvent: (data) => {
        console.log(`📋 ngrok log: ${data}`);
      }
    });
    
    console.log(`🌍 ngrok tunnel established at: ${url}`);
    console.log(`🔌 Socket.IO clients should connect to: ${url}`);
  } catch (err) {
    console.error('❌ ngrok tunnel failed to start');
    
    if (err.message && err.message.includes('authtoken')) {
      console.error('🔑 Authentication error: Please authenticate ngrok first');
    } else if (err.message && err.message.includes('too old')) {
      console.error('🔄 Version error: Your ngrok version is too old. Please update ngrok.');
      console.error('   Run: npm install ngrok@latest');
    } else {
      console.error('Error details:', err.message || err);
    }
    
    console.log('🔄 Server will continue running without ngrok tunnel');
    console.log('💡 Tip: You can still access the server locally at http://localhost:' + PORT);
  }
});

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down server and ngrok tunnel...');
  await ngrok.disconnect(); // This will disconnect all tunnels
  process.exit(0);
});