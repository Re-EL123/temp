// src/models/RideRequest.js
const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: true,
  },
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },
  pickupTime: {
    type: String,
    required: true, // Format: "HH:MM"
  },
  type: {
    type: String,
    enum: ['ONCE_OFF', 'WEEKLY', 'MONTHLY'],
    required: true,
  },
  schedule: {
    // For ONCE_OFF
    dates: [Date],
    
    // For WEEKLY - days of week (0=Sunday, 1=Monday, etc.)
    daysOfWeek: [Number],
    
    // For MONTHLY - days of month (1-31)
    daysOfMonth: [Number],
    
    startDate: Date,
    endDate: Date,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'CANCELLED', 'COMPLETED'],
    default: 'PENDING',
  },
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
  },
  activity: {
    type: String,
  },
  instructions: {
    type: String,
  },
  // Metadata
  childName: String,
  schoolName: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Add geospatial indexes for location-based queries
rideRequestSchema.index({ 'pickupLocation': '2dsphere' });
rideRequestSchema.index({ 'dropoffLocation': '2dsphere' });
rideRequestSchema.index({ status: 1 });
rideRequestSchema.index({ type: 1 });
rideRequestSchema.index({ parentId: 1 });
rideRequestSchema.index({ assignedDriverId: 1 });

module.exports = mongoose.model('RideRequest', rideRequestSchema);
