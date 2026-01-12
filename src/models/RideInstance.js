// src/models/RideInstance.js
const mongoose = require('mongoose');

const rideInstanceSchema = new mongoose.Schema({
  rideRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  pickupTime: {
    type: String,
    required: true, // Format: "HH:MM"
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  },
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'],
    default: 'SCHEDULED',
  },
  // Copy of location data for quick access
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: [Number],
    address: String,
  },
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: [Number],
    address: String,
  },
  activity: String,
  instructions: String,
  // Tracking data
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  // Notifications
  notifiedDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
rideInstanceSchema.index({ rideRequestId: 1 });
rideInstanceSchema.index({ date: 1 });
rideInstanceSchema.index({ driverId: 1, date: 1 });
rideInstanceSchema.index({ status: 1 });
rideInstanceSchema.index({ childId: 1 });
rideInstanceSchema.index({ parentId: 1 });
rideInstanceSchema.index({ 'pickupLocation': '2dsphere' });

// Compound index for driver's daily schedule
rideInstanceSchema.index({ driverId: 1, date: 1, status: 1 });

module.exports = mongoose.model('RideInstance', rideInstanceSchema);
