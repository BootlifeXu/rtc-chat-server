const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

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

// Initialize WebSocket server with error handling
let wss;
try {
  wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
    maxPayload: 16 * 1024 * 1024 // 16MB max payload
  });
  console.log('✅ WebSocket server initialized');
} catch (error) {
  console.error('❌ Failed to initialize WebSocket server:', error);
  process.exit(1);
}

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Add basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    clients: clients.length 
  });
});

// Add root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let clients = [];

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  try {
    const clientIP = req.socket.remoteAddress || 'unknown';
    console.log(`🔗 New WebSocket connection from: ${clientIP}`);
    
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
      // Remove client from array if error occurs
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
  console.log(`🔗 WebSocket server ready for connections`);
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
