const express = require("express");
const router = express.Router();
const controller = require("../controllers/trip.controller");
const verifyToken = require("../middleware/authMiddleware");

/**
 * Trip Management Routes
 * All routes in this module require a valid JWT token.
 */
router.use(verifyToken());

/**
 * Parent Endpoints: Ride booking and history
 */
router.get("/history", controller.getParentRideHistory);
router.get("/user-trips", controller.getUserTrips);
router.post("/request", controller.requestTrip);
router.post("/create-request", controller.requestTrip); // Compatibility alias for frontend calls
router.post("/create", controller.createTrip);           // Direct once-off booking

/**
 * NEW: Trip Status & Rating (used by CreateOnceOffScreen live tracking)
 */
router.get("/:id/status", controller.getTripStatus);      // Live tracking polling
router.post("/:id/rate", controller.rateTrip);             // Rate driver after completion
router.patch("/:id/driver-location", controller.updateTripDriverLocation); // Driver GPS update

/**
 * Parent trip history by parentId
 */
router.get("/parent/:parentId", controller.getParentTrips);

/**
 * Admin Endpoints: System oversight and manual intervention
 */
router.post("/assign-driver", verifyToken(["admin"]), controller.assignDriverToTrip);
router.get("/", verifyToken(["admin"]), controller.getTrips);
router.delete("/:id", verifyToken(["admin"]), controller.deleteTrip);

/**
 * Driver Endpoints: Receiving and executing trips
 */

// Marketplace & Direct requests
router.get("/requests/:driverId", controller.getDriverRequests);
router.get("/driver/:driverId/pending", controller.getDriverRequests);

// Driver trip history
router.get("/driver-trips/:driverId", controller.getDriverTrips);

// Upcoming scheduled/active trips
router.get("/upcoming/:driverId", controller.getUpcomingTrips);

// Trip execution lifecycle
router.put("/:id/accept", controller.acceptTrip);
router.put("/:id/decline", controller.declineTrip);
router.put("/:id/start", controller.startTrip);
router.put("/:id/complete", controller.completeTrip);

// General status updates (e.g., cancellation)
router.put("/:id/status", controller.updateTripStatus);

// Legacy location update
router.post("/location", controller.updateDriverLocation);

module.exports = router;
