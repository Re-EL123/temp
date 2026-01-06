const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  pickupLocation: {
    latitude: Number,
    longitude: Number,
  },
  dropoffLocation: {
    latitude: Number,
    longitude: Number,
  },
  status: {
    type: String,
    enum: ["requested", "accepted", "in_progress", "completed", "cancelled"],
    default: "requested",
  },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

module.exports = mongoose.model("Trip", tripSchema);
