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
  
  // Only allow POST for onboarding submission
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    console.log("[ONBOARDING] Submitting onboarding data...");
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log("[ONBOARDING] Database connected");
    } catch (dbError) {
      console.error("[ONBOARDING] Database connection error:", dbError);
      return res.status(500).json({ 
        message: "Database connection failed", 
        error: dbError.message 
      });
    }
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[ONBOARDING] No authorization token provided");
      return res.status(401).json({ message: "No authorization token provided" });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    if (!process.env.JWT_SECRET) {
      console.error("[ONBOARDING] JWT_SECRET not found");
      return res.status(500).json({ message: "Server configuration error" });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("[ONBOARDING] Token verified for user:", decoded.id);
    } catch (jwtError) {
      console.log("[ONBOARDING] Invalid token:", jwtError.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    // Extract onboarding data from request body
    const { drivingLicenseNumber, licenseExpiryDate, vehicleRegistration, insuranceExpiry } = req.body;
    
    // Validate required fields
    if (!drivingLicenseNumber || !licenseExpiryDate || !vehicleRegistration || !insuranceExpiry) {
      console.log("[ONBOARDING] Missing required fields");
      return res.status(400).json({ message: "Missing required onboarding fields" });
    }
    
    // Update user with onboarding data and mark as completed
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      {
        onboardingCompleted: true,
        drivingLicenseNumber,
        licenseExpiryDate,
        vehicleRegistration,
        insuranceExpiry,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      console.log("[ONBOARDING] User not found");
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log("[ONBOARDING] Onboarding completed successfully for user:", decoded.id);
    return res.json({
      success: true,
      message: "Onboarding completed successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted,
        drivingLicenseNumber: updatedUser.drivingLicenseNumber,
        vehicleRegistration: updatedUser.vehicleRegistration,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("[ONBOARDING] Error:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
