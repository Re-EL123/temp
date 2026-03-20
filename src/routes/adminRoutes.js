const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/user");

const adminController = require("../controllers/adminController");

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════════════════════

// ✔ ADMIN-ONLY DASHBOARD STATS
router.get("/stats", verifyToken(["admin"]), adminController.getDashboardStats);

// ✔ RECENT ACTIVITY FEED
router.get("/activity", verifyToken(["admin"]), adminController.getRecentActivity);

// ═══════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// ✔ LIST ALL USERS (with search/role/active filters)
router.get("/users", verifyToken(["admin"]), adminController.getAllUsers);

// ✔ GET SINGLE USER DETAIL
router.get("/users/:id", verifyToken(["admin"]), adminController.getUserById);

// ✔ UPDATE USER FIELDS
router.put("/users/:id", verifyToken(["admin"]), adminController.updateUser);

// ✔ DELETE USER WITH CASCADE
router.delete("/users/:id", verifyToken(["admin"]), adminController.deleteUser);

// ✔ TOGGLE USER ACTIVE STATUS
router.put("/users/:id/toggle-active", verifyToken(["admin"]), adminController.toggleUserActive);

// Legacy delete path (kept for backward compatibility)
router.delete("/delete/:id", verifyToken(["admin"]), adminController.deleteUser);

// ═══════════════════════════════════════════════════════════════
//  DRIVER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// ✔ LIST ALL DRIVERS (with search/verified filters + trip stats)
router.get("/drivers", verifyToken(["admin"]), adminController.getAllDrivers);

// ✔ GET SINGLE DRIVER DETAIL (with recent trips)
router.get("/drivers/:id", verifyToken(["admin"]), adminController.getDriverById);

// ✔ VERIFY / UNVERIFY DRIVER
router.patch("/verify-driver/:id", verifyToken(["admin"]), adminController.verifyDriver);

// ═══════════════════════════════════════════════════════════════
//  TRIP MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// ✔ LIST ALL TRIPS (with status/date/search filters)
router.get("/trips", verifyToken(["admin"]), adminController.getAllTrips);

// ✔ GET SINGLE TRIP DETAIL
router.get("/trips/:id", verifyToken(["admin"]), adminController.getTripById);

// ✔ ADMIN FORCE-CANCEL A TRIP
router.put("/trips/:id/cancel", verifyToken(["admin"]), adminController.adminCancelTrip);

// ✔ ADMIN UPDATE TRIP STATUS
router.put("/trips/:id/status", verifyToken(["admin"]), adminController.adminUpdateTripStatus);

// ═══════════════════════════════════════════════════════════════
//  REVENUE & ANALYTICS
// ═══════════════════════════════════════════════════════════════

// ✔ DETAILED REVENUE BREAKDOWN
router.get("/revenue", verifyToken(["admin"]), adminController.getRevenueStats);

// ═══════════════════════════════════════════════════════════════
//  LEGACY
// ═══════════════════════════════════════════════════════════════

// Legacy dashboard endpoint
router.get("/dashboard", verifyToken(["admin"]), (req, res) => {
  res.json({ message: "Welcome Admin", admin: req.user });
});

module.exports = router;
