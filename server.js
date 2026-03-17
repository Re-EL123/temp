/**
 * SafeSchoolRide Backend - server.js
 * Main entry point for the Node.js/Express server.
 * Handles database connection, middleware setup, socket.io integration, and route mounting.
 */

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const http = require("http");

const connectDB = require("./src/config/db");
const { initSocket, getConnectionStats } = require("./src/socket");
const { isOriginAllowed } = require("./src/config/cors");

const app = express();

/**
 * Middlewares & Security Configurations
 */

// Enable 'trust proxy' for secure session handling and tracking behind a load balancer
app.enable("trust proxy");

// Custom logging middleware to track API requests with timestamps
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') {
    console.log(`   CORS Preflight: ${req.headers.origin || 'no origin'}`);
    console.log(`   Headers: ${req.headers['access-control-request-headers']}`);
  }
  next();
});

/**
 * CORS Setup: Configures which origins can access the API.
 * Includes local development paths and the production frontend URL.
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS Denied for origin: ${origin}`);
      // If you are in development, you can temporarily change this to callback(null, true)
      // to allow everything while you debug.
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Parsing incoming JSON and URL-encoded bodies with 10MB limit for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database initialization
connectDB()
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

/**
 * API Route Mounting
 */
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const tripRoutes = require("./src/routes/tripRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const reviewRoutes = require("./src/routes/reviewRoutes");
const userRoutes = require('./src/routes/userRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const childRoutes = require("./src/routes/childRoutes");
const withdrawalRoutes = require("./src/routes/withdrawalRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const protectedRoutes = require("./src/routes/protectedRoutes");

// Core functional routes
app.use("/api/auth", authRoutes);            // Authentication (Login, Register)
app.use("/api/protected", protectedRoutes); // Token verification test route
app.use("/api/admin", adminRoutes);         // Admin dashboard & management
app.use("/api/trips", tripRoutes);         // Trip management (requests, tracking)
app.use("/api/notifications", notificationRoutes); // System notifications
app.use("/api/reviews", reviewRoutes);      // Driver/Ride reviews
app.use("/api/wallet", walletRoutes);       // Parent wallet & transaction history
app.use("/api/payment", paymentRoutes);     // Payment gateway integration (PayFast)
app.use("/api/vouchers", voucherRoutes);   // Voucher system logic
app.use("/api/children", childRoutes);     // Child profiles and linking
app.use("/api/withdrawals", withdrawalRoutes); // Driver withdrawal requests

// User profile routes with legacy support for dual path naming
app.use("/api/user", userRoutes);  // Used by mobile app
app.use("/api/users", userRoutes); // Used by web frontend

/**
 * Status & Monitoring Routes
 */
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
      users: ["/api/user", "/api/users"],
      trips: "/api/trips",
      admin: "/api/admin"
    }
  });
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date().toISOString(), status: "healthy", uptime: process.uptime() });
});

// Provides real-time connection info for Socket.IO
app.get("/socket/status", (req, res) => {
  const stats = getConnectionStats();
  res.json({ success: true, socketIO: stats || { enabled: true, connections: 0 }, timestamp: new Date().toISOString() });
});

/**
 * Error Handling
 */

// Handle requests that don't match any route
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.url,
    method: req.method
  });
});

// Centralized error handler for all unhandled errors in logic
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

/**
 * Server Lifecycle: Setup Socket.IO and Start Listening
 */
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize real-time location and messaging system
const io = initSocket(server);
console.log("📡 Socket.IO server ready at /socket.io/");

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Socket.IO endpoint: ws://0.0.0.0:${PORT}/socket.io/`);
});

/**
 * Graceful Shutdown Handlers
 * Ensures database connections and sockets are closed before exiting.
 */
const handleShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    io.close(() => {
      console.log('✅ Socket.IO closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Optional: Graceful shutdown could be initiated here if the error is critical
  // handleShutdown('UncaughtException');
});

module.exports = app;
