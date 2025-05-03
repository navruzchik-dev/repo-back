const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomId: { clients: [ws1, ws2], started: false } }

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'join') {
        const { roomId } = data;
        if (!rooms[roomId]) {
          rooms[roomId] = { clients: [], started: false };
        }
        rooms[roomId].clients.push(ws);
        ws.roomId = roomId;

        // Notify all clients in the room about the updated user count
        rooms[roomId].clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'user-joined', users: rooms[roomId].clients.length }));
          }
        });
      }

      if (data.type === 'typing') {
        const roomClients = rooms[ws.roomId]?.clients || [];
        roomClients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'opponent-typing', content: data.content }));
          }
        });
      }

      if (data.type === 'start-game') {
        const room = rooms[ws.roomId];
        if (room && !room.started && room.clients.length === 2) {
          room.started = true;
          room.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'game-start' }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].clients = rooms[roomId].clients.filter((client) => client !== ws);
      // Notify remaining clients about the updated user count
      rooms[roomId].clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'user-joined', users: rooms[roomId].clients.length }));
        }
      });
      if (rooms[roomId].clients.length === 0) {
        delete rooms[roomId];
      } else {
        rooms[roomId].started = false; // Reset game state if a player leaves
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(4000, () => {
  console.log('🚀 Server running on http://localhost:4000');
});