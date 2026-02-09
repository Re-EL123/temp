// src/routes/tripRoutes.js - Complete Trip Routes with Driver Dashboard Support
const express = require("express");
const router = express.Router();
const controller = require("../controllers/trip.controller");
const authMiddleware = require("../middleware/authMiddleware");

// ============================
// TRIP MANAGEMENT ROUTES
// ============================

// Create a new trip (with driver notification)
router.post("/create", authMiddleware(), controller.createTrip);

// Request a trip (legacy support)
router.post("/request", authMiddleware(), controller.requestTrip);

// Get all trips for a user (parent or driver)
router.get("/", authMiddleware(), controller.getTrips);

// Get specific trip by ID
router.get("/:id", authMiddleware(), controller.getTripById);

// Update trip status (generic)
router.put("/:id/status", authMiddleware(), controller.updateTripStatus);

// Delete trip
router.delete("/:id", authMiddleware(), controller.deleteTrip);

// ============================
// DRIVER-SPECIFIC ROUTES
// ============================

// Get pending trip requests for a specific driver
router.get("/requests/:driverId", authMiddleware(), controller.getDriverRequests);

// Get upcoming accepted trips for a specific driver
router.get("/upcoming/:driverId", authMiddleware(), controller.getDriverUpcomingTrips);

// Accept a trip request
router.put("/:id/accept", authMiddleware(), controller.acceptTrip);

// Decline a trip request
router.put("/:id/decline", authMiddleware(), controller.declineTrip);

// Start a trip (driver begins the trip)
router.put("/:id/start", authMiddleware(), controller.startTrip);

// Complete a trip
router.put("/:id/complete", authMiddleware(), controller.completeTrip);

// Cancel a trip
router.put("/:id/cancel", authMiddleware(), controller.cancelTrip);

// ============================
// PARENT-SPECIFIC ROUTES
// ============================

// Get all trips for a parent
router.get("/parent/:parentId", authMiddleware(), controller.getParentTrips);

// Get active trip for tracking
router.get("/active/:tripId", authMiddleware(), controller.getActiveTrip);

// ============================
// REAL-TIME TRACKING ROUTES
// ============================

// Update driver location during trip
router.put("/:id/location", authMiddleware(), controller.updateTripLocation);

// Get trip route and tracking data
router.get("/:id/tracking", authMiddleware(), controller.getTripTracking);

module.exports = router;
