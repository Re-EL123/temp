// src/routes/adminRoutes.js
// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD ROUTES
// All routes require authentication + admin role
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const controller = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Middleware: verify the authenticated user has admin role.
 * Runs AFTER authMiddleware has decoded the JWT and set req.user.
 */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

// ─── Dashboard Overview ──────────────────────────────────────
router.get("/stats", authMiddleware(), adminOnly, controller.getDashboardStats);
router.get("/activity", authMiddleware(), adminOnly, controller.getRecentActivity);

// ─── User Management ────────────────────────────────────────
router.get("/users", authMiddleware(), adminOnly, controller.getAllUsers);
router.get("/users/:id", authMiddleware(), adminOnly, controller.getUserById);
router.put("/users/:id", authMiddleware(), adminOnly, controller.updateUser);
router.delete("/users/:id", authMiddleware(), adminOnly, controller.deleteUser);
router.put("/users/:id/toggle-active", authMiddleware(), adminOnly, controller.toggleUserActive);

// ─── Driver Management ──────────────────────────────────────
router.get("/drivers", authMiddleware(), adminOnly, controller.getAllDrivers);
router.get("/drivers/:id", authMiddleware(), adminOnly, controller.getDriverById);
router.patch("/verify-driver/:id", authMiddleware(), adminOnly, controller.verifyDriver);

// ─── Trip Management ────────────────────────────────────────
router.get("/trips", authMiddleware(), adminOnly, controller.getAllTrips);
router.get("/trips/:id", authMiddleware(), adminOnly, controller.getTripById);
router.put("/trips/:id/cancel", authMiddleware(), adminOnly, controller.adminCancelTrip);
router.put("/trips/:id/status", authMiddleware(), adminOnly, controller.adminUpdateTripStatus);

// ─── Revenue ────────────────────────────────────────────────
router.get("/revenue", authMiddleware(), adminOnly, controller.getRevenueStats);

module.exports = router;
