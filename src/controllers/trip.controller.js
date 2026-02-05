const Trip = require("../models/trip");
const Child = require("../models/child");
const Driver = require("../models/driver");
const { getIO } = require("../socket");

/**
 * ============================
 * PARENT: REQUEST / BOOK TRIP
 * ============================
 */
exports.requestTrip = async (req, res) => {
  try {
    const {
      childId,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      notes
    } = req.body;

    if (!childId || !tripType || !pickupLocation || !dropoffLocation || !pickupTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const trip = await Trip.create({
      parentId: req.user.id,
      childId,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      notes,
      status: "pending"
    });

    getIO().emit("trip:new", trip);

    res.status(201).json({ message: "Trip requested successfully", trip });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * ADMIN: ASSIGN DRIVER
 * ============================
 */
exports.assignDriverToTrip = async (req, res) => {
  try {
    const { tripId, driverId } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.assignedStudents >= driver.vehicleSeats) {
      return res.status(400).json({ message: "Driver has no available seats" });
    }

    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { driverId, status: "assigned" },
      { new: true }
    );

    driver.assignedStudents += 1;
    await driver.save();

    getIO().to(tripId).emit("trip:assigned", trip);

    res.json({ message: "Driver assigned successfully", trip });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * DRIVER: GET ASSIGNED TRIPS
 * ============================
 */
exports.getDriverTrips = async (req, res) => {
  try {
    const trips = await Trip.find({
      driverId: req.user.id,
      status: { $in: ["assigned", "in_progress"] }
    }).populate("childId");

    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * DRIVER: UPDATE TRIP STATUS
 * ============================
 */
exports.updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["assigned", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid trip status" });
    }

    const trip = await Trip.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    getIO().to(id).emit("trip:status", {
      tripId: id,
      status
    });

    res.json({ message: "Trip status updated successfully", trip });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * DRIVER: SEND LIVE LOCATION
 * ============================
 */
exports.updateDriverLocation = async (req, res) => {
  try {
    const { tripId, latitude, longitude } = req.body;

    if (!tripId || !latitude || !longitude) {
      return res.status(400).json({ message: "Missing location data" });
    }

    getIO().to(tripId).emit("trip:location", {
      latitude,
      longitude,
      timestamp: Date.now()
    });

    res.json({ message: "Location updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * CREATE TRIP (ADMIN/DRIVER)
 * ============================
 */
exports.createTrip = async (req, res) => {
  try {
    const {
      parentId,
      childId,
      driverId,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      notes
    } = req.body;

    if (!childId || !tripType || !pickupLocation || !dropoffLocation || !pickupTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const trip = await Trip.create({
      parentId: parentId || req.user.id,
      childId,
      driverId,
      tripType,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      status: "pending",
      notes
    });

    getIO().emit("trip:created", trip);

    res.status(201).json({ message: "Trip created successfully", trip });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * ADMIN: GET ALL TRIPS
 * ============================
 */
exports.getTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("childId")
      .populate("driverId");

    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * ============================
 * ADMIN: DELETE TRIP
 * ============================
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
