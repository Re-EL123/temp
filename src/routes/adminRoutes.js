const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/user");

const adminController = require("../controllers/adminController");

// ✔ ADMIN-ONLY DASHBOARD STATS
router.get("/stats", verifyToken(["admin"]), adminController.getDashboardStats);

// ✔ DRIVER MANAGEMENT
router.get("/drivers", verifyToken(["admin"]), adminController.getAllDrivers);
router.patch("/verify-driver/:id", verifyToken(["admin"]), adminController.verifyDriver);

// ✔ TRIP MONITORING
router.get("/trips", verifyToken(["admin"]), adminController.getAllTrips);

// ✔ USER MANAGEMENT
router.get("/users", verifyToken(["admin"]), adminController.getAllUsers);
router.delete("/delete/:id", verifyToken(["admin"]), adminController.deleteUser);

// Legacy dashboard endpoint
router.get("/dashboard", verifyToken(["admin"]), (req, res) => {
  res.json({ message: "Welcome Admin", admin: req.user });
});

module.exports = router;
