// server.js - FULLY FIXED WITH BOTH /api/user AND /api/users SUPPORT + SOCKET.IO
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");

const connectDB = require("./src/config/db");
const { initSocket, getConnectionStats } = require("./src/socket");

// Load env variables early
dotenv.config();

const app = express();

// Enable proxy (important for production & tracking)
app.enable("trust proxy");

// Request logging - CONSOLIDATED (removed duplicate)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') {
    console.log(`   CORS Preflight: ${req.headers.origin || 'no origin'}`);
  }
  next();
});

// CORS Configuration - SIMPLIFIED (removed duplicate preflight)
const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
connectDB()
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ============================
// ROUTES - BOTH PATHS SUPPORTED ✅
// ============================
const authRoutes = require("./src/routes/authRoutes");
const protectedRoutes = require("./src/routes/protectedRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const tripRoutes = require("./src/routes/tripRoutes");
const userRoutes = require('./src/routes/userRoutes');

// ✅ BOTH PATHS NOW WORK - NO BREAKAGE!
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trips", tripRoutes);

// 🎉 SUPPORTS BOTH /api/user/* AND /api/users/* - EVERYTHING PRESERVED
app.use("/api/user", userRoutes);   // ✅ Your existing routes
app.use("/api/users", userRoutes);  // ✅ Frontend calls
app.use("/api/drivers/available", userRoutes); // ✅ Frontend drivers/available

// Commented routes preserved
/*
const paymentRoutes = require("./src/routes/paymentRoutes");
const withdrawalRoute = require("./src/routes/withdrawalRoute");
app.use("/api/payments", paymentRoutes);
app.use("/api/withdrawals", withdrawalRoute);
*/

// ============================
// HEALTH & TEST ROUTES - UPDATED
// ============================
app.get("/", (req, res) => {
  const stats = getConnectionStats();
  res.json({ 
    message: "Safe School Ride API 🚀", 
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    socketIO: {
      enabled: true,
      endpoint: "/socket.io",
      ...(stats && { connections: stats.totalConnections })
    },
    routes: {
      auth: "/api/auth",
      users: ["/api/user", "/api/users"],  // ✅ Both supported
      trips: "/api/trips",
      admin: "/api/admin"
    }
  });
});

app.get("/ping", (req, res) => {
  res.json({ 
    message: "pong", 
    timestamp: new Date().toISOString(),
    status: "healthy",
    uptime: process.uptime()
  });
});

// Socket.IO status endpoint
app.get("/socket/status", (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    socketIO: stats || { enabled: true, connections: 0 },
    timestamp: new Date().toISOString()
  });
});

// ============================
// ERROR HANDLERS - IMPROVED
// ============================
// 404 Not Found Handler
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false,
    message: "Route not found",
    path: req.url,
    method: req.method,
    available: {
      users: ["/api/user", "/api/users"],
      drivers: ["/api/users/drivers/available", "/api/user/drivers/available"],
      profile: ["/api/user/profile", "/api/users/profile"],
      socket: "/socket.io/"
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`❌ Server Error:`, {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// ============================
// SOCKET.IO + SERVER START
// ============================
const PORT = process.env.PORT || 3000;

// Create HTTP server (required for Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Log Socket.IO initialization
console.log("📡 Socket.IO server ready at /socket.io/");

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Socket.IO endpoint: ws://0.0.0.0:${PORT}/socket.io/`);
  console.log(`\n📍 Available routes:`);
  console.log(`   👉 /api/auth/*`);
  console.log(`   👉 /api/user/*    ← Your existing routes ✅`);
  console.log(`   👉 /api/users/*   ← Frontend calls ✅`);
  console.log(`   👉 /api/users/drivers/available`);
  console.log(`   👉 /api/user/drivers/available`);
  console.log(`   👉 /api/trips/*`);
  console.log(`   👉 /api/admin/*`);
  console.log(`   👉 /socket.io/    ← WebSocket endpoint 🔌\n`);
});

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ HTTP server closed');
    io.close(() => {
      console.log('✅ Socket.IO closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ HTTP server closed');
    io.close(() => {
      console.log('✅ Socket.IO closed');
      process.exit(0);
    });
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for Vercel serverless
module.exports = app;
