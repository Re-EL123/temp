let io;

exports.initSocket = (server) => {
  const socketIO = require("socket.io")(server, {
    cors: { origin: "*" }
  });

  io = socketIO;

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on("joinTrip", (tripId) => {
      socket.join(tripId);
      console.log(`Socket joined trip ${tripId}`);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
