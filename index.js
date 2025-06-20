const express = require("express");
const http = require("http");
const WebSocket = require("ws");

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);

// Configure CORS for cross-origin requests
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://your-netlify-site.netlify.app', // Replace with your actual Netlify URL
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

let clients = [];

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    clients: clients.length,
    service: 'WebRTC Chat Server'
  });
});

// Add WebSocket upgrade handling to main server for /ws path
app.get('/ws', (req, res) => {
  res.status(426).json({ 
    error: 'Upgrade Required', 
    message: 'This endpoint requires WebSocket upgrade' 
  });
});

// Add root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WebRTC Chat Server',
    websocket: '/ws',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// Create WebSocket server with manual upgrade handling
const wss = new WebSocket.WebSocketServer({ 
  noServer: true,
  perMessageDeflate: false,
  maxPayload: 16 * 1024 * 1024, // 16MB max payload
});

// Handle WebSocket upgrade on the main server
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname === '/ws') {
    // Verify origin
    const origin = request.headers.origin;
    console.log('WebSocket upgrade request from origin:', origin);
    
    const allowedOrigins = [
      'https://your-netlify-site.netlify.app', // Replace with your actual Netlify URL
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000'
    ];
    
    const isAllowed = !origin || allowedOrigins.some(allowed => 
      origin.includes(allowed.replace('https://', '').replace('http://', ''))
    ) || origin.includes('netlify.app') || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('railway.app');

    if (isAllowed) {
      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit('connection', websocket, request);
      });
    } else {
      console.log('WebSocket connection rejected for origin:', origin);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  try {
    const clientIP = req.socket.remoteAddress || 'unknown';
    const origin = req.headers.origin || 'unknown';
    console.log(`🔗 New WebSocket connection from: ${clientIP}, Origin: ${origin}`);
    
    clients.push(ws);
    console.log(`👥 Total clients: ${clients.length}`);

    // Send welcome message
    ws.send(JSON.stringify({ 
      type: "system", 
      message: "Connected to signaling server",
      timestamp: new Date().toISOString()
    }));

    ws.on("message", (message) => {
      try {
        console.log(`📨 Received message, broadcasting to ${clients.length - 1} other clients`);
        
        // Broadcast to all other clients
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      } catch (error) {
        console.error('❌ Error broadcasting message:', error);
      }
    });

    ws.on("close", (code, reason) => {
      try {
        console.log(`🔌 Client disconnected. Code: ${code}, Reason: ${reason}`);
        clients = clients.filter((client) => client !== ws);
        console.log(`👥 Total clients: ${clients.length}`);
      } catch (error) {
        console.error('❌ Error handling client disconnect:', error);
      }
    });

    ws.on("error", (error) => {
      console.error('❌ WebSocket client error:', error);
      clients = clients.filter((client) => client !== ws);
    });

  } catch (error) {
    console.error('❌ Error in connection handler:', error);
  }
});

wss.on("error", (error) => {
  console.error('❌ WebSocket server error:', error);
});

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Start server with error handling
server.listen(PORT, '0.0.0.0', (error) => {
  if (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
