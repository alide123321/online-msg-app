const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const db = require("quick.db");
var allmsgs = new db.table("allmsgs");

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const botName = "Chat mod";

// Run when client connects
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to the Chat!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));

    if (user.username === botName) {
      return;
    }

    if (msg === ".logs") {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, allmsgs.get(`allmsgs_${user.room}`))
      );
      return;
    }

    //save new msgs
    if (!allmsgs.has(`allmsgs_${user.room}`)) {
      allmsgs.set(`allmsgs_${user.room}`, `${user.username} sent: ${msg} \n`);
      return;
    }

    var msgs = allmsgs.get(`allmsgs_${user.room}`);
    allmsgs.delete(`allmsgs_${user.room}`);

     msgs = msgs.concat(`\n ${user.username} sent: ${msg} \n`);

    allmsgs.set(`allmsgs_${user.room}`, msgs);
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
