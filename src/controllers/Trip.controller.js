// src/controllers/trip.controller.js - Complete Trip Controller with Driver Dashboard Support
const Trip = require("../models/trip");
const User = require("../models/user");
const { getIO } = require("../socket");

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Calculate fare based on distance and duration
 */
const calculateFare = (distanceMeters, durationSeconds) => {
  const distanceKm = distanceMeters / 1000;
  const baseFare = 25;
  const perKm = 12;
  const timeFactor = Math.ceil(durationSeconds / 60) * 0.5;
  return Math.round(baseFare + distanceKm * perKm + timeFactor);
};

/**
 * Send real-time notification via Socket.IO
 */
const sendNotification = (userId, event, data) => {
  try {
    const io = getIO();
    if (io) {
      io.to(userId.toString()).emit(event, data);
      console.log(`[Socket] Notification sent to ${userId}: ${event}`);
    }
  } catch (error) {
    console.error("[Socket] Failed to send notification:", error.message);
  }
};

// ============================
// CREATE TRIP
// ============================

/**
 * POST /api/trips/create
 * Create a new trip and notify driver
 */
exports.createTrip = async (req, res) => {
  try {
    const {
      tripType,
      parentId,
      parentName,
      driverId,
      driverName,
      driverVehicle,
      date,
      pickupTime,
      pickupLocation,
      dropoffLocation,
      route,
      activity,
      instructions,
      children,
      fare,
      estimatedDuration,
      estimatedDistance,
    } = req.body;

    // Validation
    if (!parentId || !driverId || !pickupLocation || !dropoffLocation || !date || !pickupTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: parentId, driverId, pickupLocation, dropoffLocation, date, pickupTime",
      });
    }

    // Verify parent exists
    const parent = await User.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // Verify driver exists and is active
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (!driver.isActive || !driver.onboardingCompleted) {
      return res.status(400).json({
        success: false,
        message: "Driver is not available",
      });
    }

    // Calculate fare if not provided
    const calculatedFare = fare || (route?.distance && route?.duration
      ? calculateFare(route.distance, route.duration)
      : 0);

    // Create trip
    const newTrip = new Trip({
      tripType: tripType || "once-off",
      parentId,
      parentName: parentName || `${parent.name} ${parent.surname}`,
      driverId,
      driverName: driverName || `${driver.name} ${driver.surname}`,
      driverVehicle: driverVehicle || `${driver.carBrand} ${driver.carModel} - ${driver.registrationNumber}`,
      date: new Date(date),
      pickupTime,
      pickupLocation: {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        address: pickupLocation.address,
      },
      dropoffLocation: {
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
        address: dropoffLocation.address,
      },
      route: route || {},
      activity: activity || "",
      instructions: instructions || "",
      children: children || [],
      status: "pending",
      fare: calculatedFare,
      estimatedDuration: estimatedDuration || Math.ceil((route?.duration || 0) / 60),
      estimatedDistance: estimatedDistance || ((route?.distance || 0) / 1000).toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newTrip.save();

    console.log(`[Create Trip] Trip ${newTrip._id} created: ${parent.name} -> ${driver.name}`);

    // Send real-time notification to driver
    sendNotification(driverId, "new_trip_request", {
      tripId: newTrip._id,
      parentName: newTrip.parentName,
      pickupLocation: newTrip.pickupLocation,
      dropoffLocation: newTrip.dropoffLocation,
      fare: newTrip.fare,
      date: newTrip.date,
      pickupTime: newTrip.pickupTime,
    });

    return res.status(201).json({
      success: true,
      message: "Trip request sent successfully",
      trip: newTrip,
    });
  } catch (error) {
    console.error("[Create Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET DRIVER REQUESTS
// ============================

/**
 * GET /api/trips/requests/:driverId
 * Get all pending trip requests for a driver
 */
exports.getDriverRequests = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get pending requests for this driver
    const requests = await Trip.find({
      driverId,
      status: "pending",
    }).sort({ createdAt: -1 });

    console.log(`[Get Driver Requests] Found ${requests.length} pending requests for driver ${driverId}`);

    return res.json({
      success: true,
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("[Get Driver Requests] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET DRIVER UPCOMING TRIPS
// ============================

/**
 * GET /api/trips/upcoming/:driverId
 * Get all upcoming accepted trips for a driver
 */
exports.getDriverUpcomingTrips = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get accepted trips that haven't started yet or are in progress
    const now = new Date();
    const trips = await Trip.find({
      driverId,
      status: { $in: ["accepted", "in-progress"] },
      date: { $gte: now.setHours(0, 0, 0, 0) }, // Today or future
    }).sort({ date: 1, pickupTime: 1 });

    console.log(`[Get Upcoming Trips] Found ${trips.length} upcoming trips for driver ${driverId}`);

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Upcoming Trips] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// ACCEPT TRIP
// ============================

/**
 * PUT /api/trips/:id/accept
 * Driver accepts a trip request
 */
exports.acceptTrip = async (req, res) => {
  try {
    const { id } = req.params;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Verify trip is in pending state
    if (trip.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept trip with status: ${trip.status}`,
      });
    }

    // Update trip status
    trip.status = "accepted";
    trip.acceptedAt = new Date();
    trip.updatedAt = new Date();
    await trip.save();

    console.log(`[Accept Trip] Trip ${id} accepted by driver ${trip.driverId}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_accepted", {
      tripId: trip._id,
      driverName: trip.driverName,
      driverVehicle: trip.driverVehicle,
      pickupTime: trip.pickupTime,
      date: trip.date,
    });

    return res.json({
      success: true,
      message: "Trip accepted successfully",
      trip,
    });
  } catch (error) {
    console.error("[Accept Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// DECLINE TRIP
// ============================

/**
 * PUT /api/trips/:id/decline
 * Driver declines a trip request
 */
exports.declineTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Verify trip is in pending state
    if (trip.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot decline trip with status: ${trip.status}`,
      });
    }

    // Update trip status
    trip.status = "declined";
    trip.declinedAt = new Date();
    trip.declineReason = reason || "Driver declined";
    trip.updatedAt = new Date();
    await trip.save();

    console.log(`[Decline Trip] Trip ${id} declined by driver ${trip.driverId}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_declined", {
      tripId: trip._id,
      driverName: trip.driverName,
      reason: trip.declineReason,
    });

    return res.json({
      success: true,
      message: "Trip declined successfully",
      trip,
    });
  } catch (error) {
    console.error("[Decline Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// START TRIP
// ============================

/**
 * PUT /api/trips/:id/start
 * Driver starts an accepted trip
 */
exports.startTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Verify trip is accepted
    if (trip.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: `Cannot start trip with status: ${trip.status}`,
      });
    }

    // Update trip status
    trip.status = "in-progress";
    trip.startedAt = new Date();
    trip.updatedAt = new Date();

    // Update driver's current location if provided
    if (latitude && longitude) {
      trip.currentLocation = {
        latitude,
        longitude,
        timestamp: new Date(),
      };
    }

    await trip.save();

    console.log(`[Start Trip] Trip ${id} started by driver ${trip.driverId}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_started", {
      tripId: trip._id,
      driverName: trip.driverName,
      startedAt: trip.startedAt,
      currentLocation: trip.currentLocation,
    });

    return res.json({
      success: true,
      message: "Trip started successfully",
      trip,
    });
  } catch (error) {
    console.error("[Start Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// COMPLETE TRIP
// ============================

/**
 * PUT /api/trips/:id/complete
 * Driver completes a trip
 */
exports.completeTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualFare, notes } = req.body;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Verify trip is in progress
    if (trip.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete trip with status: ${trip.status}`,
      });
    }

    // Update trip status
    trip.status = "completed";
    trip.completedAt = new Date();
    trip.updatedAt = new Date();

    if (actualFare) {
      trip.actualFare = actualFare;
    }

    if (notes) {
      trip.completionNotes = notes;
    }

    await trip.save();

    // Update driver earnings
    const driver = await User.findById(trip.driverId);
    if (driver) {
      driver.totalEarnings = (driver.totalEarnings || 0) + (actualFare || trip.fare);
      await driver.save();
    }

    console.log(`[Complete Trip] Trip ${id} completed by driver ${trip.driverId}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_completed", {
      tripId: trip._id,
      driverName: trip.driverName,
      completedAt: trip.completedAt,
      fare: actualFare || trip.fare,
    });

    return res.json({
      success: true,
      message: "Trip completed successfully",
      trip,
    });
  } catch (error) {
    console.error("[Complete Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// CANCEL TRIP
// ============================

/**
 * PUT /api/trips/:id/cancel
 * Cancel a trip (parent or driver)
 */
exports.cancelTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancelledBy } = req.body;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Cannot cancel completed trips
    if (trip.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed trip",
      });
    }

    // Update trip status
    trip.status = "cancelled";
    trip.cancelledAt = new Date();
    trip.cancelledBy = cancelledBy || "user";
    trip.cancellationReason = reason || "User cancelled";
    trip.updatedAt = new Date();
    await trip.save();

    console.log(`[Cancel Trip] Trip ${id} cancelled by ${cancelledBy}`);

    // Notify both parties
    sendNotification(trip.parentId, "trip_cancelled", {
      tripId: trip._id,
      reason: trip.cancellationReason,
      cancelledBy: trip.cancelledBy,
    });

    sendNotification(trip.driverId, "trip_cancelled", {
      tripId: trip._id,
      reason: trip.cancellationReason,
      cancelledBy: trip.cancelledBy,
    });

    return res.json({
      success: true,
      message: "Trip cancelled successfully",
      trip,
    });
  } catch (error) {
    console.error("[Cancel Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// UPDATE TRIP LOCATION (REAL-TIME TRACKING)
// ============================

/**
 * PUT /api/trips/:id/location
 * Update driver's current location during trip
 */
exports.updateTripLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, speed, heading } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required",
      });
    }

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Only update location for in-progress trips
    if (trip.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Trip is not in progress",
      });
    }

    // Update location
    trip.currentLocation = {
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      timestamp: new Date(),
    };
    trip.updatedAt = new Date();

    await trip.save();

    // Send real-time location update to parent
    sendNotification(trip.parentId, "driver_location_update", {
      tripId: trip._id,
      location: trip.currentLocation,
    });

    return res.json({
      success: true,
      message: "Location updated successfully",
      location: trip.currentLocation,
    });
  } catch (error) {
    console.error("[Update Trip Location] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET TRIP TRACKING DATA
// ============================

/**
 * GET /api/trips/:id/tracking
 * Get trip route and real-time tracking data
 */
exports.getTripTracking = async (req, res) => {
  try {
    const { id } = req.params;

    // Find trip
    const trip = await Trip.findById(id)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber")
      .populate("parentId", "name surname phone");

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    return res.json({
      success: true,
      trip: {
        _id: trip._id,
        status: trip.status,
        pickupLocation: trip.pickupLocation,
        dropoffLocation: trip.dropoffLocation,
        currentLocation: trip.currentLocation,
        route: trip.route,
        driver: trip.driverId,
        parent: trip.parentId,
        startedAt: trip.startedAt,
        estimatedArrival: trip.estimatedArrival,
      },
    });
  } catch (error) {
    console.error("[Get Trip Tracking] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET TRIP BY ID
// ============================

/**
 * GET /api/trips/:id
 * Get detailed trip information
 */
exports.getTripById = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber")
      .populate("parentId", "name surname phone email");

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    return res.json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error("[Get Trip By ID] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET ALL TRIPS
// ============================

/**
 * GET /api/trips
 * Get all trips (with filters)
 */
exports.getTrips = async (req, res) => {
  try {
    const { status, userId, role, startDate, endDate } = req.query;

    const filter = {};

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by user (parent or driver)
    if (userId && role) {
      if (role === "parent") {
        filter.parentId = userId;
      } else if (role === "driver") {
        filter.driverId = userId;
      }
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const trips = await Trip.find(filter)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber")
      .populate("parentId", "name surname phone email")
      .sort({ createdAt: -1 });

    console.log(`[Get Trips] Found ${trips.length} trips with filters:`, filter);

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Trips] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET PARENT TRIPS
// ============================

/**
 * GET /api/trips/parent/:parentId
 * Get all trips for a specific parent
 */
exports.getParentTrips = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { status } = req.query;

    const filter = { parentId };
    if (status) {
      filter.status = status;
    }

    const trips = await Trip.find(filter)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber")
      .sort({ createdAt: -1 });

    console.log(`[Get Parent Trips] Found ${trips.length} trips for parent ${parentId}`);

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Parent Trips] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// GET ACTIVE TRIP
// ============================

/**
 * GET /api/trips/active/:tripId
 * Get active trip details for tracking
 */
exports.getActiveTrip = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber currentLocation")
      .populate("parentId", "name surname phone");

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    if (trip.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Trip is not currently active",
      });
    }

    return res.json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error("[Get Active Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// UPDATE TRIP STATUS (GENERIC)
// ============================

/**
 * PUT /api/trips/:id/status
 * Generic trip status update
 */
exports.updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = ["pending", "accepted", "declined", "in-progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const trip = await Trip.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    console.log(`[Update Trip Status] Trip ${id} status updated to ${status}`);

    return res.json({
      success: true,
      message: "Trip status updated successfully",
      trip,
    });
  } catch (error) {
    console.error("[Update Trip Status] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// DELETE TRIP
// ============================

/**
 * DELETE /api/trips/:id
 * Delete a trip
 */
exports.deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findByIdAndDelete(id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    console.log(`[Delete Trip] Trip ${id} deleted`);

    return res.json({
      success: true,
      message: "Trip deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================
// REQUEST TRIP (LEGACY)
// ============================

/**
 * POST /api/trips/request
 * Legacy trip request endpoint
 */
exports.requestTrip = async (req, res) => {
  try {
    // Redirect to createTrip with pending status
    req.body.status = "pending";
    return exports.createTrip(req, res);
  } catch (error) {
    console.error("[Request Trip] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
