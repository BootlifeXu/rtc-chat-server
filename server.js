const ws = new WebSocket("wss://rtc-chat-server-production.up.railway.app");
let peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});
let dataChannel;
let isInitiator = false;

// Add WebSocket connection debugging
ws.onopen = () => {
  console.log("WebSocket connected");
  appendMessage("System", "Connected to signaling server", false);
};

ws.onclose = (event) => {
  console.log("WebSocket closed:", event.code, event.reason);
  appendMessage("System", `Connection closed: ${event.code}`, false);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
  appendMessage("System", "Connection error - check console", false);
};

ws.onmessage = async ({ data }) => {
  console.log("Received signaling message:", data);
  try {
    const msg = JSON.parse(data);
    
    if (msg.offer) {
      console.log("Received offer");
      await peer.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      ws.send(JSON.stringify({ answer }));
      appendMessage("System", "Sent answer", false);
    } else if (msg.answer) {
      console.log("Received answer");
      await peer.setRemoteDescription(new RTCSessionDescription(msg.answer));
      appendMessage("System", "Received answer", false);
    } else if (msg.ice) {
      console.log("Received ICE candidate");
      await peer.addIceCandidate(new RTCIceCandidate(msg.ice));
    }
  } catch (error) {
    console.error("Error processing signaling message:", error);
  }
};

// Add peer connection event handlers
peer.onicecandidate = ({ candidate }) => {
  if (candidate) {
    console.log("Sending ICE candidate");
    ws.send(JSON.stringify({ ice: candidate }));
  }
};

peer.onconnectionstatechange = () => {
  console.log("Connection state:", peer.connectionState);
  appendMessage("System", `Connection: ${peer.connectionState}`, false);
};

peer.ondatachannel = (event) => {
  console.log("Received data channel");
  dataChannel = event.channel;
  setupDataChannel();
  appendMessage("System", "Data channel received", false);
};

// Auto-start as initiator after a short delay to allow multiple clients to connect
setTimeout(() => {
  if (!isInitiator && peer.connectionState === "new") {
    console.log("Starting as initiator");
    start();
  }
}, 2000);

async function start() {
  try {
    isInitiator = true;
    console.log("Creating data channel and offer");
    dataChannel = peer.createDataChannel("chat");
    setupDataChannel();
    
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.send(JSON.stringify({ offer }));
    appendMessage("System", "Sent offer", false);
  } catch (error) {
    console.error("Error starting peer connection:", error);
    appendMessage("System", "Error starting connection", false);
  }
}

function setupDataChannel() {
  if (!dataChannel) return;
  
  dataChannel.onopen = () => {
    console.log("Data channel opened");
    appendMessage("System", "✅ Peer-to-peer connection established!", false);
  };
  
  dataChannel.onclose = () => {
    console.log("Data channel closed");
    appendMessage("System", "Data channel closed", false);
  };
  
  dataChannel.onerror = (error) => {
    console.error("Data channel error:", error);
    appendMessage("System", "Data channel error", false);
  };
  
  dataChannel.onmessage = ({ data }) => {
    console.log("Received data:", typeof data, data);
    
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "message") {
          appendMessage("Peer", parsed.plainText, true);
        }
      } catch {
        appendMessage("Peer", data, true);
      }
    } else {
      // Handle file data
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      appendMessage("Peer", `📁 <a href="${url}" download="file">Download file</a>`, true);
    }
  };
}

function sendMessage() {
  const input = document.getElementById("message");
  const plainText = input.value.trim();
  if (!plainText) return;
  
  if (!dataChannel || dataChannel.readyState !== "open") {
    appendMessage("System", "❌ Not connected to peer", false);
    return;
  }

  const md5 = CryptoJS.MD5(plainText).toString();
  const message = {
    type: "message",
    md5,
    plainText
  };

  try {
    dataChannel.send(JSON.stringify(message));
    appendMessage("You", plainText, true); // Show actual message, not MD5
    input.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    appendMessage("System", "Failed to send message", false);
  }
}

function sendFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  
  if (!file) {
    appendMessage("System", "Please select a file", false);
    return;
  }
  
  if (!dataChannel || dataChannel.readyState !== "open") {
    appendMessage("System", "❌ Not connected to peer", false);
    return;
  }

  try {
    dataChannel.send(file);
    appendMessage("You", `📁 File sent: ${file.name}`, true);
    fileInput.value = ""; // Clear file input
  } catch (error) {
    console.error("Error sending file:", error);
    appendMessage("System", "Failed to send file", false);
  }
}

function appendMessage(sender, text, autoDelete = false) {
  const chat = document.getElementById("chat");
  const p = document.createElement("p");
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;

  if (autoDelete) {
    setTimeout(() => {
      if (p.parentNode) {
        p.remove();
      }
    }, 2 * 60 * 1000); // 2 minutes
  }
}

// Allow manual connection attempt
function manualConnect() {
  if (peer.connectionState === "new" || peer.connectionState === "closed") {
    start();
  }
}

// Add button to HTML for manual connection
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.createElement("button");
  connectBtn.textContent = "Manual Connect";
  connectBtn.onclick = manualConnect;
  document.body.appendChild(connectBtn);
});

// Add Enter key support for message input
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message");
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
});
