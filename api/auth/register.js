const bcrypt = require("bcryptjs");
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

  // Only allow POST for registration
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log("[REGISTER] Starting registration process...");
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log("[REGISTER] Database connected");
    } catch (dbError) {
      console.error("[REGISTER] Database connection error:", dbError);
      return res.status(500).json({ 
        message: "Database connection failed", 
        error: dbError.message 
      });
    }

    const { name, surname, email, password, role } = req.body;

    console.log("[REGISTER] Body received:", { name, surname, email, role });

    if (!name || !surname || !email || !password) {
      console.log("[REGISTER] Missing required fields");
      return res.status(400).json({ message: "Name, Surname, email & password required" });
    }

    // Check if user already exists
    console.log("[REGISTER] Checking for existing user...");
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("[REGISTER] User already exists");
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    console.log("[REGISTER] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log("[REGISTER] Creating user...");
    const newUser = await User.create({
      name,
      surname,
      email,
      password: hashedPassword,
      role: role || "user",
      onboardingCompleted: false,
    });

    console.log("[REGISTER] User created successfully:", newUser._id);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        surname: newUser.surname,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
