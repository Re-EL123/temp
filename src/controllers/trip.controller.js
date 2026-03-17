const Trip = require("../models/trip.model");
const Child = require("../models/Child");
const Driver = require("../models/Driver");
const { getIO } = require("../socket");
const { sendPushNotification } = require("../services/notification.service");
const mongoose = require("mongoose");

/**
 * ==========================================
 * PARENT TRIP MANAGEMENT
 * ==========================================
 */

/**
 * @desc Request or Book a new trip (Marketplace)
 * Creates a trip request that is visible to all verified drivers in the system.
 * @route POST /api/trips/request
 * @param {Array} children - Array of child IDs or child objects to be picked up.
 * @param {Object} pickupLocation - GeoJSON coordinates and address.
 * @param {Object} dropoffLocation - GeoJSON coordinates and address.
 */
exports.requestTrip = async (req, res) => {
  try {
    const {
      childIds,
      children,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      scheduledDate,
      selectedDays,
      instructions
    } = req.body;

    // Supports both raw IDs and object lists from various frontend formats
    const finalChildIds = childIds || (children && children.map(c => c.childId || c._id || c)) || [];

    if (!finalChildIds || !Array.isArray(finalChildIds) || finalChildIds.length === 0) {
      return res.status(400).json({ message: "At least one child must be selected" });
    }

    if (!tripType || !pickupLocation || !dropoffLocation || !pickupTime || !scheduledDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const trip = await Trip.create({
      parent: req.user.id,
      children: finalChildIds,
      tripType,
      pickupLocation: {
        coordinates: pickupLocation.coordinates || [0, 0],
        address: pickupLocation.address
      },
      dropoffLocation: {
        coordinates: dropoffLocation.coordinates || [0, 0],
        address: dropoffLocation.address
      },
      scheduledDate,
      pickupTime,
      instructions: instructions,
      recurringSchedule: {
        days: selectedDays || [],
        startDate: scheduledDate
      },
      status: "pending_assignment"
    });

    const populatedTrip = await Trip.findById(trip._id).populate('children');

    // Broadcast the new request to all connected drivers via Socket.IO
    getIO().emit("trip:new", populatedTrip);

    res.status(201).json({ success: true, message: "Trip request submitted successfully", trip: populatedTrip });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] Request Trip Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Create a Direct Once-Off Trip
 * Assigns a specific driver to a trip immediately.
 * Handles BOTH legacy format and new CreateOnceOffScreen format.
 * @route POST /api/trips/create
 */
exports.createTrip = async (req, res) => {
  try {
    const {
      driverId,
      driverName,
      driverVehicle,
      parentId,
      parentName,
      date,
      pickupTime,
      pickupLocation,
      dropoffLocation,
      activity,
      instructions,
      children,
      fare,
      fareBreakdown,
      route,
      estimatedDuration,
      estimatedDistance,
      tripType,
    } = req.body;

    // ─── Resolve driver ID ──────────────────────────────────
    const resolvedDriverId = driverId;
    if (!resolvedDriverId) {
      return res.status(400).json({ success: false, message: "Missing required field: driverId" });
    }

    // ─── Resolve children ───────────────────────────────────
    // Frontend may send children as objects with childId, or as plain IDs
    let childIds = [];
    let childrenDetails = [];

    if (children && Array.isArray(children) && children.length > 0) {
      children.forEach(c => {
        // Extract the ObjectId if it's a valid one
        const cId = c.childId || c._id || c;
        if (mongoose.Types.ObjectId.isValid(cId)) {
          childIds.push(cId);
        }
        // Store embedded details for display purposes
        if (typeof c === 'object') {
          childrenDetails.push({
            childId: mongoose.Types.ObjectId.isValid(c.childId || c._id) ? (c.childId || c._id) : undefined,
            childName: c.childName || c.name || "",
            school: c.school || c.schoolName || "",
            homeAddress: c.homeAddress || "",
            schoolAddress: c.schoolAddress || "",
            parentContact: c.parentContact || "",
          });
        }
      });
    }

    if (childIds.length === 0 && childrenDetails.length === 0) {
      return res.status(400).json({ success: false, message: "At least one child must be included" });
    }

    const studentCount = childIds.length || childrenDetails.length || 1;

    // ─── Resolve pickup/dropoff coordinates ─────────────────
    // Frontend sends { latitude, longitude, address }
    // Model expects GeoJSON { coordinates: [lng, lat], address }
    const pickupCoords = pickupLocation?.coordinates
      ? pickupLocation.coordinates
      : [
          pickupLocation?.longitude || 0,
          pickupLocation?.latitude || 0
        ];

    const dropoffCoords = dropoffLocation?.coordinates
      ? dropoffLocation.coordinates
      : [
          dropoffLocation?.longitude || 0,
          dropoffLocation?.latitude || 0
        ];

    // ─── Check Driver exists ────────────────────────────────
    const driver = await Driver.findById(resolvedDriverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    // Check Driver Capacity (only if vehicleSeats is defined)
    if (driver.vehicleSeats && (driver.assignedStudents || 0) + studentCount > driver.vehicleSeats) {
      return res.status(400).json({
        success: false,
        message: `Driver capacity exceeded. Available seats: ${driver.vehicleSeats - (driver.assignedStudents || 0)}`
      });
    }

    // ─── Create the trip ────────────────────────────────────
    const trip = await Trip.create({
      parent: parentId || req.user.id,
      parentName: parentName || "",
      children: childIds.length > 0 ? childIds : undefined,
      childrenDetails: childrenDetails.length > 0 ? childrenDetails : undefined,
      driver: resolvedDriverId,
      driverName: driverName || "",
      driverVehicle: driverVehicle || "",
      tripType: tripType || "once-off",
      status: "pending",
      pickupLocation: {
        type: 'Point',
        coordinates: pickupCoords,
        address: pickupLocation?.address || "",
      },
      dropoffLocation: {
        type: 'Point',
        coordinates: dropoffCoords,
        address: dropoffLocation?.address || "",
      },
      scheduledDate: date ? new Date(date) : new Date(),
      pickupTime: pickupTime || "",
      activity: activity || "",
      instructions: instructions || "",
      fare: fareBreakdown?.total || fare || 0,
      fareBreakdown: fareBreakdown || {},
      route: route || {},
      estimatedDuration: estimatedDuration || 0,
      estimatedDistance: estimatedDistance || "0",
    });

    // ─── Populate for response ──────────────────────────────
    const populatedTrip = await Trip.findById(trip._id)
      .populate('children')
      .populate({
        path: 'driver',
        populate: { path: 'userId', select: 'name surname phone' }
      });

    // ─── Update driver capacity ─────────────────────────────
    if (driver.vehicleSeats) {
      await Driver.findByIdAndUpdate(resolvedDriverId, {
        $inc: { assignedStudents: studentCount }
      });
    }

    // ─── Notify driver ──────────────────────────────────────
    try {
      getIO().emit("trip:new", populatedTrip);

      if (driver && driver.userId) {
        await sendPushNotification(driver.userId, {
          title: "New Trip Request 🚗",
          body: `You have a new trip request for ${pickupTime} at ${pickupLocation?.address || "pickup location"}`,
          data: { tripId: trip._id, type: 'NEW_TRIP' }
        });
      }
    } catch (notifError) {
      console.error("[TRIP_CONTROLLER] Notification error (non-fatal):", notifError.message);
    }

    console.log(`[TRIP_CONTROLLER] Trip created: ${trip._id} | Parent: ${parentName || req.user.id} → Driver: ${driverName || resolvedDriverId}`);

    res.status(201).json({
      success: true,
      message: "Trip created successfully",
      trip: populatedTrip,
      tripId: trip._id,
    });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] Create Trip Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Get User's Ride History (Parents)
 * Retrieves all trips associated with the authenticated parent user.
 * @route GET /api/trips/history
 */
exports.getParentRideHistory = async (req, res) => {
  try {
    const parentId = req.user.id;
    const history = await Trip.find({ parent: parentId })
      .populate('children', 'name surname schoolName schoolAddress age gender grade')
      .populate({
        path: 'driver',
        populate: {
          path: 'userId',
          select: 'name surname phone profilePhoto'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, history });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] History Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Unified endpoint to get trips for the authenticated user (Parent or Driver)
 * Used by mobile and web frontends to populate trip history and current trips.
 * @route GET /api/trips/user-trips
 */
exports.getUserTrips = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let query = {};
    if (role === 'driver') {
      // Find trips assigned to this driver
      query = { driver: userId };
    } else {
      // Default to finding trips requested by this parent
      query = { parent: userId };
    }

    const trips = await Trip.find(query)
      .populate('children', 'name surname schoolName schoolAddress age gender grade photoUrl')
      .populate({
        path: 'driver',
        populate: {
          path: 'userId',
          select: 'name surname phone profilePhoto'
        }
      })
      .populate({
        path: 'parent',
        select: 'name surname phone profilePhoto'
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: trips.length, trips });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] User Trips Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


/**
 * ==========================================
 * TRIP STATUS & LIVE TRACKING (NEW)
 * ==========================================
 */

/**
 * @desc Get trip status for live tracking polling
 * Called by CreateOnceOffScreen every 8 seconds during tracking step.
 * @route GET /api/trips/:id/status
 */
exports.getTripStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID format",
      });
    }

    const trip = await Trip.findById(id)
      .select(
        "status driverLocation currentLocation pickupLocation dropoffLocation " +
        "driverName driverVehicle fare estimatedDuration parentName " +
        "acceptedAt startedAt completedAt cancelledAt declinedAt " +
        "rating childrenDetails children createdAt"
      )
      .lean();

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Normalize status for frontend (in_progress → in-progress)
    let normalizedStatus = trip.status;
    if (normalizedStatus === 'in_progress') normalizedStatus = 'in-progress';
    if (normalizedStatus === 'assigned') normalizedStatus = 'accepted';

    // Build driver location from either driverLocation or currentLocation
    let driverLoc = trip.driverLocation || null;
    if (!driverLoc && trip.currentLocation && trip.currentLocation.coordinates) {
      const coords = trip.currentLocation.coordinates;
      if (coords[0] !== 0 || coords[1] !== 0) {
        driverLoc = {
          latitude: coords[1],
          longitude: coords[0],
        };
      }
    }

    return res.status(200).json({
      success: true,
      trip: {
        _id: trip._id,
        status: normalizedStatus,
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
    console.error("[TRIP_CONTROLLER] Get trip status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get trip status",
      error: error.message,
    });
  }
};

/**
 * @desc Rate a driver after trip completion
 * Called by CreateOnceOffScreen rating modal.
 * @route POST /api/trips/:id/rate
 */
exports.rateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, driverId } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID format",
      });
    }

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Find the trip
    const trip = await Trip.findById(id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Check if trip is completed
    if (trip.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only rate completed trips",
      });
    }

    // Check if already rated
    if (trip.rating && trip.rating.value) {
      return res.status(400).json({
        success: false,
        message: "Trip has already been rated",
      });
    }

    // Save rating on the trip
    trip.rating = {
      value: rating,
      comment: comment || "",
      ratedAt: new Date(),
    };

    await trip.save();

    // ─── Update driver's average rating ───────────────────
    const targetDriverId = driverId || trip.driver;
    if (targetDriverId && mongoose.Types.ObjectId.isValid(targetDriverId)) {
      try {
        // Calculate new average rating from all completed & rated trips
        const ratedTrips = await Trip.find({
          driver: targetDriverId,
          "rating.value": { $exists: true, $ne: null },
        }).select("rating.value");

        if (ratedTrips.length > 0) {
          const totalRating = ratedTrips.reduce(
            (sum, t) => sum + (t.rating?.value || 0),
            0
          );
          const averageRating = parseFloat(
            (totalRating / ratedTrips.length).toFixed(2)
          );

          // Update driver's rating in the Driver model
          await Driver.findByIdAndUpdate(targetDriverId, {
            rating: averageRating,
            totalRatings: ratedTrips.length,
          });

          console.log(
            `[RATING] Driver ${targetDriverId} updated: avg=${averageRating} from ${ratedTrips.length} ratings`
          );
        }
      } catch (driverError) {
        // Don't fail the rating if driver update fails
        console.error("[RATING] Driver rating update error:", driverError);
      }
    }

    console.log(
      `[RATING] Trip ${id} rated: ${rating}/5${comment ? ` — "${comment}"` : ""}`
    );

    return res.status(200).json({
      success: true,
      message: "Rating submitted successfully",
      rating: {
        value: rating,
        comment: comment || "",
        ratedAt: trip.rating.ratedAt,
      },
    });
  } catch (error) {
    console.error("[TRIP_CONTROLLER] Rate trip error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit rating",
      error: error.message,
    });
  }
};

