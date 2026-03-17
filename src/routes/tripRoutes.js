// src/routes/tripRoutes.js
// ═══════════════════════════════════════════════════════════════
// UNIFIED TRIP ROUTES
//
// Route order matters:
//   1. Fixed-path routes first (e.g. /create, /request, /location)
//   2. Multi-segment param routes (/requests/:driverId, /parent/:parentId)
//   3. General query route (/)
//   4. Single-segment param routes (/:id, /:id/accept, etc.) LAST
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const controller = require("../controllers/trip.controller");
const authMiddleware = require("../middleware/authMiddleware");

// ═══════════════════════════════════════════════════════════════
//  CREATION
// ═══════════════════════════════════════════════════════════════

// Create a new trip (with driver notification)
router.post("/create", authMiddleware(), controller.createTrip);

// Request a trip (marketplace or redirect to create)
router.post("/request", authMiddleware(), controller.requestTrip);

// Legacy location update (tripId in body)
router.post("/location", authMiddleware(), controller.updateDriverLocation);

// Admin: assign driver to trip
router.post("/assign-driver", authMiddleware(), controller.assignDriverToTrip);

// ═══════════════════════════════════════════════════════════════
//  DRIVER-SPECIFIC ROUTES (multi-segment, before /:id)
// ═══════════════════════════════════════════════════════════════

// Get pending trip requests for a driver
router.get(
  "/requests/:driverId",
  authMiddleware(),
  controller.getDriverRequests
);

// Get upcoming accepted trips for a driver
router.get(
  "/upcoming/:driverId",
  authMiddleware(),
  controller.getDriverUpcomingTrips
);

// Get ALL trips for a specific driver
router.get(
  "/driver-trips/:driverId",
  authMiddleware(),
  controller.getDriverTrips
);

// ═══════════════════════════════════════════════════════════════
//  PARENT-SPECIFIC ROUTES (multi-segment, before /:id)
// ═══════════════════════════════════════════════════════════════

// Get all trips for a parent
router.get("/parent/:parentId", authMiddleware(), controller.getParentTrips);

// Authenticated parent's ride history
router.get("/history", authMiddleware(), controller.getParentRideHistory);

// Unified endpoint (parent OR driver based on auth role)
router.get("/user-trips", authMiddleware(), controller.getUserTrips);

// Get active trip for tracking
router.get("/active/:tripId", authMiddleware(), controller.getActiveTrip);

// ═══════════════════════════════════════════════════════════════
//  GENERAL QUERY (before /:id so "?" doesn't get caught)
// ═══════════════════════════════════════════════════════════════

// Get all trips with optional filters
router.get("/", authMiddleware(), controller.getTrips);

// ═══════════════════════════════════════════════════════════════
//  PARAMETERISED /:id ROUTES (must be LAST)
// ═══════════════════════════════════════════════════════════════

// ─── Status polling (lightweight) ─────────────────────────────
router.get("/:id/status", authMiddleware(), controller.getTripStatus);

// ─── Tracking data ────────────────────────────────────────────
router.get("/:id/tracking", authMiddleware(), controller.getTripTracking);

// ─── Single trip detail ───────────────────────────────────────
router.get("/:id", authMiddleware(), controller.getTripById);

// ─── Trip Actions (PUT — matching frontend) ───────────────────
router.put("/:id/accept", authMiddleware(), controller.acceptTrip);
router.put("/:id/decline", authMiddleware(), controller.declineTrip);
router.put("/:id/start", authMiddleware(), controller.startTrip);
router.put("/:id/complete", authMiddleware(), controller.completeTrip);
router.put("/:id/cancel", authMiddleware(), controller.cancelTrip);

// ─── Location update (path param style) ───────────────────────
router.put("/:id/location", authMiddleware(), controller.updateTripLocation);

// ─── Generic status update (admin) ────────────────────────────
router.put("/:id/status", authMiddleware(), controller.updateTripStatus);

// ─── PATCH alternatives (for newer clients) ──────────────────
router.patch("/:id/accept", authMiddleware(), controller.acceptTrip);
router.patch("/:id/decline", authMiddleware(), controller.declineTrip);
router.patch("/:id/start", authMiddleware(), controller.startTrip);
router.patch("/:id/complete", authMiddleware(), controller.completeTrip);
router.patch("/:id/cancel", authMiddleware(), controller.cancelTrip);
router.patch(
  "/:id/driver-location",
  authMiddleware(),
  controller.updateTripDriverLocation
);

// ─── Rating ───────────────────────────────────────────────────
router.post("/:id/rate", authMiddleware(), controller.rateTrip);

// ─── Delete ───────────────────────────────────────────────────
router.delete("/:id", authMiddleware(), controller.deleteTrip);

module.exports = router;
