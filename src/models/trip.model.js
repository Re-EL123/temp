// src/models/trip.js
const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // FIX: was 'Driver'
    },
    tripType: {
      type: String,
      enum: ["once-off", "weekly", "monthly"],
      default: "once-off",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "pending_assignment",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
    },
    dropoffLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    pickupTime: {
      type: String,
      required: true,
    },
    activity: String,
    instructions: String,
    notifiedDrivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // FIX: was 'Driver'
      },
    ],
    recurringSchedule: {
      days: [String],
      startDate: Date,
      endDate: Date,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Add geospatial indexes for location-based queries
tripSchema.index({ pickupLocation: "2dsphere" });
tripSchema.index({ dropoffLocation: "2dsphere" });

module.exports = mongoose.model("Trip", tripSchema);
