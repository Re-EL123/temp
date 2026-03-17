const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const Driver = require("../models/driver");
const User = require("../models/user");
const controller = require("../controllers/driver.controller");

const router = express.Router();

// GET Available Drivers (accessible by parents too, or anyone authenticated)
router.get("/available", verifyToken(), controller.getAvailableDrivers);

/* ---------------------- UPDATE DRIVER PROFILE ---------------------- */

/* ---------------------- UPDATE DRIVER PROFILE ---------------------- */
router.post("/update-profile", verifyToken(["driver"]), async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            registrationNumber,
            passengerSeats,
            carBrand,
            carModel,
            driverPicture,
            cellNumber,
            address // If we want to save address to User or Driver? Plan said Driver but User has address usually.
        } = req.body;

        // Validate required fields (customize as needed)
        if (!registrationNumber || !passengerSeats || !carBrand || !carModel || !cellNumber) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Upsert Driver document
        const updatedDriver = await Driver.findOneAndUpdate(
            { userId: userId },
            {
                userId: userId, // Ensure userId is set on creation
                registrationNumber,
                passengerSeats,
                vehicleSeats: passengerSeats, // Sync/fallback
                carBrand,
                carModel,
                driverPicture,
                cellNumber
            },
            { new: true, upsert: true } // Create if not exists
        );

        res.json({
            success: true,
            message: "Driver profile updated successfully",
            driver: updatedDriver
        });

    } catch (error) {
        console.error("Update Driver Profile Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
