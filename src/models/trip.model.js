const mongoose = require('mongoose');

/**
 * Trip Schema
 * Core model for managing transport requests, tracking sessions, and history.
 * A Trip links a parent, multiple children, and a driver.
 */
const tripSchema = new mongoose.Schema({
  // The person who requested the trip
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Parent display name (denormalized for quick access)
  parentName: {
    type: String,
  },

  // List of children being transported in this session
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
  }],

  // Embedded child details (from frontend for once-off trips)
  childrenDetails: [{
    childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' },
    childName: { type: String },
    school: { type: String },
    homeAddress: { type: String },
    schoolAddress: { type: String },
    parentContact: { type: String },
  }],

  // The assigned driver (null if in market/pending_assignment)
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  },

  // Driver display info (denormalized)
  driverName: {
    type: String,
  },
  driverVehicle: {
    type: String,
  },

  /**
   * once-off: Single pickup/dropoff.
   * weekly/monthly: Subscriptions (logic handled in recurringSchedule).
   */
  tripType: {
    type: String,
    enum: ['once-off', 'weekly', 'monthly'],
    default: 'once-off',
  },

  /**
   * Trip Lifecycle:
   * 1. pending: Request created, waiting for driver acceptance.
   * 2. pending_assignment: Visible in Marketplace for drivers to claim.
   * 3. assigned / accepted: Driver linked, scheduled for future.
   * 4. in_progress / in-progress: Driver has started the pickup/ride (Live tracking active).
   * 5. completed: Safely dropped off.
   * 6. cancelled: Terminated by user/system.
   * 7. declined: Rejected by driver.
   */
  status: {
    type: String,
    enum: [
      'pending',
      'pending_assignment',
      'assigned',
      'accepted',
      'in_progress',
      'in-progress',
      'completed',
      'cancelled',
      'declined',
    ],
    default: 'pending',
  },

  // Pickup GeoJSON Point
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    address: String,
  },

  // Dropoff GeoJSON Point
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    address: String,
  },

  scheduledDate: {
    type: Date,
  },

  pickupTime: {
    type: String, // Format: "HH:mm"
  },

  activity: String, // Context for the trip (e.g., "After school soccer")
  instructions: String, // Specific driver notes

  // Drivers who have been notified about this request
  notifiedDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  }],

  // Subscription-based ride details
  recurringSchedule: {
    days: [String], // ["Monday", "Wednesday"]
    startDate: Date,
    endDate: Date,
  },

  // Route data from OSRM/routing service
  route: {
    distance: { type: Number }, // meters
    duration: { type: Number }, // seconds
    coordinates: [{
      latitude: Number,
      longitude: Number,
    }],
  },

  // Fare breakdown from fare calculator
  fare: { type: Number, default: 0 },
  fareBreakdown: {
    base: { type: Number },
    distance: { type: Number },
    time: { type: Number },
    childSurcharge: { type: Number },
    discount: { type: Number },
    total: { type: Number },
  },

  estimatedDuration: { type: Number, default: 0 }, // minutes
  estimatedDistance: { type: String, default: "0" }, // km as string

  distance: { type: Number, default: 0 }, // in km (legacy)
  duration: { type: Number, default: 0 }, // in minutes (legacy)

  // Timeline audit fields
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  declinedAt: Date,

  /**
   * Rating: Submitted by parent after trip completion.
   */
  rating: {
    value: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    ratedAt: { type: Date },
  },

  /**
   * Live Tracking Data:
   * Updated via Socket.IO/POST during 'in_progress' status.
   * Used by the frontend polling endpoint GET /api/trips/:tripId/status
   */
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
    heading: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
  },

  // Denormalized driver location for frontend polling (lat/lng format)
  driverLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    updatedAt: { type: Date },
  },
}, {
  timestamps: true,
});

/**
 * Geospatial indexing:
 * Enables MongoDB $near and $geoWithin queries for driver discovery.
 */
tripSchema.index({ pickupLocation: '2dsphere' });
tripSchema.index({ dropoffLocation: '2dsphere' });
tripSchema.index({ currentLocation: '2dsphere' });

// Performance indexes
tripSchema.index({ parent: 1, status: 1 });
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ status: 1, scheduledDate: -1 });

module.exports = mongoose.model('Trip', tripSchema);
