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

  // Only allow GET for profile
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log("[PROFILE] Fetching user profile...");
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log("[PROFILE] Database connected");
    } catch (dbError) {
      console.error("[PROFILE] Database connection error:", dbError);
      return res.status(500).json({ 
        message: "Database connection failed", 
        error: dbError.message 
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[PROFILE] No authorization token provided");
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    if (!process.env.JWT_SECRET) {
      console.error("[PROFILE] JWT_SECRET not found");
      return res.status(500).json({ message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("[PROFILE] Token verified for user:", decoded.id);
    } catch (jwtError) {
      console.log("[PROFILE] Invalid token:", jwtError.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Fetch user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log("[PROFILE] User not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("[PROFILE] Profile fetched successfully");

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("[PROFILE] Error:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
