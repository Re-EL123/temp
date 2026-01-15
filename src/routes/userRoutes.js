const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/Driver");

const router = express.Router();

// Handle preflight for user routes
router.options("*", (req, res) => {
  res.status(200).end();
});

/**
 * POST /api/user/driver-onboarding
 * Complete driver onboarding with vehicle information
 * Requires: JWT token in Authorization header
 * Body: { registrationNumber, passengerSeats, carBrand, carModel, cellNumber, driverPicture? }
 */
router.post("/driver-onboarding", async (req, res) => {
  try {
    console.log("[DRIVER-ONBOARDING] Starting driver onboarding process...");

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[DRIVER-ONBOARDING] No authorization token provided");
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];

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
    if (user.role !== "driver") {
      console.log("[DRIVER-ONBOARDING] User is not a driver");
      return res.status(403).json({ message: "Only drivers can complete onboarding" });
    }

    const {
      registrationNumber,
      passengerSeats,
      carBrand,
      carModel,
      cellNumber,
      driverPicture,
    } = req.body;

    console.log("[DRIVER-ONBOARDING] Body received:", {
      registrationNumber,
      passengerSeats,
      carBrand,
      carModel,
      cellNumber,
    });

    // Validate required fields
    if (!registrationNumber || !passengerSeats || !carBrand || !carModel || !cellNumber) {
      console.log("[DRIVER-ONBOARDING] Missing required fields");
      return res.status(400).json({
        message:
          "All fields are required: registrationNumber, passengerSeats, carBrand, carModel, cellNumber",
      });
    }

    // Update user with driver info
    user.registrationNumber = registrationNumber;
    user.passengerSeats = passengerSeats;
    user.carBrand = carBrand;
    user.carModel = carModel;
    user.cellNumber = cellNumber;
    user.driverPicture = driverPicture || "https://via.placeholder.com/150";
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
        status: "available",
        isVerified: false,
        rating: 5,
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
        driverPicture: user.driverPicture,
      },
      driver: {
        id: driver._id,
        vehicleSeats: driver.vehicleSeats,
        status: driver.status,
        isVerified: driver.isVerified,
      },
    });
  } catch (error) {
    console.error("[DRIVER-ONBOARDING] Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
