// Deployment fix: v1.0.1
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../src/models/user");
const connectDB = require("../../src/config/db");

// CORS headers helper
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return res;
};

module.exports = async (req, res) => {
  // Set CORS headers for all requests
  setCorsHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST for login
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log("[LOGIN] Starting login process...");
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log("[LOGIN] Database connected");
    } catch (dbError) {
      console.error("[LOGIN] Database connection error:", dbError);
      return res.status(500).json({ 
        message: "Database connection failed", 
        error: dbError.message 
      });
    }

    const { email, password } = req.body;
    console.log("[LOGIN] Login attempt for email:", email);

    if (!email || !password) {
      console.log("[LOGIN] Missing email or password");
      return res.status(400).json({ message: "Email & password required" });
    }

    // Check user exists
    console.log("[LOGIN] Searching for user...");
    const user = await User.findOne({ email });
    if (!user) {
      console.log("[LOGIN] User not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("[LOGIN] User found, verifying password...");
    // Validate password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      console.log("[LOGIN] Invalid password");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("[LOGIN] JWT_SECRET not found in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    console.log("[LOGIN] Generating JWT token...");
    // Create JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("[LOGIN] Login successful for user:", user._id);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
