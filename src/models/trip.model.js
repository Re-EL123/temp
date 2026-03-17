// src/models/trip.js
// ═══════════════════════════════════════════════════════════════
// UNIFIED TRIP MODEL
// Original working schema + marketplace, ratings, driver location,
// recurring schedule, fare breakdown, capacity support.
// ═══════════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    // ─── Trip Type ────────────────────────────────────────
    tripType: {
      type: String,
      enum: ["once-off", "recurring", "scheduled", "weekly", "monthly"],
      default: "once-off",
      required: true,
    },

    // ─── Parent Information ───────────────────────────────
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentName: {
      type: String,
      required: true,
    },

    // ─── Driver Information ───────────────────────────────
    // NOT required: marketplace trips start without a driver
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    driverName: {
      type: String,
      default: "",
    },
    driverVehicle: {
      type: String,
      default: "",
    },

    // ─── Trip Schedule ────────────────────────────────────
    date: {
      type: Date,
      required: true,
      index: true,
    },
    pickupTime: {
      type: String,
      required: true,
    },

    // ─── Locations ────────────────────────────────────────
    pickupLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    dropoffLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },

    // ─── Current Location (real-time tracking) ────────────
    currentLocation: {
      latitude: Number,
      longitude: Number,
      speed: Number,
      heading: Number,
      timestamp: Date,
    },

    // ─── Driver Location (alternative tracking field) ─────
    driverLocation: {
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },

    // ─── Route Information ────────────────────────────────
    route: {
      distance: Number,
      duration: Number,
      coordinates: [
        {
          latitude: Number,
          longitude: Number,
        },
      ],
    },

    // ─── Trip Status ──────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending",
        "pending_assignment",
        "accepted",
        "declined",
        "in-progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    // ─── Children / Passengers ────────────────────────────
    children: [
      {
        childId: {
          type: String,
        },
        childName: {
          type: String,
          default: "",
        },
        school: String,
        homeAddress: String,
        schoolAddress: String,
        parentContact: String,
      },
    ],

    // ─── Trip Details ─────────────────────────────────────
    activity: {
      type: String,
      default: "",
    },
    instructions: {
      type: String,
      default: "",
    },

    // ─── Financial Information ────────────────────────────
    fare: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualFare: {
      type: Number,
      min: 0,
    },
    fareBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    estimatedDistance: {
      type: String,
      default: "0",
    },
    estimatedDuration: {
      type: Number,
      default: 0,
    },

    // ─── Recurring Schedule ───────────────────────────────
    recurringSchedule: {
      days: [String],
      startDate: Date,
    },

    // ─── Status Timestamps ────────────────────────────────
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },

    // ─── Cancellation / Decline Information ───────────────
    cancelledBy: {
      type: String,
      enum: ["parent", "driver", "admin", "system", "user", null],
    },
    cancellationReason: {
      type: String,
    },
    declineReason: {
      type: String,
    },

    // ─── Completion Notes ─────────────────────────────────
    completionNotes: {
      type: String,
    },

    // ─── Estimated Arrival (for tracking) ─────────────────
    estimatedArrival: {
      type: Date,
    },

    // ─── Rating ───────────────────────────────────────────
    rating: {
      value: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      ratedAt: Date,
    },

    // ─── Payment ──────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
    },
    transactionId: {
      type: String,
    },

    // ─── Metadata ─────────────────────────────────────────
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

// ═══════════════════════════════════════════════════════════════
//  INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════

tripSchema.index({ driverId: 1, status: 1, date: 1 });
tripSchema.index({ parentId: 1, status: 1, date: 1 });
tripSchema.index({ status: 1, date: 1 });

// ═══════════════════════════════════════════════════════════════
//  VIRTUAL PROPERTIES
// ═══════════════════════════════════════════════════════════════

// Trip duration in minutes
tripSchema.virtual("durationMinutes").get(function () {
  if (this.startedAt && this.completedAt) {
    return Math.round((this.completedAt - this.startedAt) / 1000 / 60);
  }
  return null;
});

// Is the trip today?
tripSchema.virtual("isToday").get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripDate = new Date(this.date);
  tripDate.setHours(0, 0, 0, 0);
  return today.getTime() === tripDate.getTime();
});

// Is the trip upcoming?
tripSchema.virtual("isUpcoming").get(function () {
  return (
    this.date > new Date() &&
    ["pending", "pending_assignment", "accepted"].includes(this.status)
  );
});

// ═══════════════════════════════════════════════════════════════
//  INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// Calculate time until pickup
tripSchema.methods.getTimeUntilPickup = function () {
  try {
    const [hours, minutes] = this.pickupTime.split(":").map(Number);
    const pickupDate = new Date(this.date);
    pickupDate.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const diff = pickupDate.getTime() - now.getTime();

    if (diff < 0) return "Now";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor(
      (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hrs}h`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  } catch (error) {
    return "Soon";
  }
};

// Can this trip be cancelled?
tripSchema.methods.canBeCancelled = function () {
  return !["completed", "cancelled"].includes(this.status);
};

// Can this trip be started?
tripSchema.methods.canBeStarted = function () {
  return this.status === "accepted";
};

// Can this trip be accepted?
tripSchema.methods.canBeAccepted = function () {
  return this.status === "pending" || this.status === "pending_assignment";
};

// ═══════════════════════════════════════════════════════════════
//  STATIC METHODS
// ═══════════════════════════════════════════════════════════════

// Get pending requests for driver (includes marketplace)
tripSchema.statics.getPendingRequestsForDriver = function (driverId) {
  return this.find({
    $or: [
      { driverId, status: "pending" },
      { status: "pending_assignment" },
    ],
  }).sort({ createdAt: -1 });
};

// Get upcoming trips for driver
tripSchema.statics.getUpcomingTripsForDriver = function (driverId) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return this.find({
    driverId,
    status: { $in: ["accepted", "in-progress"] },
    date: { $gte: now },
  }).sort({ date: 1, pickupTime: 1 });
};

// Get active trips for driver
tripSchema.statics.getActiveTripsForDriver = function (driverId) {
  return this.find({
    driverId,
    status: "in-progress",
  });
};

// Get trip history for parent
tripSchema.statics.getHistoryForParent = function (parentId, limit = 10) {
  return this.find({
    parentId,
    status: { $in: ["completed", "cancelled"] },
  })
    .sort({ completedAt: -1 })
    .limit(limit);
};

// Get trip statistics for driver
tripSchema.statics.getDriverStats = async function (
  driverId,
  startDate,
  endDate
) {
  const filter = {
    driverId,
    status: "completed",
  };

  if (startDate || endDate) {
    filter.completedAt = {};
    if (startDate) filter.completedAt.$gte = new Date(startDate);
    if (endDate) filter.completedAt.$lte = new Date(endDate);
  }

  const trips = await this.find(filter);

  const ratedTrips = trips.filter((t) => t.rating && t.rating.value);

  return {
    totalTrips: trips.length,
    totalEarnings: trips.reduce(
      (sum, trip) => sum + (trip.actualFare || trip.fare),
      0
    ),
    totalDistance: trips.reduce(
      (sum, trip) => sum + parseFloat(trip.estimatedDistance || 0),
      0
    ),
    averageRating:
      ratedTrips.length > 0
        ? ratedTrips.reduce((sum, t) => sum + t.rating.value, 0) /
          ratedTrips.length
        : 0,
  };
};

// ═══════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Update updatedAt before saving
tripSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Update updatedAt before updating
tripSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// ═══════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════

const Trip = mongoose.model("Trip", tripSchema);

module.exports = Trip;
