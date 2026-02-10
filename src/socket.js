// src/socket.js - Socket.IO Configuration for Real-Time Notifications
const { Server } = require("socket.io");

let io;

/**
 * Initialize Socket.IO with HTTP server
 * @param {Object} server - HTTP server instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true, // Allow Engine.IO v3 clients
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6, // 1MB
  });

  io.on("connection", (socket) => {
    console.log(`✅ [Socket.IO] Client connected: ${socket.id}`);
    console.log(`   Transport: ${socket.conn.transport.name}`);
    console.log(`   Total connections: ${io.engine.clientsCount}`);

    // ============================
    // USER AUTHENTICATION
    // ============================
    
    // Join user-specific room for targeted notifications
    socket.on("join_user_room", (userId) => {
      if (userId) {
        socket.join(userId.toString());
        console.log(`👤 [Socket.IO] User ${userId} joined room ${userId}`);
        socket.emit("room_joined", { userId, roomId: userId });
      }
    });

    // ============================
    // TRIP TRACKING
    // ============================

    // Join trip-specific room for real-time tracking
    socket.on("join_trip", (tripId) => {
      if (tripId) {
        socket.join(`trip_${tripId}`);
        console.log(`🚗 [Socket.IO] Socket ${socket.id} joined trip room: trip_${tripId}`);
        socket.emit("trip_joined", { tripId });
      }
    });

    // Leave trip room
    socket.on("leave_trip", (tripId) => {
      if (tripId) {
        socket.leave(`trip_${tripId}`);
        console.log(`🚪 [Socket.IO] Socket ${socket.id} left trip room: trip_${tripId}`);
      }
    });

    // Driver location update during trip
    socket.on("driver_location_update", (data) => {
      const { tripId, latitude, longitude, speed, heading } = data;
      
      if (tripId && latitude && longitude) {
        // Broadcast to all users in the trip room (parent tracking)
        io.to(`trip_${tripId}`).emit("location_update", {
          tripId,
          location: {
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            timestamp: new Date().toISOString(),
          },
        });
        
        console.log(`📍 [Socket.IO] Location update for trip ${tripId}: (${latitude}, ${longitude})`);
      }
    });

    // ============================
    // TRIP STATUS UPDATES
    // ============================

    // Trip accepted by driver
    socket.on("trip_accepted", (data) => {
      const { tripId, parentId, driverName } = data;
      
      if (parentId) {
        io.to(parentId.toString()).emit("trip_accepted", {
          tripId,
          driverName,
          message: `${driverName} has accepted your trip request`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`✅ [Socket.IO] Trip ${tripId} accepted notification sent to parent ${parentId}`);
      }
    });

    // Trip declined by driver
    socket.on("trip_declined", (data) => {
      const { tripId, parentId, driverName, reason } = data;
      
      if (parentId) {
        io.to(parentId.toString()).emit("trip_declined", {
          tripId,
          driverName,
          reason: reason || "Driver declined",
          message: `${driverName} has declined your trip request`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`❌ [Socket.IO] Trip ${tripId} declined notification sent to parent ${parentId}`);
      }
    });

    // Trip started by driver
    socket.on("trip_started", (data) => {
      const { tripId, parentId, driverName, currentLocation } = data;
      
      if (parentId) {
        io.to(parentId.toString()).emit("trip_started", {
          tripId,
          driverName,
          currentLocation,
          message: `${driverName} has started your trip`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`🚀 [Socket.IO] Trip ${tripId} started notification sent to parent ${parentId}`);
      }
    });

    // Trip completed by driver
    socket.on("trip_completed", (data) => {
      const { tripId, parentId, driverName, fare } = data;
      
      if (parentId) {
        io.to(parentId.toString()).emit("trip_completed", {
          tripId,
          driverName,
          fare,
          message: `${driverName} has completed your trip`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`🏁 [Socket.IO] Trip ${tripId} completed notification sent to parent ${parentId}`);
      }
    });

    // Trip cancelled
    socket.on("trip_cancelled", (data) => {
      const { tripId, userId, reason, cancelledBy } = data;
      
      if (userId) {
        io.to(userId.toString()).emit("trip_cancelled", {
          tripId,
          reason,
          cancelledBy,
          message: `Trip has been cancelled: ${reason}`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`🚫 [Socket.IO] Trip ${tripId} cancelled notification sent to user ${userId}`);
      }
    });

    // ============================
    // DRIVER NOTIFICATIONS
    // ============================

    // New trip request for driver
    socket.on("new_trip_request", (data) => {
      const { driverId, tripId, parentName, pickupLocation, fare } = data;
      
      if (driverId) {
        io.to(driverId.toString()).emit("new_trip_request", {
          tripId,
          parentName,
          pickupLocation,
          fare,
          message: `New trip request from ${parentName}`,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`📢 [Socket.IO] New trip request ${tripId} sent to driver ${driverId}`);
      }
    });

    // ============================
    // CHAT/MESSAGING (Future Feature)
    // ============================

    socket.on("send_message", (data) => {
      const { tripId, senderId, receiverId, message } = data;
      
      if (receiverId) {
        io.to(receiverId.toString()).emit("receive_message", {
          tripId,
          senderId,
          message,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`💬 [Socket.IO] Message sent from ${senderId} to ${receiverId}`);
      }
    });

    // ============================
    // EMERGENCY ALERTS
    // ============================

    socket.on("emergency_alert", (data) => {
      const { tripId, userId, location, type } = data;
      
      // Broadcast to trip room and admin
      io.to(`trip_${tripId}`).emit("emergency_alert", {
        tripId,
        userId,
        location,
        type: type || "SOS",
        message: "Emergency alert triggered",
        timestamp: new Date().toISOString(),
      });
      
      // Also notify admin room
      io.to("admin").emit("emergency_alert", {
        tripId,
        userId,
        location,
        type: type || "SOS",
        timestamp: new Date().toISOString(),
      });
      
      console.log(`🚨 [Socket.IO] EMERGENCY ALERT for trip ${tripId} from user ${userId}`);
    });

    // ============================
    // HEARTBEAT/PING
    // ============================

    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date().toISOString(),
        serverTime: Date.now(),
      });
    });

    // ============================
    // DISCONNECTION
    // ============================

    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Remaining connections: ${io.engine.clientsCount}`);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`❌ [Socket.IO] Socket error: ${socket.id}`, error);
    });

    // Connection error handling
    socket.conn.on("error", (error) => {
      console.error(`❌ [Socket.IO] Connection error: ${socket.id}`, error);
    });
  });

  // Engine.IO error handling
  io.engine.on("connection_error", (err) => {
    console.error("❌ [Socket.IO] Engine connection error:", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  console.log("✅ Socket.IO initialized successfully");
  console.log(`   Allowed transports: websocket, polling`);
  console.log(`   CORS origin: *`);
  console.log(`   Ping interval: 25s, timeout: 60s`);
  
  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket first.");
  }
  return io;
};

/**
 * Emit event to specific user
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(userId.toString()).emit(event, data);
    console.log(`📤 [Socket.IO] Event '${event}' emitted to user ${userId}`);
  }
};

/**
 * Emit event to specific trip room
 * @param {String} tripId - Trip ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToTrip = (tripId, event, data) => {
  if (io && tripId) {
    io.to(`trip_${tripId}`).emit(event, data);
    console.log(`📤 [Socket.IO] Event '${event}' emitted to trip ${tripId}`);
  }
};

/**
 * Emit event to all connected clients
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`📢 [Socket.IO] Event '${event}' broadcasted to all clients`);
  }
};

/**
 * Get connection statistics
 * @returns {Object} Connection stats
 */
const getConnectionStats = () => {
  if (!io) return null;
  return {
    totalConnections: io.engine.clientsCount,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToTrip,
  emitToAll,
  getConnectionStats,
};
