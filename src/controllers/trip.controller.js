// src/controllers/trip.controller.js
// ═══════════════════════════════════════════════════════════════
// UNIFIED TRIP CONTROLLER
//
// Design principles (matching original working system):
//   • parentId / driverId store User._id
//   • Locations use { latitude, longitude, address }
//   • Status uses kebab-case "in-progress"
//   • Actions use PUT /api/trips/:id/action
//   • Socket.IO for real-time events
//   • Optional push notifications & Driver capacity
// ═══════════════════════════════════════════════════════════════

const Trip = require("../models/Trip");
const User = require("../models/user");
const { getIO } = require("../socket");
const mongoose = require("mongoose");

// ─── Optional imports (graceful if missing) ───────────────────
let Driver = null;
let Child = null;
let pushService = null;

try { Driver = require("../models/Driver"); } catch (_) {}
try { Child = require("../models/Child"); } catch (_) {}
try { pushService = require("../services/notification.service"); } catch (_) {}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate fare based on distance (meters) and duration (seconds)
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
      console.log(`[Socket] Sent → ${userId}: ${event}`);
    }
  } catch (error) {
    console.error("[Socket] Failed:", error.message);
  }
};

/**
 * Send push notification (optional — no-ops if service is missing)
 */
const sendPush = async (userId, payload) => {
  try {
    if (pushService && pushService.sendPushNotification) {
      await pushService.sendPushNotification(userId, payload);
    }
  } catch (err) {
    console.error("[Push] Failed:", err.message);
  }
};

/**
 * Look up the Driver document for a User ID (for capacity / wallet)
 * Returns null if Driver model is not available
 */
const findDriverDoc = async (userId) => {
  if (!Driver) return null;
  try {
    return await Driver.findOne({ userId });
  } catch (_) {
    return null;
  }
};

/**
 * Update Driver model capacity (increment or decrement assigned students)
 */
const updateDriverCapacity = async (userId, delta) => {
  if (!Driver) return;
  try {
    const doc = await Driver.findOne({ userId });
    if (doc && doc.vehicleSeats) {
      await Driver.findByIdAndUpdate(doc._id, {
        $inc: { assignedStudents: delta },
      });
    }
  } catch (_) {}
};

/**
 * Count how many children are on a trip
 */
const childCount = (trip) =>
  trip.children && trip.children.length > 0 ? trip.children.length : 1;

