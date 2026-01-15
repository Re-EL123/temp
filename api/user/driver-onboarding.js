const jwt = require("jsonwebtoken");
const User = require("../../src/models/user");
const Driver = require("../../src/models/Driver");
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
return res.status(200).end();  }

  // Only allow POST for driver onboarding
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log("[DRIVER-ONBOARDING] Starting driver onboarding process...");
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log("[DRIVER-ONBOARDING] Database connected");
    } catch (dbError) {
      console.error("[DRIVER-ONBOARDING] Database connection error:", dbError);
      return res.status(500).json({ 
        message: "Database connection failed", 
        error: dbError.message 
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[DRIVER-ONBOARDING] No authorization token provided");
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    if (!process.env.JWT_SECRET) {
      console.error("[DRIVER-ONBOARDING] JWT_SECRET not found");
      return res.status(500).json({ message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("[DRIVER-ONBOARDING] Token verified for user:", decoded.id);
    } catch (jwtError) {
      console.log("[DRIVER-ONBOARDING] Invalid token:", jwtError.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Fetch user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log("[DRIVER-ONBOARDING] User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is a driver
    if (user.role !== 'driver') {
      console.log("[DRIVER-ONBOARDING] User is not a driver");
      return res.status(403).json({ message: "Only drivers can complete onboarding" });
    }

    const { 
      registrationNumber, 
      passengerSeats, 
      carBrand, 
      carModel, 
      cellNumber, 
      driverPicture 
    } = req.body;

    console.log("[DRIVER-ONBOARDING] Body received:", { 
      registrationNumber, 
      passengerSeats, 
      carBrand, 
      carModel, 
      cellNumber 
    });

    // Validate required fields
    if (!registrationNumber || !passengerSeats || !carBrand || !carModel || !cellNumber) {
      console.log("[DRIVER-ONBOARDING] Missing required fields");
      return res.status(400).json({ 
        message: "All fields are required: registrationNumber, passengerSeats, carBrand, carModel, cellNumber" 
      });
    }

    // Update user with driver info
    user.registrationNumber = registrationNumber;
    user.passengerSeats = passengerSeats;
    user.carBrand = carBrand;
    user.carModel = carModel;
    user.cellNumber = cellNumber;
    user.driverPicture = driverPicture || 'https://via.placeholder.com/150';
    user.onboardingCompleted = true;
    user.phone = cellNumber; // Also update phone field
    
    await user.save();
    console.log("[DRIVER-ONBOARDING] User updated successfully");

    // Create or update Driver profile
    let driver = await Driver.findOne({ userId: user._id });
    
    if (!driver) {
      // Create new driver profile
      driver = await Driver.create({
        userId: user._id,
        vehicleSeats: passengerSeats,
        assignedStudents: 0,
        status: 'available',
        isVerified: false,
        rating: 5
      });
      console.log("[DRIVER-ONBOARDING] Driver profile created");
    } else {
      // Update existing driver profile
      driver.vehicleSeats = passengerSeats;
      await driver.save();
      console.log("[DRIVER-ONBOARDING] Driver profile updated");
    }

    return res.status(200).json({
      success: true,
      message: "Driver onboarding completed successfully",
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        registrationNumber: user.registrationNumber,
        passengerSeats: user.passengerSeats,
        carBrand: user.carBrand,
        carModel: user.carModel,
        cellNumber: user.cellNumber,
        driverPicture: user.driverPicture
      },
      driver: {
        id: driver._id,
        vehicleSeats: driver.vehicleSeats,
        status: driver.status,
        isVerified: driver.isVerified
      }
    });
  } catch (error) {
    console.error("[DRIVER-ONBOARDING] Error:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
