const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

let clients = [];

// Single connection handler with proper logging
wss.on("connection", (ws, req) => {
  console.log("New WebSocket connection from:", req.socket.remoteAddress);
  console.log("Total clients:", clients.length + 1);
  
  clients.push(ws);

  ws.on("message", (message) => {
    console.log("Received message, broadcasting to", clients.length - 1, "other clients");
    
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    clients = clients.filter((client) => client !== ws);
    console.log("Total clients:", clients.length);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // Send a welcome message to confirm connection
  ws.send(JSON.stringify({ 
    type: "system", 
    message: "Connected to signaling server" 
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
  console.log("WebSocket server ready for connections");
});