// ═══════════════════════════════════════════════════════════════
//  1. CREATE TRIP
// ═══════════════════════════════════════════════════════════════

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
      fareBreakdown,
      estimatedDuration,
      estimatedDistance,
    } = req.body;

    // ── Validation ────────────────────────────────────────
    if (
      !parentId ||
      !driverId ||
      !pickupLocation ||
      !dropoffLocation ||
      !date ||
      !pickupTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: parentId, driverId, pickupLocation, dropoffLocation, date, pickupTime",
      });
    }

    // Verify parent exists
    const parent = await User.findById(parentId);
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "Parent not found" });
    }

    // Verify driver exists and is active
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    if (!driver.isActive || !driver.onboardingCompleted) {
      return res
        .status(400)
        .json({ success: false, message: "Driver is not available" });
    }

    // ── Check Driver capacity (optional) ─────────────────
    const driverDoc = await findDriverDoc(driverId);
    const studentCount =
      children && children.length > 0 ? children.length : 1;
    if (driverDoc && driverDoc.vehicleSeats) {
      const available =
        driverDoc.vehicleSeats - (driverDoc.assignedStudents || 0);
      if (studentCount > available) {
        return res.status(400).json({
          success: false,
          message: `Driver capacity exceeded. Available seats: ${available}`,
        });
      }
    }

    // ── Calculate fare ───────────────────────────────────
    const calculatedFare =
      fare ||
      (fareBreakdown && fareBreakdown.total) ||
      (route && route.distance && route.duration
        ? calculateFare(route.distance, route.duration)
        : 0);

    // ── Create trip ──────────────────────────────────────
    const newTrip = new Trip({
      tripType: tripType || "once-off",
      parentId,
      parentName: parentName || `${parent.name} ${parent.surname}`,
      driverId,
      driverName:
        driverName || `${driver.name} ${driver.surname}`,
      driverVehicle:
        driverVehicle ||
        `${driver.carBrand || ""} ${driver.carModel || ""} - ${
          driver.registrationNumber || ""
        }`.trim(),
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
      fareBreakdown: fareBreakdown || {},
      estimatedDuration:
        estimatedDuration || Math.ceil((route?.duration || 0) / 60),
      estimatedDistance:
        estimatedDistance || ((route?.distance || 0) / 1000).toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newTrip.save();

    // ── Update Driver capacity ───────────────────────────
    await updateDriverCapacity(driverId, studentCount);

    console.log(
      `[Create Trip] Trip ${newTrip._id} created: ${parent.name} → ${driver.name}`
    );

    // ── Notify driver via Socket + Push ──────────────────
    sendNotification(driverId, "new_trip_request", {
      tripId: newTrip._id,
      parentName: newTrip.parentName,
      pickupLocation: newTrip.pickupLocation,
      dropoffLocation: newTrip.dropoffLocation,
      fare: newTrip.fare,
      date: newTrip.date,
      pickupTime: newTrip.pickupTime,
    });

    await sendPush(driverId, {
      title: "New Trip Request 🚗",
      body: `New trip from ${newTrip.parentName} at ${pickupTime}`,
      data: { tripId: newTrip._id.toString(), type: "NEW_TRIP" },
    });

    return res.status(201).json({
      success: true,
      message: "Trip request sent successfully",
      trip: newTrip,
    });
  } catch (error) {
    console.error("[Create Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * POST /api/trips/request
 * Marketplace request — or redirect to createTrip if driverId is present
 */
exports.requestTrip = async (req, res) => {
  try {
    const {
      driverId,
      parentId,
      parentName,
      childIds,
      children,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      date,
      scheduledDate,
      selectedDays,
      instructions,
      fare,
      route,
      estimatedDuration,
      estimatedDistance,
    } = req.body;

    // If a driver is specified, use the direct createTrip flow
    if (driverId) {
      return exports.createTrip(req, res);
    }

    // ── Marketplace request (no driver yet) ──────────────
    const resolvedParentId = parentId || (req.user && req.user.id);
    if (!resolvedParentId) {
      return res
        .status(400)
        .json({ success: false, message: "parentId is required" });
    }

    const resolvedDate = date || scheduledDate;
    if (!pickupLocation || !dropoffLocation || !pickupTime || !resolvedDate) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Resolve children list
    const resolvedChildren =
      children ||
      (childIds &&
        childIds.map((id) => ({
          childId: id,
          childName: "",
        }))) ||
      [];

    // Resolve parent name
    let resolvedParentName = parentName || "";
    if (!resolvedParentName) {
      const parent = await User.findById(resolvedParentId).select(
        "name surname"
      );
      if (parent) resolvedParentName = `${parent.name} ${parent.surname}`;
    }

    const newTrip = new Trip({
      tripType: tripType || "once-off",
      parentId: resolvedParentId,
      parentName: resolvedParentName,
      driverId: null,
      driverName: "",
      driverVehicle: "",
      date: new Date(resolvedDate),
      pickupTime,
      pickupLocation: {
        latitude: pickupLocation.latitude || 0,
        longitude: pickupLocation.longitude || 0,
        address: pickupLocation.address || "",
      },
      dropoffLocation: {
        latitude: dropoffLocation.latitude || 0,
        longitude: dropoffLocation.longitude || 0,
        address: dropoffLocation.address || "",
      },
      children: resolvedChildren,
      instructions: instructions || "",
      fare: fare || 0,
      route: route || {},
      estimatedDuration: estimatedDuration || 0,
      estimatedDistance: estimatedDistance || "0",
      recurringSchedule: {
        days: selectedDays || [],
        startDate: resolvedDate,
      },
      status: "pending_assignment",
    });

    await newTrip.save();

    console.log(
      `[Request Trip] Marketplace listing ${newTrip._id} by ${resolvedParentName}`
    );

    // Broadcast to ALL connected drivers
    try {
      getIO().emit("trip:new", newTrip);
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: "Trip request submitted to marketplace",
      trip: newTrip,
    });
  } catch (error) {
    console.error("[Request Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. DRIVER QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/trips/requests/:driverId
 * Get all pending trip requests for a driver + marketplace listings
 */
exports.getDriverRequests = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    // Get pending requests for this driver + open marketplace listings
    const requests = await Trip.find({
      $or: [
        { driverId, status: "pending" },
        { status: "pending_assignment" },
      ],
    }).sort({ createdAt: -1 });

    console.log(
      `[Get Driver Requests] Found ${requests.length} pending requests for driver ${driverId}`
    );

    return res.json({
      success: true,
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("[Get Driver Requests] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    // Get accepted / in-progress trips for today or future
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const trips = await Trip.find({
      driverId,
      status: { $in: ["accepted", "in-progress"] },
      date: { $gte: now },
    }).sort({ date: 1, pickupTime: 1 });

    console.log(
      `[Get Upcoming Trips] Found ${trips.length} upcoming trips for driver ${driverId}`
    );

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Upcoming Trips] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/driver-trips/:driverId
 * Get ALL trips for a specific driver (any status)
 */
exports.getDriverTrips = async (req, res) => {
  try {
    const { driverId } = req.params;

    const trips = await Trip.find({ driverId })
      .populate("parentId", "name surname phone profilePhoto")
      .sort({ createdAt: -1 });

    console.log(
      `[Get Driver Trips] Found ${trips.length} total trips for driver ${driverId}`
    );

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Driver Trips] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  3. TRIP STATUS ACTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/trips/:id/accept
 * Driver accepts a trip request (direct or marketplace)
 */
exports.acceptTrip = async (req, res) => {
  try {
    const { id } = req.params;

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Verify trip is in pending or pending_assignment state
    if (trip.status !== "pending" && trip.status !== "pending_assignment") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept trip with status: ${trip.status}`,
      });
    }

    // ── Marketplace claim: assign driver ─────────────────
    if (trip.status === "pending_assignment" || !trip.driverId) {
      const acceptingUserId =
        (req.body && req.body.driverId) ||
        (req.user && req.user.id) ||
        null;

      if (!acceptingUserId) {
        return res.status(400).json({
          success: false,
          message: "driverId is required to claim a marketplace trip",
        });
      }

      const driver = await User.findById(acceptingUserId);
      if (!driver || driver.role !== "driver") {
        return res
          .status(403)
          .json({ success: false, message: "Only drivers can accept trips" });
      }

      // Check capacity
      const driverDoc = await findDriverDoc(acceptingUserId);
      const students = childCount(trip);
      if (driverDoc && driverDoc.vehicleSeats) {
        const available =
          driverDoc.vehicleSeats - (driverDoc.assignedStudents || 0);
        if (students > available) {
          return res.status(400).json({
            success: false,
            message: `Vehicle capacity exceeded. Available: ${available}`,
          });
        }
      }

      trip.driverId = acceptingUserId;
      trip.driverName = `${driver.name} ${driver.surname}`;
      trip.driverVehicle =
        `${driver.carBrand || ""} ${driver.carModel || ""} - ${
          driver.registrationNumber || ""
        }`.trim();

      await updateDriverCapacity(acceptingUserId, students);
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

    await sendPush(trip.parentId, {
      title: "Trip Accepted ✅",
      body: `${trip.driverName} accepted your trip request!`,
      data: { tripId: trip._id.toString(), type: "TRIP_ACCEPTED" },
    });

    return res.json({
      success: true,
      message: "Trip accepted successfully",
      trip,
    });
  } catch (error) {
    console.error("[Accept Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Verify trip is in pending state
    if (trip.status !== "pending" && trip.status !== "pending_assignment") {
      return res.status(400).json({
        success: false,
        message: `Cannot decline trip with status: ${trip.status}`,
      });
    }

    // Release capacity if driver was assigned
    if (trip.driverId) {
      await updateDriverCapacity(trip.driverId, -childCount(trip));
    }

    // Update trip status
    trip.status = "declined";
    trip.declinedAt = new Date();
    trip.declineReason = reason || "Driver declined";
    trip.updatedAt = new Date();
    await trip.save();

    console.log(
      `[Decline Trip] Trip ${id} declined by driver ${trip.driverId}`
    );

    // Notify parent
    sendNotification(trip.parentId, "trip_declined", {
      tripId: trip._id,
      driverName: trip.driverName,
      reason: trip.declineReason,
    });

    await sendPush(trip.parentId, {
      title: "Trip Declined ❌",
      body: "Your driver was unable to accept. We're looking for another.",
      data: { tripId: trip._id.toString(), type: "TRIP_DECLINED" },
    });

    return res.json({
      success: true,
      message: "Trip declined successfully",
      trip,
    });
  } catch (error) {
    console.error("[Decline Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
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

    await sendPush(trip.parentId, {
      title: "Trip Started 🚀",
      body: "Your child's trip has started. Track it live!",
      data: { tripId: trip._id.toString(), type: "TRIP_STARTED" },
    });

    return res.json({
      success: true,
      message: "Trip started successfully",
      trip,
    });
  } catch (error) {
    console.error("[Start Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
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

    // ── Release Driver capacity ──────────────────────────
    if (trip.driverId) {
      await updateDriverCapacity(trip.driverId, -childCount(trip));
    }

    // ── Update driver earnings on User model ─────────────
    const fareAmount = actualFare || trip.fare || 0;
    if (trip.driverId) {
      const driver = await User.findById(trip.driverId);
      if (driver) {
        driver.totalEarnings = (driver.totalEarnings || 0) + fareAmount;
        await driver.save();
      }
    }

    // ── Update Driver wallet (if Driver model exists) ────
    if (Driver && trip.driverId) {
      try {
        await Driver.findOneAndUpdate(
          { userId: trip.driverId },
          { $inc: { walletBalance: fareAmount } }
        );
      } catch (_) {}
    }

    console.log(
      `[Complete Trip] Trip ${id} completed by driver ${trip.driverId}`
    );

    // Notify parent
    sendNotification(trip.parentId, "trip_completed", {
      tripId: trip._id,
      driverName: trip.driverName,
      completedAt: trip.completedAt,
      fare: fareAmount,
    });

    await sendPush(trip.parentId, {
      title: "Trip Completed 🏁",
      body: "Your child has arrived safely!",
      data: { tripId: trip._id.toString(), type: "TRIP_COMPLETED" },
    });

    return res.json({
      success: true,
      message: "Trip completed successfully",
      trip,
    });
  } catch (error) {
    console.error("[Complete Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Cannot cancel completed trips
    if (trip.status === "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot cancel completed trip" });
    }

    // Release capacity if driver was assigned
    if (
      trip.driverId &&
      ["pending", "accepted", "in-progress"].includes(trip.status)
    ) {
      await updateDriverCapacity(trip.driverId, -childCount(trip));
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

    if (trip.driverId) {
      sendNotification(trip.driverId, "trip_cancelled", {
        tripId: trip._id,
        reason: trip.cancellationReason,
        cancelledBy: trip.cancelledBy,
      });
    }

    await sendPush(trip.parentId, {
      title: "Trip Cancelled",
      body: trip.cancellationReason,
      data: { tripId: trip._id.toString(), type: "TRIP_CANCELLED" },
    });

    return res.json({
      success: true,
      message: "Trip cancelled successfully",
      trip,
    });
  } catch (error) {
    console.error("[Cancel Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  4. LIVE TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/trips/:id/location
 * Update driver's current location during trip
 */
exports.updateTripLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, speed, heading } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, message: "Latitude and longitude required" });
    }

    // Find trip
    const trip = await Trip.findById(id);
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Only update location for in-progress trips
    if (trip.status !== "in-progress") {
      return res
        .status(400)
        .json({ success: false, message: "Trip is not in progress" });
    }

    // Update location
    trip.currentLocation = {
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      timestamp: new Date(),
    };
    trip.driverLocation = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };
    trip.updatedAt = new Date();

    await trip.save();

    // Send real-time location update to parent
    sendNotification(trip.parentId, "driver_location_update", {
      tripId: trip._id,
      location: trip.currentLocation,
    });

    // Also broadcast to trip room
    try {
      getIO().to(id).emit("trip:location", {
        latitude,
        longitude,
        heading,
        speed,
        timestamp: Date.now(),
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: "Location updated successfully",
      location: trip.currentLocation,
    });
  } catch (error) {
    console.error("[Update Trip Location] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * POST /api/trips/location
 * Legacy endpoint – update location by tripId in body
 */
exports.updateDriverLocation = async (req, res) => {
  try {
    const { tripId, latitude, longitude, heading, speed } = req.body;

    if (!tripId || !latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, message: "Missing location data" });
    }

    await Trip.findByIdAndUpdate(tripId, {
      currentLocation: {
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: new Date(),
      },
      driverLocation: {
        latitude,
        longitude,
        updatedAt: new Date(),
      },
    });

    // Broadcast to trip room
    try {
      getIO().to(tripId).emit("trip:location", {
        latitude,
        longitude,
        heading,
        speed,
        timestamp: Date.now(),
      });
    } catch (_) {}

    return res.json({ success: true, message: "Location updated" });
  } catch (error) {
    console.error("[Legacy Location Update] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PATCH /api/trips/:id/driver-location
 * Alternative driver location update endpoint
 */
exports.updateTripDriverLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, message: "Latitude and longitude required" });
    }

    const trip = await Trip.findByIdAndUpdate(
      id,
      {
        driverLocation: { latitude, longitude, updatedAt: new Date() },
        currentLocation: { latitude, longitude, timestamp: new Date() },
      },
      { new: true }
    );

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    try {
      getIO().to(id).emit("trip:location", {
        latitude,
        longitude,
        timestamp: Date.now(),
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: "Driver location updated",
      driverLocation: trip.driverLocation,
    });
  } catch (error) {
    console.error("[Driver Location] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/:id/tracking
 * Get trip route and real-time tracking data
 */
exports.getTripTracking = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id)
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber"
      )
      .populate("parentId", "name surname phone");

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    return res.json({
      success: true,
      trip: {
        _id: trip._id,
        status: trip.status,
        pickupLocation: trip.pickupLocation,
        dropoffLocation: trip.dropoffLocation,
        currentLocation: trip.currentLocation,
        driverLocation: trip.driverLocation,
        route: trip.route,
        driver: trip.driverId,
        parent: trip.parentId,
        startedAt: trip.startedAt,
        estimatedArrival: trip.estimatedArrival,
        fare: trip.fare,
        estimatedDuration: trip.estimatedDuration,
      },
    });
  } catch (error) {
    console.error("[Get Trip Tracking] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/:id/status
 * Lightweight status polling (for CreateOnceOffScreen)
 */
exports.getTripStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid trip ID" });
    }

    const trip = await Trip.findById(id)
      .select(
        "status driverLocation currentLocation pickupLocation dropoffLocation " +
          "driverName driverVehicle fare estimatedDuration parentName " +
          "acceptedAt startedAt completedAt cancelledAt declinedAt " +
          "rating children createdAt"
      )
      .lean();

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Build driver location from whichever field is populated
    let driverLoc = null;
    if (trip.driverLocation && trip.driverLocation.latitude) {
      driverLoc = trip.driverLocation;
    } else if (trip.currentLocation && trip.currentLocation.latitude) {
      driverLoc = {
        latitude: trip.currentLocation.latitude,
        longitude: trip.currentLocation.longitude,
      };
    }

    return res.json({
      success: true,
      trip: {
        _id: trip._id,
        status: trip.status,
        driverLocation: driverLoc,
        pickupLocation: trip.pickupLocation,
        dropoffLocation: trip.dropoffLocation,
        driverName: trip.driverName,
        driverVehicle: trip.driverVehicle,
        fare: trip.fare,
        estimatedDuration: trip.estimatedDuration,
        acceptedAt: trip.acceptedAt,
        startedAt: trip.startedAt,
        completedAt: trip.completedAt,
        cancelledAt: trip.cancelledAt,
        declinedAt: trip.declinedAt,
        rating: trip.rating,
        createdAt: trip.createdAt,
      },
    });
  } catch (error) {
    console.error("[Get Trip Status] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  5. TRIP QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/trips
 * Get all trips (with query-string filters)
 *   ?status=pending&userId=xxx&role=driver&startDate=...&endDate=...
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
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber profilePhoto"
      )
      .populate("parentId", "name surname phone email profilePhoto")
      .sort({ createdAt: -1 });

    console.log(
      `[Get Trips] Found ${trips.length} trips with filters:`,
      filter
    );

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Trips] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

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
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber profilePhoto"
      )
      .sort({ createdAt: -1 });

    console.log(
      `[Get Parent Trips] Found ${trips.length} trips for parent ${parentId}`
    );

    return res.json({
      success: true,
      trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[Get Parent Trips] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/history
 * Authenticated parent's ride history
 */
exports.getParentRideHistory = async (req, res) => {
  try {
    const parentId = req.user.id;

    const history = await Trip.find({ parentId })
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber profilePhoto"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Sanitize null driver refs
    const sanitised = history.map((t) => ({
      ...t,
      driverName:
        t.driverName ||
        (t.driverId
          ? `${t.driverId.name} ${t.driverId.surname}`
          : "Unknown Driver"),
    }));

    return res.json({ success: true, history: sanitised });
  } catch (error) {
    console.error("[Ride History] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/user-trips
 * Unified endpoint: returns trips for authenticated user (parent OR driver)
 */
exports.getUserTrips = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Both parentId and driverId store User._id, so this query is correct
    const filter =
      role === "driver" ? { driverId: userId } : { parentId: userId };

    const trips = await Trip.find(filter)
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber profilePhoto"
      )
      .populate("parentId", "name surname phone profilePhoto")
      .sort({ createdAt: -1 });

    return res.json({ success: true, trips, count: trips.length });
  } catch (error) {
    console.error("[User Trips] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/active/:tripId
 * Get active trip details for tracking
 */
exports.getActiveTrip = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber currentLocation"
      )
      .populate("parentId", "name surname phone");

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    if (trip.status !== "in-progress") {
      return res
        .status(400)
        .json({ success: false, message: "Trip is not currently active" });
    }

    return res.json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error("[Get Active Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/trips/:id
 * Get detailed trip information
 */
exports.getTripById = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id)
      .populate(
        "driverId",
        "name surname phone carBrand carModel registrationNumber"
      )
      .populate("parentId", "name surname phone email");

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    return res.json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error("[Get Trip By ID] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  6. RATINGS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/trips/:id/rate
 * Rate a driver after trip completion
 */
exports.rateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid trip ID" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    if (trip.status !== "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Can only rate completed trips" });
    }

    if (trip.rating && trip.rating.value) {
      return res
        .status(400)
        .json({ success: false, message: "Trip has already been rated" });
    }

    trip.rating = {
      value: rating,
      comment: comment || "",
      ratedAt: new Date(),
    };
    trip.updatedAt = new Date();
    await trip.save();

    // ── Update driver's average rating ───────────────────
    if (trip.driverId) {
      try {
        const ratedTrips = await Trip.find({
          driverId: trip.driverId,
          "rating.value": { $exists: true, $ne: null },
        }).select("rating.value");

        if (ratedTrips.length > 0) {
          const total = ratedTrips.reduce(
            (sum, t) => sum + (t.rating?.value || 0),
            0
          );
          const avg = parseFloat((total / ratedTrips.length).toFixed(2));

          // Update on User model
          await User.findByIdAndUpdate(trip.driverId, {
            rating: avg,
            totalRatings: ratedTrips.length,
          });

          // Update on Driver model if available
          if (Driver) {
            try {
              await Driver.findOneAndUpdate(
                { userId: trip.driverId },
                { rating: avg, totalRatings: ratedTrips.length }
              );
            } catch (_) {}
          }

          console.log(
            `[Rating] Driver ${trip.driverId} → avg ${avg} (${ratedTrips.length} ratings)`
          );
        }
      } catch (driverErr) {
        console.error("[Rating] Driver update error:", driverErr.message);
      }
    }

    console.log(
      `[Rating] Trip ${id} rated ${rating}/5${
        comment ? ` — "${comment}"` : ""
      }`
    );

    return res.json({
      success: true,
      message: "Rating submitted successfully",
      rating: trip.rating,
    });
  } catch (error) {
    console.error("[Rate Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  7. ADMIN
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/trips/assign-driver
 * Admin manually assigns a driver to a trip
 */
exports.assignDriverToTrip = async (req, res) => {
  try {
    const { tripId, driverId } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    // Check capacity
    const driverDoc = await findDriverDoc(driverId);
    const students = childCount(trip);
    if (driverDoc && driverDoc.vehicleSeats) {
      const available =
        driverDoc.vehicleSeats - (driverDoc.assignedStudents || 0);
      if (students > available) {
        return res.status(400).json({
          success: false,
          message: `Capacity exceeded. Available: ${available}`,
        });
      }
    }

    // Release old driver capacity if reassigning
    if (
      trip.driverId &&
      trip.driverId.toString() !== driverId &&
      ["pending", "accepted"].includes(trip.status)
    ) {
      await updateDriverCapacity(trip.driverId, -students);
    }

    trip.driverId = driverId;
    trip.driverName = `${driver.name} ${driver.surname}`;
    trip.driverVehicle =
      `${driver.carBrand || ""} ${driver.carModel || ""} - ${
        driver.registrationNumber || ""
      }`.trim();
    trip.status = "accepted";
    trip.acceptedAt = new Date();
    trip.updatedAt = new Date();
    await trip.save();

    await updateDriverCapacity(driverId, students);

    console.log(`[Admin Assign] Trip ${tripId} → Driver ${driverId}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_accepted", {
      tripId: trip._id,
      driverName: trip.driverName,
    });
    await sendPush(trip.parentId, {
      title: "Driver Assigned 🚗",
      body: `${trip.driverName} has been assigned to your trip.`,
      data: { tripId: trip._id.toString(), type: "TRIP_ASSIGNED" },
    });

    // Notify driver
    sendNotification(driverId, "new_trip_request", {
      tripId: trip._id,
      parentName: trip.parentName,
    });
    await sendPush(driverId, {
      title: "New Trip Assignment 📅",
      body: "You have been assigned to a new trip.",
      data: { tripId: trip._id.toString(), type: "NEW_TRIP" },
    });

    return res.json({
      success: true,
      message: "Driver assigned successfully",
      trip,
    });
  } catch (error) {
    console.error("[Assign Driver] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PUT /api/trips/:id/status
 * Generic trip status update (admin or system)
 */
exports.updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, driverLocation } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "Status is required" });
    }

    const validStatuses = [
      "pending",
      "pending_assignment",
      "accepted",
      "declined",
      "in-progress",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Release capacity on cancellation / decline
    if (
      (status === "cancelled" || status === "declined") &&
      trip.driverId &&
      ["pending", "accepted", "in-progress"].includes(trip.status)
    ) {
      await updateDriverCapacity(trip.driverId, -childCount(trip));
    }

    const updateData = { status, updatedAt: new Date() };

    switch (status) {
      case "accepted":
        updateData.acceptedAt = new Date();
        break;
      case "in-progress":
        updateData.startedAt = new Date();
        break;
      case "completed":
        updateData.completedAt = new Date();
        break;
      case "cancelled":
        updateData.cancelledAt = new Date();
        break;
      case "declined":
        updateData.declinedAt = new Date();
        break;
    }

    if (
      driverLocation &&
      driverLocation.latitude &&
      driverLocation.longitude
    ) {
      updateData.driverLocation = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        updatedAt: new Date(),
      };
    }

    const updatedTrip = await Trip.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    console.log(`[Update Trip Status] Trip ${id} status updated to ${status}`);

    // Notify parent
    sendNotification(trip.parentId, "trip_status_updated", {
      tripId: id,
      status,
    });
    await sendPush(trip.parentId, {
      title: "Trip Updated 📢",
      body: `Your trip status: ${status}`,
      data: { tripId: id, type: "STATUS_UPDATE" },
    });

    return res.json({
      success: true,
      message: "Trip status updated successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("[Update Trip Status] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * DELETE /api/trips/:id
 * Delete a trip
 */
exports.deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found" });
    }

    // Release capacity if needed
    if (
      trip.driverId &&
      ["pending", "accepted", "in-progress"].includes(trip.status)
    ) {
      await updateDriverCapacity(trip.driverId, -childCount(trip));
    }

    await Trip.findByIdAndDelete(id);

    console.log(`[Delete Trip] Trip ${id} deleted`);

    try {
      getIO().emit("trip:deleted", id);
    } catch (_) {}

    return res.json({
      success: true,
      message: "Trip deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Trip] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
