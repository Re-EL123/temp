// src/controllers/admin.controller.js
// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD CONTROLLER
// Full-featured admin endpoints for the SafeSchoolRide platform
// ═══════════════════════════════════════════════════════════════

const User = require("../models/user");
const Driver = require("../models/Driver");
const Trip = require("../models/trip.model");
const mongoose = require("mongoose");

// ═══════════════════════════════════════════════════════════════
//  1. DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/stats
 * Comprehensive dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalParents,
      totalDrivers,
      totalAdmins,
      activeUsers,
      recentSignups,
      driverDocCount,
      pendingVerification,
      verifiedDrivers,
      totalTrips,
      pendingTrips,
      acceptedTrips,
      activeTrips,
      completedTripsAll,
      completedTripsToday,
      completedTripsWeek,
      completedTripsMonth,
      cancelledTrips,
      declinedTrips,
      pendingAssignment,
      revenueAll,
      revenueToday,
      revenueWeek,
      revenueMonth,
      avgRatingResult,
      totalChildrenResult,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "parent" }),
      User.countDocuments({ role: "driver" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: weekStart } }),
      Driver.countDocuments(),
      Driver.countDocuments({ isVerified: false }),
      Driver.countDocuments({ isVerified: true }),
      Trip.countDocuments(),
      Trip.countDocuments({ status: "pending" }),
      Trip.countDocuments({ status: "accepted" }),
      Trip.countDocuments({ status: "in-progress" }),
      Trip.countDocuments({ status: "completed" }),
      Trip.countDocuments({ status: "completed", completedAt: { $gte: todayStart } }),
      Trip.countDocuments({ status: "completed", completedAt: { $gte: weekStart } }),
      Trip.countDocuments({ status: "completed", completedAt: { $gte: monthStart } }),
      Trip.countDocuments({ status: "cancelled" }),
      Trip.countDocuments({ status: "declined" }),
      Trip.countDocuments({ status: "pending_assignment" }),
      Trip.aggregate([{ $match: { status: "completed" } }, { $group: { _id: null, total: { $sum: "$fare" } } }]),
      Trip.aggregate([{ $match: { status: "completed", completedAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: "$fare" } } }]),
      Trip.aggregate([{ $match: { status: "completed", completedAt: { $gte: weekStart } } }, { $group: { _id: null, total: { $sum: "$fare" } } }]),
      Trip.aggregate([{ $match: { status: "completed", completedAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$fare" } } }]),
      Trip.aggregate([{ $match: { status: "completed", "rating.value": { $exists: true, $gt: 0 } } }, { $group: { _id: null, avg: { $avg: "$rating.value" }, count: { $sum: 1 } } }]),
      Trip.aggregate([{ $unwind: "$children" }, { $group: { _id: null, total: { $sum: 1 } } }]),
    ]);

    return res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          parents: totalParents,
          drivers: totalDrivers,
          admins: totalAdmins,
          active: activeUsers,
          recentSignups,
        },
        drivers: {
          total: driverDocCount,
          pendingVerification,
          verified: verifiedDrivers,
        },
        trips: {
          total: totalTrips,
          pending: pendingTrips,
          accepted: acceptedTrips,
          active: activeTrips,
          completedAll: completedTripsAll,
          completedToday: completedTripsToday,
          completedWeek: completedTripsWeek,
          completedMonth: completedTripsMonth,
          cancelled: cancelledTrips,
          declined: declinedTrips,
          pendingAssignment,
        },
        revenue: {
          total: revenueAll[0]?.total || 0,
          today: revenueToday[0]?.total || 0,
          week: revenueWeek[0]?.total || 0,
          month: revenueMonth[0]?.total || 0,
        },
        ratings: {
          average: avgRatingResult[0]?.avg ? parseFloat(avgRatingResult[0].avg.toFixed(2)) : 0,
          count: avgRatingResult[0]?.count || 0,
        },
        totalChildrenTransported: totalChildrenResult[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("[ADMIN_STATS] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/admin/activity
 * Recent system activity (latest trips, signups, status changes)
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;

    const [recentTrips, recentUsers] = await Promise.all([
      Trip.find()
        .select("status parentName driverName fare pickupTime date createdAt updatedAt tripType")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      User.find()
        .select("name surname email role createdAt isActive")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const activity = [];

    recentTrips.forEach((t) => {
      activity.push({
        type: "trip",
        action: t.status,
        description: `${t.parentName || "Parent"} → ${t.driverName || "Unassigned"} (${t.tripType || "once-off"})`,
        fare: t.fare,
        timestamp: t.updatedAt || t.createdAt,
        id: t._id,
      });
    });

    recentUsers.forEach((u) => {
      activity.push({
        type: "user",
        action: "signup",
        description: `${u.name} ${u.surname} (${u.role}) joined`,
        timestamp: u.createdAt,
        id: u._id,
      });
    });

    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, activity: activity.slice(0, limit) });
  } catch (error) {
    console.error("[ADMIN_ACTIVITY] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/users
 * List all users with optional search and role filter
 *   ?search=john&role=parent&active=true
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, active } = req.query;
    const filter = {};

    if (role && role !== "all") {
      filter.role = role;
    }

    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { surname: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error("[ADMIN_USERS] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/admin/users/:id
 * Get single user detail
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // If driver, fetch Driver doc and trip stats
    let driverProfile = null;
    let tripStats = null;

    if (user.role === "driver") {
      driverProfile = await Driver.findOne({ userId: id }).lean();
      const [totalTrips, completedTrips, earningsResult] = await Promise.all([
        Trip.countDocuments({ driverId: id }),
        Trip.countDocuments({ driverId: id, status: "completed" }),
        Trip.aggregate([
          { $match: { driverId: new mongoose.Types.ObjectId(id), status: "completed" } },
          { $group: { _id: null, total: { $sum: "$fare" } } },
        ]),
      ]);
      tripStats = { totalTrips, completedTrips, totalEarnings: earningsResult[0]?.total || 0 };
    }

    if (user.role === "parent") {
      const [totalTrips, completedTrips, spentResult] = await Promise.all([
        Trip.countDocuments({ parentId: id }),
        Trip.countDocuments({ parentId: id, status: "completed" }),
        Trip.aggregate([
          { $match: { parentId: new mongoose.Types.ObjectId(id), status: "completed" } },
          { $group: { _id: null, total: { $sum: "$fare" } } },
        ]),
      ]);
      tripStats = { totalTrips, completedTrips, totalSpent: spentResult[0]?.total || 0 };
    }

    return res.json({ success: true, user, driverProfile, tripStats });
  } catch (error) {
    console.error("[ADMIN_USER_DETAIL] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PUT /api/admin/users/:id
 * Update user fields (role, name, active status, etc.)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove sensitive fields from update
    delete updates.password;
    delete updates._id;

    updates.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`[ADMIN] Updated user ${id}: ${JSON.stringify(Object.keys(updates))}`);

    return res.json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    console.error("[ADMIN_UPDATE_USER] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Delete user with cascade (driver profile, trips cleanup)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent deleting yourself
    if (req.user && req.user.id === id) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });
    }

    // Clean up driver profile
    await Driver.findOneAndDelete({ userId: id });

    // Cancel any active trips
    await Trip.updateMany(
      { $or: [{ parentId: id }, { driverId: id }], status: { $in: ["pending", "accepted"] } },
      { status: "cancelled", cancelledAt: new Date(), cancellationReason: "User account deleted by admin", cancelledBy: "admin" }
    );

    await User.findByIdAndDelete(id);

    console.log(`[ADMIN] Deleted user ${id} (${user.name} ${user.surname}, ${user.role})`);

    return res.json({ success: true, message: `User ${user.name} ${user.surname} and associated data deleted` });
  } catch (error) {
    console.error("[ADMIN_DELETE_USER] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PUT /api/admin/users/:id/toggle-active
 * Toggle user active status
 */
exports.toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = !user.isActive;
    user.updatedAt = new Date();
    await user.save();

    console.log(`[ADMIN] Toggled user ${id} active → ${user.isActive}`);

    return res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      user: { _id: user._id, isActive: user.isActive },
    });
  } catch (error) {
    console.error("[ADMIN_TOGGLE_ACTIVE] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  3. DRIVER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/drivers
 * List all drivers with user details and stats
 */
exports.getAllDrivers = async (req, res) => {
  try {
    const { verified, search } = req.query;

    const driverFilter = {};
    if (verified === "true") driverFilter.isVerified = true;
    else if (verified === "false") driverFilter.isVerified = false;

    let drivers = await Driver.find(driverFilter)
      .populate("userId", "name surname email phone isActive onboardingCompleted createdAt profilePhoto")
      .sort({ createdAt: -1 })
      .lean();

    // If search query, filter by user name/email
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      drivers = drivers.filter((d) => {
        if (!d.userId) return false;
        return regex.test(d.userId.name || "") || regex.test(d.userId.surname || "") || regex.test(d.userId.email || "");
      });
    }

    // Attach trip counts for each driver
    const driverIds = drivers.map((d) => d.userId?._id).filter(Boolean);
    const tripCounts = await Trip.aggregate([
      { $match: { driverId: { $in: driverIds } } },
      {
        $group: {
          _id: "$driverId",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          active: { $sum: { $cond: [{ $in: ["$status", ["pending", "accepted", "in-progress"]] }, 1, 0] } },
          earnings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$fare", 0] } },
        },
      },
    ]);

    const tripMap = {};
    tripCounts.forEach((tc) => {
      tripMap[tc._id.toString()] = tc;
    });

    const enriched = drivers.map((d) => {
      const uid = d.userId?._id?.toString();
      const stats = uid ? tripMap[uid] || {} : {};
      return {
        ...d,
        tripStats: {
          total: stats.total || 0,
          completed: stats.completed || 0,
          active: stats.active || 0,
          earnings: stats.earnings || 0,
        },
      };
    });

    return res.json({ success: true, drivers: enriched, count: enriched.length });
  } catch (error) {
    console.error("[ADMIN_DRIVERS] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/admin/drivers/:id
 * Get single driver detail with trip history
 */
exports.getDriverById = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id)
      .populate("userId", "name surname email phone isActive onboardingCompleted createdAt profilePhoto rating totalRatings totalEarnings")
      .lean();

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    const userId = driver.userId?._id;
    let recentTrips = [];
    let tripStats = {};

    if (userId) {
      [recentTrips, tripStats] = await Promise.all([
        Trip.find({ driverId: userId })
          .select("status parentName fare date pickupTime pickupLocation dropoffLocation createdAt rating")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        Trip.aggregate([
          { $match: { driverId: new mongoose.Types.ObjectId(userId) } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
              earnings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$fare", 0] } },
            },
          },
        ]).then((r) => r[0] || {}),
      ]);
    }

    return res.json({ success: true, driver, recentTrips, tripStats });
  } catch (error) {
    console.error("[ADMIN_DRIVER_DETAIL] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PATCH /api/admin/verify-driver/:id
 * Verify or unverify a driver
 */
exports.verifyDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      id,
      { isVerified: !!verified, updatedAt: new Date() },
      { new: true }
    ).populate("userId", "name surname email");

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    const name = driver.userId ? `${driver.userId.name} ${driver.userId.surname}` : "Unknown";
    console.log(`[ADMIN] Driver ${id} (${name}) ${verified ? "verified" : "unverified"}`);

    return res.json({
      success: true,
      message: `Driver ${name} ${verified ? "verified" : "unverified"} successfully`,
      driver,
    });
  } catch (error) {
    console.error("[ADMIN_VERIFY_DRIVER] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  4. TRIP MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/trips
 * List all trips with filters
 *   ?status=pending,accepted&startDate=...&endDate=...&search=...
 */
exports.getAllTrips = async (req, res) => {
  try {
    const { status, startDate, endDate, search, tripType } = req.query;
    const filter = {};

    if (status && status !== "all") {
      if (status.includes(",")) {
        filter.status = { $in: status.split(",").map((s) => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    if (tripType && tripType !== "all") {
      filter.tripType = tripType;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { parentName: regex },
        { driverName: regex },
        { "pickupLocation.address": regex },
        { "dropoffLocation.address": regex },
      ];
    }

    const trips = await Trip.find(filter)
      .populate("driverId", "name surname phone carBrand carModel registrationNumber profilePhoto")
      .populate("parentId", "name surname phone email profilePhoto")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, trips, count: trips.length });
  } catch (error) {
    console.error("[ADMIN_TRIPS] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/admin/trips/:id
 * Get detailed trip information
 */
exports.getTripById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid trip ID" });
    }

    const trip = await Trip.findById(id)
      .populate("driverId", "name surname phone email carBrand carModel registrationNumber profilePhoto")
      .populate("parentId", "name surname phone email profilePhoto")
      .lean();

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    return res.json({ success: true, trip });
  } catch (error) {
    console.error("[ADMIN_TRIP_DETAIL] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PUT /api/admin/trips/:id/cancel
 * Admin force-cancel a trip
 */
exports.adminCancelTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    if (trip.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot cancel a completed trip" });
    }

    if (trip.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Trip is already cancelled" });
    }

    trip.status = "cancelled";
    trip.cancelledAt = new Date();
    trip.cancelledBy = "admin";
    trip.cancellationReason = reason || "Cancelled by administrator";
    trip.updatedAt = new Date();
    await trip.save();

    console.log(`[ADMIN] Force-cancelled trip ${id}`);

    return res.json({ success: true, message: "Trip cancelled by admin", trip });
  } catch (error) {
    console.error("[ADMIN_CANCEL_TRIP] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * PUT /api/admin/trips/:id/status
 * Admin update trip status
 */
exports.adminUpdateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ["pending", "pending_assignment", "accepted", "declined", "in-progress", "completed", "cancelled"];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${valid.join(", ")}` });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    trip.status = status;
    trip.updatedAt = new Date();

    if (status === "accepted") trip.acceptedAt = new Date();
    else if (status === "in-progress") trip.startedAt = new Date();
    else if (status === "completed") trip.completedAt = new Date();
    else if (status === "cancelled") { trip.cancelledAt = new Date(); trip.cancelledBy = "admin"; }
    else if (status === "declined") trip.declinedAt = new Date();

    await trip.save();

    console.log(`[ADMIN] Trip ${id} status → ${status}`);

    return res.json({ success: true, message: `Trip status updated to ${status}`, trip });
  } catch (error) {
    console.error("[ADMIN_UPDATE_TRIP_STATUS] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  5. REVENUE
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/revenue
 * Detailed revenue breakdown by driver and by period
 */
exports.getRevenueStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    // Revenue by driver (top 20)
    const byDriver = await Trip.aggregate([
      { $match: { status: "completed", fare: { $gt: 0 } } },
      { $group: { _id: "$driverId", driverName: { $first: "$driverName" }, totalFare: { $sum: "$fare" }, tripCount: { $sum: 1 } } },
      { $sort: { totalFare: -1 } },
      { $limit: 20 },
    ]);

    // Revenue by day (last 30 days)
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const byDay = await Trip.aggregate([
      { $match: { status: "completed", completedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }, revenue: { $sum: "$fare" }, trips: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Overall fare stats
    const fareStats = await Trip.aggregate([
      { $match: { status: "completed", fare: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$fare" }, avg: { $avg: "$fare" }, min: { $min: "$fare" }, max: { $max: "$fare" }, count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      revenue: {
        byDriver,
        byDay,
        summary: fareStats[0] || { total: 0, avg: 0, min: 0, max: 0, count: 0 },
      },
    });
  } catch (error) {
    console.error("[ADMIN_REVENUE] Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
