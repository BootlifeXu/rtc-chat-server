const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

let clients = [];

// Add before wss.on("connection")
wss.on("connection", (ws, req) => {
  console.log("New WebSocket connection from:", req.socket.remoteAddress);
  clients.push(ws);
  // ... rest of your code
});
wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("message", (message) => {
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
});
