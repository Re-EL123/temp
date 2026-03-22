/**
 * SafeSchoolRide Backend - server.js
 * Main entry point for the Node.js/Express server.
 * Handles database connection, middleware setup, socket.io integration,
 * file uploads, and route mounting.
 */

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");

const connectDB = require("./src/config/db");
const { initSocket, getConnectionStats } = require("./src/socket");
const { isOriginAllowed } = require("./src/config/cors");

const app = express();

/**
 * Ensure upload directories exist
 */
const uploadsDir = path.join(__dirname, "uploads");
const verificationDir = path.join(__dirname, "uploads", "verification");

console.log("server.js uploadsDir =", uploadsDir);
console.log("server.js verificationDir =", verificationDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Created uploads directory");
}

if (!fs.existsSync(verificationDir)) {
  fs.mkdirSync(verificationDir, { recursive: true });
  console.log("📁 Created verification uploads directory");
}

/**
 * Middlewares & Security Configurations
 */

// Enable 'trust proxy' for secure session handling and tracking behind a load balancer
app.enable("trust proxy");

// Custom logging middleware to track API requests with timestamps
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.method === "OPTIONS") {
    console.log(`   CORS Preflight: ${req.headers.origin || "no origin"}`);
    console.log(`   Headers: ${req.headers["access-control-request-headers"]}`);
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
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Parsing incoming JSON and URL-encoded bodies with 10MB limit for image uploads
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * Static File Serving
 * Serves uploaded photos at /uploads/filename.jpg
 * Accessible as: https://safe-school-ride.duckdns.org/uploads/photo-123.jpg
 *
 * Also serves verification documents at /uploads/verification/{userId}/filename
 */
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Set proper content type for images and PDFs
      const ext = path.extname(filePath).toLowerCase();
      if ([".jpg", ".jpeg"].includes(ext)) res.setHeader("Content-Type", "image/jpeg");
      else if (ext === ".png") res.setHeader("Content-Type", "image/png");
      else if (ext === ".webp") res.setHeader("Content-Type", "image/webp");
      else if (ext === ".pdf") res.setHeader("Content-Type", "application/pdf");
      // Allow cross-origin image loading
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

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
const userRoutes = require("./src/routes/userRoutes");
const walletRoutes = require("./src/routes/walletRoutes");
const voucherRoutes = require("./src/routes/voucherRoutes");
const childRoutes = require("./src/routes/childRoutes");
const withdrawalRoutes = require("./src/routes/withdrawalRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const protectedRoutes = require("./src/routes/protectedRoutes");
const driverRoutes = require("./src/routes/driverRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");
const verificationRoutes = require("./src/routes/verificationRoutes");

// Core functional routes
app.use("/api/auth", authRoutes); // Authentication (Login, Register)
app.use("/api/protected", protectedRoutes); // Token verification test route
app.use("/api/admin", adminRoutes); // Admin dashboard & management
app.use("/api/trips", tripRoutes); // Trip management (requests, tracking)
app.use("/api/notifications", notificationRoutes); // System notifications
app.use("/api/reviews", reviewRoutes); // Driver/Ride reviews
app.use("/api/wallet", walletRoutes); // Parent wallet & transaction history
app.use("/api/payment", paymentRoutes); // Payment gateway integration (PayFast)
app.use("/api/vouchers", voucherRoutes); // Voucher system logic
app.use("/api/children", childRoutes); // Child profiles and linking
app.use("/api/withdrawals", withdrawalRoutes); // Driver withdrawal requests
app.use("/api/drivers", driverRoutes); // Driver discovery & management
app.use("/api/upload", uploadRoutes); // File uploads (photos)
app.use("/api/driver", verificationRoutes); // Driver verification & document uploads

// User profile routes with legacy support for dual path naming
app.use("/api/user", userRoutes); // Used by mobile app
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
      ...(stats && { connections: stats.totalConnections }),
    },
    routes: {
      auth: "/api/auth",
      users: ["/api/user", "/api/users"],
      trips: "/api/trips",
      drivers: "/api/drivers",
      upload: "/api/upload",
      admin: "/api/admin",
      verification: "/api/driver",
    },
  });
});

app.get("/ping", (req, res) => {
  res.json({
    message: "pong",
    timestamp: new Date().toISOString(),
    status: "healthy",
    uptime: process.uptime(),
  });
});

// Provides real-time connection info for Socket.IO
app.get("/socket/status", (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    socketIO: stats || { enabled: true, connections: 0 },
    timestamp: new Date().toISOString(),
  });
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
    method: req.method,
  });
});

// Centralized error handler for all unhandled errors in logic
app.use((err, req, res, next) => {
  // Handle multer file size errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large. Maximum size is 10MB.",
    });
  }

  // Handle multer file type errors
  if (err.message && (err.message.includes("Only JPEG") || err.message.includes("Invalid file type"))) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error(`❌ Server Error:`, {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
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
  console.log(`📁 Static files: http://0.0.0.0:${PORT}/uploads/`);
  console.log(`📸 Photo uploads: POST http://0.0.0.0:${PORT}/api/upload/photo`);
  console.log(`🔐 Verification: http://0.0.0.0:${PORT}/api/driver/verification-status`);
  console.log(`📄 Verification uploads: http://0.0.0.0:${PORT}/uploads/verification/`);
});

/**
 * Graceful Shutdown Handlers
 * Ensures database connections and sockets are closed before exiting.
 */
const handleShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log("✅ HTTP server closed");
    io.close(() => {
      console.log("✅ Socket.IO closed");
      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

module.exports = app;