/**
 * @desc Update driver's live location during a trip
 * Used by driver app for real-time GPS updates.
 * @route PATCH /api/trips/:id/driver-location
 */
exports.updateTripDriverLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID format",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const trip = await Trip.findByIdAndUpdate(
      id,
      {
        driverLocation: {
          latitude,
          longitude,
          updatedAt: new Date(),
        },
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
      { new: true }
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Also broadcast via socket
    try {
      getIO().to(id).emit("trip:location", {
        latitude,
        longitude,
        timestamp: Date.now(),
      });
    } catch (socketErr) {
      // Non-fatal
    }

    return res.status(200).json({
      success: true,
      message: "Driver location updated",
      driverLocation: trip.driverLocation,
    });
  } catch (error) {
    console.error("[TRIP_CONTROLLER] Update driver location error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update driver location",
      error: error.message,
    });
  }
};


/**
 * ==========================================
 * DRIVER TRIP ACTIONS
 * ==========================================
 */

/**
 * @desc Get Driver's Pending Requests
 * Fetches trips assigned to the driver OR open Marketplace trips waiting for a driver.
 * @route GET /api/trips/requests/:driverId
 */
exports.getDriverRequests = async (req, res) => {
  try {
    const { driverId } = req.params;

    const requests = await Trip.find({
      $or: [
        { driver: driverId, status: "pending" },
        { status: "pending_assignment" }
      ]
    }).populate("children", "name surname schoolName schoolAddress age gender grade photoUrl")
      .populate("parent", "name surname phone profilePhoto")
      .sort({ createdAt: -1 });

    // Format for frontend mapping expectation
    const formattedRequests = requests.map(trip => ({
      _id: trip._id,
      parentName: trip.parentName || `${trip.parent?.name || ''} ${trip.parent?.surname || ''}`.trim(),
      pickupLocation: {
        address: trip.pickupLocation.address,
        latitude: trip.pickupLocation.coordinates[1],
        longitude: trip.pickupLocation.coordinates[0]
      },
      dropoffLocation: {
        address: trip.dropoffLocation.address,
        latitude: trip.dropoffLocation.coordinates[1],
        longitude: trip.dropoffLocation.coordinates[0]
      },
      pickupTime: trip.pickupTime,
      date: trip.scheduledDate,
      fare: trip.fare || 0,
      estimatedDistance: trip.estimatedDistance || "0",
      estimatedDuration: trip.estimatedDuration || 0,
      children: (trip.childrenDetails && trip.childrenDetails.length > 0)
        ? trip.childrenDetails.map(c => ({ childName: c.childName }))
        : (trip.children || []).map(c => ({ childName: c.name })),
      status: trip.status,
      createdAt: trip.createdAt
    }));

    res.json({ success: true, requests: formattedRequests });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] getDriverRequests Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Get Driver's Upcoming & Active Trips
 * @route GET /api/trips/upcoming/:driverId
 */
exports.getUpcomingTrips = async (req, res) => {
  try {
    const { driverId } = req.params;

    const trips = await Trip.find({
      driver: driverId,
      status: { $in: ["assigned", "accepted", "in_progress", "in-progress"] }
    }).populate("children", "name surname schoolName schoolAddress age gender grade photoUrl")
      .populate("parent", "name surname phone profilePhoto")
      .sort({ scheduledDate: 1, pickupTime: 1 });

    const formattedTrips = trips.map(trip => ({
      _id: trip._id,
      parentName: trip.parentName || `${trip.parent?.name || ''} ${trip.parent?.surname || ''}`.trim(),
      pickupLocation: { address: trip.pickupLocation.address },
      dropoffLocation: { address: trip.dropoffLocation.address },
      pickupTime: trip.pickupTime,
      date: trip.scheduledDate,
      fare: trip.fare || 0,
      status: trip.status,
      children: (trip.childrenDetails && trip.childrenDetails.length > 0)
        ? trip.childrenDetails.map(c => ({ childName: c.childName }))
        : (trip.children || []).map(c => ({ childName: c.name })),
      startedAt: trip.startedAt,
      completedAt: trip.completedAt
    }));

    res.json({ success: true, trips: formattedTrips });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] getUpcomingTrips Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Accept a Trip Request
 * Claims a marketplace trip or accepts a direct booking.
 * @route PATCH /api/trips/accept/:id
 */
exports.acceptTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    // Handle Marketplace claiming logic
    if (trip.status === "pending_assignment" || !trip.driver) {
      const driver = await Driver.findOne({ userId: req.user.id });
      if (!driver) {
        return res.status(403).json({ success: false, message: "Only verified drivers can accept trips" });
      }

      // Check Capacity
      const studentCount = trip.children ? trip.children.length : (trip.childrenDetails ? trip.childrenDetails.length : 1);
      if (driver.vehicleSeats && (driver.assignedStudents || 0) + studentCount > driver.vehicleSeats) {
        return res.status(400).json({
          success: false,
          message: "You have exceeded your vehicle capacity. Please complete other trips first."
        });
      }

      trip.driver = driver._id;

      // Increment capacity
      if (driver.vehicleSeats) {
        await Driver.findByIdAndUpdate(driver._id, {
          $inc: { assignedStudents: studentCount }
        });
      }
    }

    trip.status = "assigned";
    trip.acceptedAt = new Date();
    await trip.save();

    // Notify Parent via Push and Socket
    try {
      await sendPushNotification(trip.parent, {
        title: "Trip Accepted ✅",
        body: "A driver has accepted your trip request!",
        data: { tripId: trip._id, type: 'TRIP_ACCEPTED' }
      });
      getIO().to(trip.parent.toString()).emit("trip_accepted", { tripId: id });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Accept notification error:", notifErr.message);
    }

    res.json({ success: true, message: "Trip accepted successfully", trip });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Decline/Reject a Trip Request
 * Releases the trip back to the Marketplace for other drivers.
 * @route PATCH /api/trips/decline/:id
 */
exports.declineTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    // Release Capacity if driver was assigned
    if (trip.driver && (trip.status === "assigned" || trip.status === "pending")) {
      const studentCount = trip.children ? trip.children.length : (trip.childrenDetails ? trip.childrenDetails.length : 1);
      const driver = await Driver.findById(trip.driver);
      if (driver && driver.vehicleSeats) {
        await Driver.findByIdAndUpdate(trip.driver, {
          $inc: { assignedStudents: -studentCount }
        });
      }
    }

    trip.status = "declined";
    trip.declinedAt = new Date();
    trip.driver = null;
    await trip.save();

    try {
      await sendPushNotification(trip.parent, {
        title: "Trip Declined ❌",
        body: "The driver was unable to accept your trip. We are looking for another one.",
        data: { tripId: trip._id, type: 'TRIP_DECLINED' }
      });
      getIO().to(trip.parent.toString()).emit("trip_declined", { tripId: id });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Decline notification error:", notifErr.message);
    }

    res.json({ success: true, message: "Trip declined successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Start the Trip Execution
 * Notifies the parent and enables live tracking.
 * @route PATCH /api/trips/start/:id
 */
exports.startTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findByIdAndUpdate(
      id,
      { status: "in_progress", startedAt: new Date() },
      { new: true }
    );

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    try {
      await sendPushNotification(trip.parent, {
        title: "Trip Started 🚀",
        body: "Your child's trip has started. Track it live now!",
        data: { tripId: trip._id, type: 'TRIP_STARTED' }
      });
      getIO().to(trip._id.toString()).to(trip.parent.toString()).emit("trip_started", { tripId: id });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Start notification error:", notifErr.message);
    }

    res.json({ success: true, message: "Trip started", trip });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Mark Trip as Completed
 * Handles fare calculation and driver wallet updates.
 * @route PATCH /api/trips/complete/:id
 */
exports.completeTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualFare } = req.body;

    const trip = await Trip.findByIdAndUpdate(
      id,
      {
        status: "completed",
        completedAt: new Date(),
        actualFare: actualFare || undefined
      },
      { new: true }
    );

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    // Settle Driver Finances & Capacity
    if (trip.driver) {
      const studentCount = trip.children ? trip.children.length : (trip.childrenDetails ? trip.childrenDetails.length : 1);
      const fareAmount = actualFare || trip.fare || 0;

      const driver = await Driver.findById(trip.driver);
      if (driver) {
        const updateData = {};
        if (driver.vehicleSeats) {
          updateData.$inc = {
            assignedStudents: -studentCount,
            walletBalance: fareAmount
          };
        } else {
          updateData.$inc = { walletBalance: fareAmount };
        }
        await Driver.findByIdAndUpdate(trip.driver, updateData);
      }
    }

    try {
      await sendPushNotification(trip.parent, {
        title: "Trip Completed 🏁",
        body: "Your child has reached their destination safely.",
        data: { tripId: trip._id, type: 'TRIP_COMPLETED' }
      });
      getIO().to(trip._id.toString()).to(trip.parent.toString()).emit("trip_completed", { tripId: id });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Complete notification error:", notifErr.message);
    }

    res.json({ success: true, message: "Trip completed", trip });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * ==========================================
 * LIVE TRACKING & UTILS
 * ==========================================
 */

/**
 * @desc Update Live Driver Location (legacy endpoint)
 * Used by the driver application during 'in_progress' trips to broadcast GPS data.
 * @route POST /api/trips/location
 */
exports.updateDriverLocation = async (req, res) => {
  try {
    const { tripId, latitude, longitude, heading, speed } = req.body;

    if (!tripId || !latitude || !longitude) {
      return res.status(400).json({ message: "Missing location data" });
    }

    // Persist latest location in DB for map initial loads
    await Trip.findByIdAndUpdate(tripId, {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
        heading: heading || 0,
        speed: speed || 0
      },
      driverLocation: {
        latitude,
        longitude,
        updatedAt: new Date(),
      },
    });

    // Real-time broadcast to the specific trip channel for parent's map
    getIO().to(tripId).emit("trip:location", {
      latitude,
      longitude,
      heading,
      speed,
      timestamp: Date.now()
    });

    res.json({ message: "Location updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ==========================================
 * ADMIN TRIP MONITORING
 * ==========================================
 */

/**
 * @desc Admin View of all Trips
 * @route GET /api/admin/trips
 */
exports.getTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("children", "name surname schoolName schoolAddress age gender grade")
      .populate({
        path: 'driver',
        populate: {
          path: 'userId',
          select: 'name surname phone email profilePhoto'
        }
      });

    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * @desc Manually Assign Driver to a Trip
 * @route POST /api/trips/assign-driver
 */
exports.assignDriverToTrip = async (req, res) => {
  try {
    const { tripId, driverId } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

    // Check Capacity
    const studentCount = trip.children ? trip.children.length : (trip.childrenDetails ? trip.childrenDetails.length : 1);
    if (driver.vehicleSeats && (driver.assignedStudents || 0) + studentCount > driver.vehicleSeats) {
      return res.status(400).json({
        success: false,
        message: `Driver capacity exceeded (Seats: ${driver.vehicleSeats}, Assigned: ${driver.assignedStudents || 0})`
      });
    }

    trip.driver = driverId;
    trip.status = "assigned";
    trip.acceptedAt = new Date();
    await trip.save();

    // Increment Capacity
    if (driver.vehicleSeats) {
      await Driver.findByIdAndUpdate(driverId, {
        $inc: { assignedStudents: studentCount }
      });
    }

    const populatedTrip = await Trip.findById(tripId)
      .populate('children')
      .populate({
        path: 'driver',
        populate: { path: 'userId', select: 'name surname phone' }
      });

    // Notify Parent
    try {
      await sendPushNotification(trip.parent, {
        title: "Driver Assigned 🚗",
        body: "An admin has assigned a driver to your trip.",
        data: { tripId: trip._id, type: 'TRIP_ASSIGNED' }
      });
      getIO().to(trip.parent.toString()).emit("trip_accepted", { tripId: trip._id });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Assign notification error:", notifErr.message);
    }

    // Notify Driver
    try {
      if (driver.userId) {
        await sendPushNotification(driver.userId, {
          title: "New Trip Assignment 📅",
          body: "You have been assigned to a new trip by the administrator.",
          data: { tripId: trip._id, type: 'NEW_TRIP' }
        });
        getIO().emit("trip:new", populatedTrip);
      }
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Assign driver notification error:", notifErr.message);
    }

    res.json({ success: true, message: "Driver assigned successfully", trip: populatedTrip });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] Assign Driver Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Manually Update Trip Status
 * @route PUT /api/trips/:id/status
 */
exports.updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, driverLocation } = req.body;

    const validStatuses = [
      'pending', 'pending_assignment', 'assigned', 'accepted',
      'in_progress', 'in-progress', 'completed', 'cancelled', 'declined'
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    // Handle Capacity Release on Cancellation
    if ((status === 'cancelled' || status === 'declined') && trip.driver) {
      if (trip.status === 'assigned' || trip.status === 'accepted' || trip.status === 'pending') {
        const studentCount = trip.children ? trip.children.length : (trip.childrenDetails ? trip.childrenDetails.length : 1);
        const driver = await Driver.findById(trip.driver);
        if (driver && driver.vehicleSeats) {
          await Driver.findByIdAndUpdate(trip.driver, {
            $inc: { assignedStudents: -studentCount }
          });
        }
      }
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      switch (status) {
        case 'accepted':
        case 'assigned':
          updateData.acceptedAt = new Date();
          break;
        case 'in_progress':
        case 'in-progress':
          updateData.startedAt = new Date();
          break;
        case 'completed':
          updateData.completedAt = new Date();
          break;
        case 'cancelled':
          updateData.cancelledAt = new Date();
          break;
        case 'declined':
          updateData.declinedAt = new Date();
          break;
      }
    }

    // Update driver location if provided
    if (driverLocation && driverLocation.latitude && driverLocation.longitude) {
      updateData.driverLocation = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        updatedAt: new Date(),
      };
    }

    const updatedTrip = await Trip.findByIdAndUpdate(id, updateData, { new: true });

    // Notify Parent
    try {
      await sendPushNotification(trip.parent, {
        title: "Trip Status Updated 📢",
        body: `Your trip status has been updated to: ${status}`,
        data: { tripId: trip._id, type: 'STATUS_UPDATE' }
      });
      getIO().to(trip.parent.toString()).emit("trip_status_updated", { tripId: id, status });
    } catch (notifErr) {
      console.error("[TRIP_CONTROLLER] Status update notification error:", notifErr.message);
    }

    res.json({ success: true, message: `Trip status updated to ${status}`, trip: updatedTrip });
  } catch (err) {
    console.error("[TRIP_CONTROLLER] Update Status Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * @desc Get all trips for a specific parent by parentId
 * @route GET /api/trips/parent/:parentId
 */
exports.getParentTrips = async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent ID format",
      });
    }

    const trips = await Trip.find({ parent: parentId })
      .populate('children', 'name surname schoolName schoolAddress age gender grade')
      .populate({
        path: 'driver',
        populate: {
          path: 'userId',
          select: 'name surname phone profilePhoto'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      trips: trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[TRIP_CONTROLLER] Get parent trips error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get trips",
      error: error.message,
    });
  }
};

/**
 * @desc Get all trips for a specific driver by driverId
 * @route GET /api/trips/driver-trips/:driverId
 */
exports.getDriverTrips = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID format",
      });
    }

    const trips = await Trip.find({ driver: driverId })
      .populate('children', 'name surname schoolName schoolAddress age gender grade')
      .populate({
        path: 'parent',
        select: 'name surname phone profilePhoto'
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      trips: trips,
      count: trips.length,
    });
  } catch (error) {
    console.error("[TRIP_CONTROLLER] Get driver trips error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get trips",
      error: error.message,
    });
  }
};

/**
 * @desc Force Delete a Trip
 * @route DELETE /api/admin/trips/:id
 */
exports.deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;
    await Trip.findByIdAndDelete(id);
    getIO().emit("trip:deleted", id);
    res.json({ message: "Trip deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
