const Driver = require("../models/Driver");
const User = require("../models/user");

// ═══════════════════════════════════════════════════════════════
//  GET AVAILABLE DRIVERS (standalone controller version)
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Get all available drivers
 * This is a simpler version — the main endpoint is in userRoutes.js
 * at GET /api/user/drivers/available
 *
 * This controller can be used for admin views or alternate routes.
 *
 * @route GET /api/drivers/available
 */
exports.getAvailableDrivers = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const parentLat = lat ? parseFloat(lat) : null;
    const parentLng = lng ? parseFloat(lng) : null;

    // ── Get all drivers from Driver model ────────────────
    const drivers = await Driver.find({})
      .populate("userId", "name surname phone email profilePhoto latitude longitude isActive status")
      .lean();

    // Filter out drivers where user population failed
    const validDrivers = drivers.filter((d) => d.userId);

    console.log(
      `[Driver Controller] Found ${validDrivers.length} valid drivers`
    );

    // ── Enrich with coordinates and distance ────────────
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const enriched = validDrivers.map((d) => {
      // Resolve coordinates from all sources
      let driverLat = 0;
      let driverLng = 0;

      // Source 1: User model (set by driver dashboard)
      if (d.userId.latitude && d.userId.longitude) {
        driverLat = d.userId.latitude;
        driverLng = d.userId.longitude;
      }
      // Source 2: Driver model GeoJSON
      else if (
        d.location &&
        d.location.coordinates &&
        Array.isArray(d.location.coordinates) &&
        d.location.coordinates.length === 2
      ) {
        driverLng = d.location.coordinates[0];
        driverLat = d.location.coordinates[1];
      }
      // Source 3: Driver model direct fields
      else if (d.latitude && d.longitude) {
        driverLat = d.latitude;
        driverLng = d.longitude;
      }

      // Calculate distance
      let distance = 999;
      if (
        parentLat &&
        parentLng &&
        driverLat &&
        driverLng &&
        !(driverLat === 0 && driverLng === 0)
      ) {
        distance = parseFloat(
          haversine(parentLat, parentLng, driverLat, driverLng).toFixed(2)
        );
      }

      return {
        ...d,
        latitude: driverLat,
        longitude: driverLng,
        distance,
        // Merge user fields for frontend compatibility
        name: `${d.userId.name || ""} ${d.userId.surname || ""}`.trim(),
        isActive: d.userId.isActive || d.isActive || false,
        available: true,
      };
    });

    // Sort by distance
    enriched.sort((a, b) => a.distance - b.distance);

    console.log(
      `[Driver Controller] Returning ${enriched.length} drivers`
    );

    res.json({
      success: true,
      count: enriched.length,
      drivers: enriched,
    });
  } catch (err) {
    console.error("[Driver Controller] Error fetching drivers:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * @desc Get driver by User ID
 * Used by DriverDashboard to resolve Driver._id from User._id
 * @route GET /api/drivers/by-user/:userId
 */
exports.getDriverByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const driver = await Driver.findOne({ userId })
      .populate(
        "userId",
        "name surname phone email profilePhoto latitude longitude isActive status"
      )
      .lean();

    if (!driver) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    res.json({ success: true, driver });
  } catch (err) {
    console.error("[Driver Controller] getDriverByUserId Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * @desc Get driver details by Driver._id
 * @route GET /api/drivers/:id
 */
exports.getDriverById = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id)
      .populate(
        "userId",
        "name surname phone email profilePhoto latitude longitude isActive status"
      )
      .lean();

    if (!driver) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    res.json({ success: true, driver });
  } catch (err) {
    console.error("[Driver Controller] getDriverById Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * @desc Get all drivers (admin view)
 * @route GET /api/drivers
 */
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({})
      .populate(
        "userId",
        "name surname phone email profilePhoto latitude longitude isActive status onboardingCompleted"
      )
      .sort({ createdAt: -1 })
      .lean();

    const validDrivers = drivers.filter((d) => d.userId);

    res.json({
      success: true,
      count: validDrivers.length,
      drivers: validDrivers,
    });
  } catch (err) {
    console.error("[Driver Controller] getAllDrivers Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * @desc Update driver location (called by driver app)
 * Updates BOTH User model and Driver model
 * @route PUT /api/drivers/location
 */
exports.updateDriverLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, message: "Latitude and longitude required" });
    }

    // Update User model
    await User.findByIdAndUpdate(userId, {
      $set: {
        latitude,
        longitude,
        isActive: true,
        status: "online",
      },
    });

    // Update Driver model
    await Driver.findOneAndUpdate(
      { userId },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          latitude,
          longitude,
          isActive: true,
          status: "online",
        },
      },
      { upsert: false }
    );

    console.log(
      `[Driver Location] Updated: userId=${userId}, lat=${latitude}, lng=${longitude}`
    );

    res.json({
      success: true,
      message: "Location updated",
      location: { latitude, longitude },
    });
  } catch (err) {
    console.error("[Driver Controller] updateLocation Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
