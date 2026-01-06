// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");

const connectDB = require("./src/config/db");
const { initSocket } = require("./src/socket");

// Load env variables early
dotenv.config();

const app = express();

// Enable proxy (important for production & tracking)
app.enable("trust proxy");

// CORS Configuration - MUST be before other middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Request logging
app.use((req, res, next) => {
  console.log("Request received:", req.method, req.url);
  next();
});

// Middleware
app.use(express.json());

// Connect to MongoDB
connectDB()
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// Extra logging
app.use((req, res, next) => {
  console.log("➡ Incoming:", req.method, req.url);
  next();
});

// ============================
// ROUTES
// ============================
const authRoutes = require("./src/routes/authRoutes");
const protectedRoutes = require("./src/routes/protectedRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const tripRoutes = require("./src/routes/tripRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const withdrawalRoute = require("./src/routes/withdrawalRoute");

// Public Auth Routes
app.use("/api/auth", authRoutes);

// Protected Routes
app.use("/api/protected", protectedRoutes);

// Admin Routes
app.use("/api/admin", adminRoutes);

// Trip Routes (Socket-powered)
app.use("/api/trips", tripRoutes);

// Payment Routes
app.use("/api/payments", paymentRoutes);

// Withdrawal Routes
app.use("/api/withdrawals", withdrawalRoute);

// ============================
// HEALTH & TEST ROUTES
// ============================
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

// Not Found Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ============================
// SOCKET.IO + SERVER START
// ============================
const PORT = process.env.PORT || 3000;

// Create HTTP server (required for Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
});

// Export for Vercel serverless
module.exports = app;