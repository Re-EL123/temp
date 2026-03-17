const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const Driver = require("../models/Driver");
const User = require("../models/user");
const controller = require("../controllers/driver.controller");

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
//  FIXED-PATH ROUTES (must be BEFORE any /:id routes)
// ═══════════════════════════════════════════════════════════════

// GET Available Drivers (accessible by parents or anyone authenticated)
router.get("/available", verifyToken(), controller.getAvailableDrivers);

// UPDATE Driver Location (called by driver app periodically)
router.put("/location", verifyToken(), controller.updateDriverLocation);

// ═══════════════════════════════════════════════════════════════
//  UPDATE DRIVER PROFILE (onboarding)
// ═══════════════════════════════════════════════════════════════

router.post("/update-profile", verifyToken(["driver"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      registrationNumber,
      passengerSeats,
      carBrand,
      carModel,
      carYear,
      carColor,
      driverPicture,
      cellNumber,
      licenseNumber,
      address,
    } = req.body;

    // Validate required fields
    if (
      !registrationNumber ||
      !passengerSeats ||
      !carBrand ||
      !carModel ||
      !cellNumber
    ) {
      return res
        .status(400)
        .json({ message: "All fields are required" });
    }

    // ── Upsert Driver document ──────────────────────────
    const updatedDriver = await Driver.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        registrationNumber,
        passengerSeats,
        vehicleSeats: passengerSeats,
        carBrand,
        carModel,
        carYear: carYear || "",
        carColor: carColor || "",
        licenseNumber: licenseNumber || "",
        driverPicture,
        cellNumber,
      },
      { new: true, upsert: true }
    );

    // ── Sync vehicle info to User model ─────────────────
    // So the available-drivers endpoint can find it from User too
    const userUpdate = {
      onboardingCompleted: true,
      carBrand,
      carModel,
      registrationNumber,
    };
    if (carYear) userUpdate.carYear = carYear;
    if (carColor) userUpdate.carColor = carColor;
    if (licenseNumber) userUpdate.licenseNumber = licenseNumber;
    if (address) {
      userUpdate.address = address;
      userUpdate.location = address;
    }

    await User.findByIdAndUpdate(userId, { $set: userUpdate });

    console.log(
      `[Driver Profile] Updated: userId=${userId}, reg=${registrationNumber}, ${carBrand} ${carModel}`
    );

    res.json({
      success: true,
      message: "Driver profile updated successfully",
      driver: updatedDriver,
    });
  } catch (error) {
    console.error("Update Driver Profile Error:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  MULTI-SEGMENT PARAM ROUTES
// ═══════════════════════════════════════════════════════════════

// Get Driver by User._id (used by DriverDashboard to resolve Driver._id)
router.get("/by-user/:userId", verifyToken(), controller.getDriverByUserId);

// ═══════════════════════════════════════════════════════════════
//  GENERAL LIST
// ═══════════════════════════════════════════════════════════════

// Get all drivers (admin view)
router.get("/", verifyToken(), controller.getAllDrivers);

// ═══════════════════════════════════════════════════════════════
//  SINGLE PARAM ROUTES (must be LAST — catches /:id)
// ═══════════════════════════════════════════════════════════════

// Get driver by Driver._id
router.get("/:id", verifyToken(), controller.getDriverById);

module.exports = router;
