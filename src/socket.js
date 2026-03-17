const { Server } = require("socket.io");
const { isOriginAllowed } = require("./config/cors");

let io;
let totalConnections = 0;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        totalConnections++;
        console.log(`✅ [SOCKET] User connected: ${socket.id} (Total: ${totalConnections})`);

        // Drivers join a room based on their town to receive local requests
        socket.on("join_user_room", (userId) => {
            socket.join(userId);
            console.log(`🚪 [SOCKET] User ${userId} joined their private room`);
        });

        // Join a specific trip room for real-time tracking
        socket.on("join_trip", (tripId) => {
            socket.join(tripId);
            console.log(`🚗 [SOCKET] User joined trip room: ${tripId}`);
        });

        socket.on("leave_trip", (tripId) => {
            socket.leave(tripId);
            console.log(`🚪 [SOCKET] User left trip room: ${tripId}`);
        });

        // Handle driver location updates
        socket.on("driver_location_update", (data) => {
            const { tripId, latitude, longitude, speed, heading } = data;
            // Broadcast to everyone in the trip room (the parent)
            io.to(tripId).emit("location_update", {
                tripId,
                latitude,
                longitude,
                speed,
                heading,
                timestamp: new Date().toISOString()
            });
        });

        socket.on("disconnect", () => {
            totalConnections = Math.max(0, totalConnections - 1);
            console.log(`🔌 [SOCKET] User disconnected: ${socket.id} (Total: ${totalConnections})`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

const getConnectionStats = () => {
    return {
        totalConnections,
        enabled: !!io
    };
};

module.exports = {
    initSocket,
    getIO,
    getConnectionStats
};
