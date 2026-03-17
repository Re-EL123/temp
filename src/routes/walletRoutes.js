const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const Trip = require("../models/trip.model");
const Driver = require("../models/Driver");

/**
 * GET Wallet Stats for Driver
 * GET /api/wallet/stats
 */
router.get("/stats", verifyToken(), async (req, res) => {
    try {
        const driver = await Driver.findOne({ userId: req.user.id });
        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        // Calculate total earnings from completed trips
        const completedTrips = await Trip.find({
            driver: driver._id,
            status: "completed"
        });

        const totalIncome = completedTrips.reduce((sum, trip) => sum + (trip.fare || 0), 0);

        // Mocking growth for now as requested in the mockup (↑ 58%)
        const growth = 58;

        res.json({
            success: true,
            stats: {
                totalIncome,
                walletBalance: driver.walletBalance || 0,
                growth,
                completedTripsCount: completedTrips.length
            }
        });
    } catch (error) {
        console.error("[WALLET_ROUTES] Stats Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

/**
 * GET Wallet History (Monthly Breakdown)
 * GET /api/wallet/history
 */
router.get("/history", verifyToken(), async (req, res) => {
    try {
        const driver = await Driver.findOne({ userId: req.user.id });
        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        // Aggregate earnings by month
        const history = await Trip.aggregate([
            {
                $match: {
                    driver: driver._id,
                    status: "completed"
                }
            },
            {
                $group: {
                    _id: { $month: "$completedAt" },
                    monthName: { $first: { $dateToString: { format: "%B", date: "$completedAt" } } },
                    earnings: { $sum: "$fare" },
                    tripCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": -1 } }
        ]);

        res.json({
            success: true,
            history: history.length > 0 ? history : [
                // Fallback demo data if no trips exist yet
                { monthName: "March", earnings: 0, tripCount: 0 },
                { monthName: "February", earnings: 0, tripCount: 0 }
            ]
        });
    } catch (error) {
        console.error("[WALLET_ROUTES] History Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

module.exports = router;
