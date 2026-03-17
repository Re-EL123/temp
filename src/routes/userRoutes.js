const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/user");
const Child = require("../models/Child");
const Trip = require("../models/trip.model");
const Driver = require("../models/Driver");

// ═══════════════════════════════════════════════════════════════
//  HELPER: Haversine distance (km)
// ═══════════════════════════════════════════════════════════════

function haversineDistance(lat1, lon1, lat2, lon2) {
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
}

// ═══════════════════════════════════════════════════════════════
//  GET PROFILE
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Get authenticated user's profile
 * Includes "self-healing" logic for parent children arrays.
 * Includes driver details if user is a driver.
 * @route GET /api/user/profile
 * @access Private
 */
router.get("/profile", verifyToken(), async (req, res) => {
  try {
    let user = await User.findById(req.user.id)
      .select("-password -__v")
      .populate("children");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // SELF-HEALING: Sync parent's children array
    if (user.role === "parent") {
      try {
        const childrenFromDb = await Child.find({ parentId: user._id });
        if (
          childrenFromDb.length > (user.children ? user.children.length : 0)
        ) {
          console.log(
            `[USER_ROUTES] Self-healing children for parent ${user._id}`
          );
          const childIds = childrenFromDb.map((c) => c._id);
          user = await User.findByIdAndUpdate(
            user._id,
            { $set: { children: childIds } },
            { new: true }
          )
            .populate("children")
            .select("-password -__v");
        }
      } catch (childErr) {
        console.error("[USER_ROUTES] Children sync error:", childErr.message);
      }
    }

    // Load Driver model details if user is a driver
    let driverDetails = null;
    if (user.role === "driver") {
      try {
        driverDetails = await Driver.findOne({ userId: user._id }).lean();
      } catch (driverErr) {
        console.error(
          "[USER_ROUTES] Driver details error:",
          driverErr.message
        );
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        location: user.location,
        profilePhoto: user.profilePhoto,
        latitude: user.latitude,
        longitude: user.longitude,
        isActive: user.isActive,
        status: user.status,
        verified: user.verified,
        onboardingCompleted: user.onboardingCompleted,
        walletBalance: user.walletBalance,
        // Vehicle info from User model
        carBrand: user.carBrand,
        carModel: user.carModel,
        carYear: user.carYear,
        carColor: user.carColor,
        registrationNumber: user.registrationNumber,
        licenseNumber: user.licenseNumber,
        // Stats
        rating: user.rating,
        totalRatings: user.totalRatings,
        totalTrips: user.totalTrips,
        totalEarnings: user.totalEarnings,
        // Parent-specific
        children: user.children || [],
        // Timestamps
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Driver model details (if driver)
        driverInfo: driverDetails
          ? {
              id: driverDetails._id,
              driverId: driverDetails._id,
              registrationNumber:
                driverDetails.registrationNumber ||
                user.registrationNumber,
              carBrand: driverDetails.carBrand || user.carBrand,
              carModel: driverDetails.carModel || user.carModel,
              carYear: driverDetails.carYear || user.carYear,
              carColor: driverDetails.carColor || user.carColor,
              vehicleSeats: driverDetails.vehicleSeats,
              cellNumber: driverDetails.cellNumber,
              isVerified: driverDetails.isVerified,
              status: driverDetails.status,
              rating: driverDetails.rating,
              assignedStudents: driverDetails.assignedStudents,
              walletBalance: driverDetails.walletBalance,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[USER_ROUTES] Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  UPDATE PROFILE
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Update user profile data
 * Also syncs location and vehicle data to Driver model for drivers.
 * @route PUT /api/user/profile
 * @access Private
 */
router.put("/profile", verifyToken(), async (req, res) => {
  try {
    const {
      name,
      surname,
      phone,
      address,
      location,
      latitude,
      longitude,
      profilePhoto,
      isActive,
      status,
      onboardingCompleted,
      verified,
      // Vehicle fields (can be set directly on User)
      carBrand,
      carModel,
      carYear,
      carColor,
      registrationNumber,
      licenseNumber,
      // Nested driver info object (legacy support)
      driverInfo,
    } = req.body;

    // ── Build update object: only include fields that were sent ──
    const updateFields = {};

    if (name !== undefined) updateFields.name = name;
    if (surname !== undefined) updateFields.surname = surname;
    if (phone !== undefined) updateFields.phone = phone;
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (status !== undefined) updateFields.status = status;
    if (onboardingCompleted !== undefined)
      updateFields.onboardingCompleted = onboardingCompleted;
    if (verified !== undefined) updateFields.verified = verified;

    // Address / Location (accept either field)
    if (address !== undefined) {
      updateFields.address = address;
      if (location === undefined) updateFields.location = address;
    }
    if (location !== undefined) {
      updateFields.location = location;
      if (address === undefined) updateFields.address = location;
    }

    // Coordinates
    if (latitude !== undefined) updateFields.latitude = latitude;
    if (longitude !== undefined) updateFields.longitude = longitude;

    // Vehicle fields directly on User
    if (carBrand !== undefined) updateFields.carBrand = carBrand;
    if (carModel !== undefined) updateFields.carModel = carModel;
    if (carYear !== undefined) updateFields.carYear = carYear;
    if (carColor !== undefined) updateFields.carColor = carColor;
    if (registrationNumber !== undefined)
      updateFields.registrationNumber = registrationNumber;
    if (licenseNumber !== undefined)
      updateFields.licenseNumber = licenseNumber;

    // ── Apply update ────────────────────────────────────────
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ── Sync to Driver model if user is a driver ────────────
    if (updatedUser.role === "driver") {
      try {
        const driverUpdate = {};

        // Sync location to Driver model GeoJSON field
        if (latitude && longitude) {
          driverUpdate.location = {
            type: "Point",
            coordinates: [longitude, latitude],
          };
          driverUpdate.latitude = latitude;
          driverUpdate.longitude = longitude;
        }

        // Sync active status
        if (isActive !== undefined) driverUpdate.isActive = isActive;
        if (status !== undefined) driverUpdate.status = status;

        // Sync vehicle info from direct fields
        if (carBrand) driverUpdate.carBrand = carBrand;
        if (carModel) driverUpdate.carModel = carModel;
        if (carYear) driverUpdate.carYear = carYear;
        if (carColor) driverUpdate.carColor = carColor;
        if (registrationNumber)
          driverUpdate.registrationNumber = registrationNumber;
        if (licenseNumber) driverUpdate.licenseNumber = licenseNumber;

        // Sync vehicle info from nested driverInfo object (legacy)
        if (driverInfo) {
          if (driverInfo.registrationNumber)
            driverUpdate.registrationNumber = driverInfo.registrationNumber;
          if (driverInfo.carBrand)
            driverUpdate.carBrand = driverInfo.carBrand;
          if (driverInfo.carModel)
            driverUpdate.carModel = driverInfo.carModel;
          if (driverInfo.vehicleSeats)
            driverUpdate.vehicleSeats = driverInfo.vehicleSeats;
          if (driverInfo.cellNumber)
            driverUpdate.cellNumber = driverInfo.cellNumber;
        }

        if (Object.keys(driverUpdate).length > 0) {
          await Driver.findOneAndUpdate(
            { userId: updatedUser._id },
            { $set: driverUpdate },
            { upsert: true, new: true }
          );

          console.log(
            `[Profile Update] Synced to Driver model: lat=${latitude || "unchanged"}, lng=${longitude || "unchanged"}, isActive=${isActive}`
          );
        }
      } catch (driverSyncErr) {
        console.error(
          "[Profile Update] Driver sync error (non-fatal):",
          driverSyncErr.message
        );
      }
    }

    console.log(
      `[Profile Update] ${updatedUser.name} ${updatedUser.surname || ""} | ` +
        `isActive=${updatedUser.isActive} | status=${updatedUser.status} | ` +
        `lat=${updatedUser.latitude} | lng=${updatedUser.longitude}`
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[USER_ROUTES] Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET AVAILABLE DRIVERS
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Discovery: Get available drivers
 *
 * Strategy:
 *   1. Query User model for all role=driver users (location stored here)
 *   2. Join with Driver model for vehicle details and verification
 *   3. Merge data from both sources (prefer Driver model, fallback to User)
 *   4. Calculate distance from parent if coordinates provided
 *   5. Sort by distance, return all — frontend handles fine-grained filtering
 *
 * @route GET /api/user/drivers/available
 * @query lat — Parent's latitude (optional, for distance sorting)
 * @query lng — Parent's longitude (optional, for distance sorting)
 * @query radius — Max distance in meters (optional)
 * @access Public/Private
 */
router.get("/drivers/available", async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const parentLat = lat ? parseFloat(lat) : null;
    const parentLng = lng ? parseFloat(lng) : null;

    // ── Step 1: Get all driver-role users ────────────────
    const driverUsers = await User.find({
      role: "driver",
    })
      .select(
        "name surname phone email profilePhoto " +
          "latitude longitude isActive status verified " +
          "onboardingCompleted " +
          "carBrand carModel carYear carColor registrationNumber licenseNumber " +
          "rating totalRatings totalTrips totalEarnings " +
          "createdAt"
      )
      .lean();

    console.log(
      `[Available Drivers] Found ${driverUsers.length} users with role=driver`
    );

    // ── Step 2: Get all Driver model documents ──────────
    let driverDocs = [];
    try {
      driverDocs = await Driver.find({
        userId: { $in: driverUsers.map((u) => u._id) },
      }).lean();
    } catch (driverQueryErr) {
      console.error(
        "[Available Drivers] Driver model query error (non-fatal):",
        driverQueryErr.message
      );
    }

    // Build lookup map: userId string → Driver doc
    const driverDocMap = {};
    driverDocs.forEach((d) => {
      const key = d.userId.toString();
      driverDocMap[key] = d;
    });

    console.log(
      `[Available Drivers] Found ${driverDocs.length} Driver model documents`
    );

    // ── Step 3: Build response array ────────────────────
    const results = [];

    driverUsers.forEach((user, index) => {
      const driverDoc = driverDocMap[user._id.toString()] || null;

      // ── Resolve coordinates from ALL possible sources ──
      let driverLat = 0;
      let driverLng = 0;

      // Source 1: User model direct fields (set by driver dashboard)
      if (user.latitude && user.longitude) {
        driverLat = user.latitude;
        driverLng = user.longitude;
      }
      // Source 2: Driver model GeoJSON location
      else if (
        driverDoc &&
        driverDoc.location &&
        driverDoc.location.coordinates &&
        Array.isArray(driverDoc.location.coordinates) &&
        driverDoc.location.coordinates.length === 2
      ) {
        driverLng = driverDoc.location.coordinates[0];
        driverLat = driverDoc.location.coordinates[1];
      }
      // Source 3: Driver model direct lat/lng
      else if (driverDoc && driverDoc.latitude && driverDoc.longitude) {
        driverLat = driverDoc.latitude;
        driverLng = driverDoc.longitude;
      }

      // ── Resolve vehicle info (prefer Driver model) ────
      const carBrand =
        (driverDoc && driverDoc.carBrand) || user.carBrand || "";
      const carModel =
        (driverDoc && driverDoc.carModel) || user.carModel || "";
      const carYear =
        (driverDoc && driverDoc.carYear) || user.carYear || "";
      const carColor =
        (driverDoc && driverDoc.carColor) || user.carColor || "";
      const registrationNumber =
        (driverDoc && driverDoc.registrationNumber) ||
        user.registrationNumber ||
        "";
      const licenseNumber =
        (driverDoc && driverDoc.licenseNumber) ||
        user.licenseNumber ||
        "";
      const vehicleSeats =
        (driverDoc && driverDoc.vehicleSeats) || 0;

      // ── Calculate distance ────────────────────────────
      let distance = 999;
      if (
        parentLat &&
        parentLng &&
        driverLat &&
        driverLng &&
        !(driverLat === 0 && driverLng === 0)
      ) {
        distance = parseFloat(
          haversineDistance(
            parentLat,
            parentLng,
            driverLat,
            driverLng
          ).toFixed(2)
        );
      }

      // ── Verification & status ─────────────────────────
      const isVerified = driverDoc
        ? driverDoc.isVerified || false
        : user.verified || false;
      const driverStatus =
        (driverDoc && driverDoc.status) || user.status || "unknown";

      console.log(
        `[Available Drivers] #${index}: ${user.name} ${user.surname || ""} | ` +
          `User.lat=${user.latitude || "none"} User.lng=${user.longitude || "none"} | ` +
          `Driver.location=${
            driverDoc && driverDoc.location ? "yes" : "none"
          } | ` +
          `resolved=(${driverLat}, ${driverLng}) | ` +
          `isActive=${user.isActive} | verified=${isVerified} | ` +
          `distance=${distance}km`
      );

      results.push({
        // ── Identity ──────────────────────────────────
        _id: driverDoc ? driverDoc._id : user._id,
        userId: {
          _id: user._id,
          name: user.name,
          surname: user.surname || "",
          phone: user.phone || "",
          email: user.email || "",
          profilePhoto: user.profilePhoto || null,
        },

        // ── Location ──────────────────────────────────
        latitude: driverLat,
        longitude: driverLng,
        location:
          driverLat && driverLng && !(driverLat === 0 && driverLng === 0)
            ? {
                type: "Point",
                coordinates: [driverLng, driverLat],
              }
            : null,

        // ── Vehicle ───────────────────────────────────
        carBrand,
        carModel,
        carYear,
        carColor,
        registrationNumber,
        licenseNumber,
        vehicleSeats,

        // ── Status ────────────────────────────────────
        isActive: user.isActive || false,
        isVerified,
        verified: isVerified,
        status: driverStatus,
        available: true,
        onboardingCompleted: user.onboardingCompleted || false,

        // ── Ratings & Stats ───────────────────────────
        rating:
          (driverDoc && driverDoc.rating) || user.rating || 5.0,
        totalRatings:
          (driverDoc && driverDoc.totalRatings) ||
          user.totalRatings ||
          0,
        totalTrips:
          (driverDoc && driverDoc.totalTrips) ||
          user.totalTrips ||
          0,
        totalEarnings:
          (driverDoc && driverDoc.totalEarnings) ||
          user.totalEarnings ||
          0,

        // ── Wallet ────────────────────────────────────
        walletBalance:
          (driverDoc && driverDoc.walletBalance) ||
          user.walletBalance ||
          0,

        // ── Distance ──────────────────────────────────
        distance,

        // ── Meta ──────────────────────────────────────
        createdAt: user.createdAt,
      });
    });

    // ── Step 4: Sort by distance (nearest first) ────────
    results.sort((a, b) => a.distance - b.distance);

    // ── Step 5: Optional radius filter ──────────────────
    let filteredResults = results;
    if (parentLat && parentLng && radius) {
      const maxKm = parseInt(radius) / 1000;
      filteredResults = results.filter((d) => d.distance <= maxKm);
      console.log(
        `[Available Drivers] After radius filter (${maxKm}km): ${filteredResults.length} of ${results.length}`
      );
    }

    console.log(
      `[Available Drivers] Returning ${filteredResults.length} drivers`
    );

    res.json({
      success: true,
      count: filteredResults.length,
      drivers: filteredResults,
    });
  } catch (err) {
    console.error("[Available Drivers] Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CHILDREN MANAGEMENT (delegation)
// ═══════════════════════════════════════════════════════════════

const childRoutes = require("./childRoutes");
router.use("/children", childRoutes);

// ═══════════════════════════════════════════════════════════════
//  PUSH TOKEN
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Update Expo Push Token
 * @route PUT /api/user/push-token
 * @access Private
 */
router.put("/push-token", verifyToken(), async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res
        .status(400)
        .json({ success: false, message: "Push token is required" });
    }

    await User.findByIdAndUpdate(req.user.id, { $set: { pushToken } });
    res.json({ success: true, message: "Push token updated successfully" });
  } catch (error) {
    console.error("[USER_ROUTES] Push Token Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PRIVACY SETTINGS
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Fetch User Privacy Settings
 * @route GET /api/user/privacy
 */
router.get("/privacy", verifyToken(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("privacySettings");
    res.json({
      success: true,
      privacySettings: user.privacySettings || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * @desc Update User Privacy Settings
 * @route PUT /api/user/privacy
 */
router.put("/privacy", verifyToken(), async (req, res) => {
  try {
    const { privacySettings } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { privacySettings } },
      { new: true }
    ).select("privacySettings");
    res.json({
      success: true,
      privacySettings: updatedUser.privacySettings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ACCOUNT DELETION
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Permanent Account Deletion
 * Cleans up associated driver profiles and children.
 * @route DELETE /api/user/profile
 * @access Private
 */
router.delete("/profile", verifyToken(), async (req, res) => {
  try {
    const userId = req.user.id;

    // Clean up Driver profile
    try {
      await Driver.findOneAndDelete({ userId });
    } catch (_) {}

    // Clean up children
    try {
      await Child.deleteMany({ parentId: userId });
    } catch (_) {}

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Account successfully deleted" });
  } catch (error) {
    console.error("[USER_ROUTES] Delete Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ACTIVITY LOGS
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Get User Activity (Recent Trips)
 * Supports both old field name (parent) and new (parentId)
 * @route GET /api/user/activity-logs
 */
router.get("/activity-logs", verifyToken(), async (req, res) => {
  try {
    const userId = req.user.id;

    // Query with both possible field names
    const logs = await Trip.find({
      $or: [{ parentId: userId }, { parent: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, logs });
  } catch (error) {
    console.error("[USER_ROUTES] Activity Logs Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET USER BY ID (must be LAST — catches /:id patterns)
// ═══════════════════════════════════════════════════════════════

/**
 * @desc Get any user by ID (admin or system use)
 * @route GET /api/user/:id
 * @access Private
 */
router.get("/:id", verifyToken(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -__v"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("[USER_ROUTES] Get User Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
