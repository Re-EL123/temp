const mongoose = require('mongoose');

/**
 * Driver Schema
 * Extended profile for users with the 'driver' role.
 * Contains vehicle information, verification status, and transport capacity.
 */
const driverSchema = new mongoose.Schema({
  // Link to the core User identity
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Total passenger capacity of the driver's vehicle
  vehicleSeats: {
    type: Number,
    required: true,
  },

  // South African Licensing & Vehicle details
  registrationNumber: { type: String, required: false }, // Number plate
  carBrand: { type: String, required: false },           // e.g., Toyota
  carModel: { type: String, required: false },           // e.g., Quantum
  cellNumber: { type: String, required: false },         // Redundant but used for quick contact
  isSouthAfrican: { type: Boolean, default: true },
  idNumber: { type: String, required: false },

  /**
   * Capacity Management:
   * Tracks how many students are currently assigned across all accepted trips.
   * Should not exceed vehicleSeats.
   */
  assignedStudents: {
    type: Number,
    default: 0,
  },

  /**
   * Last known location (GeoJSON):
   * Indexed for 2dsphere queries to find 'available' drivers near a pickup point.
   */
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },

  /**
   * Operational Status:
   * - available: Online and looking for trips.
   * - busy: Currently executing a trip.
   * - offline: Not working.
   */
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
  },

  // Set by Admin. Drivers cannot accept trips until isVerified is true.
  isVerified: {
    type: Boolean,
    default: false,
  },

  // Based on parent reviews
  rating: {
    type: Number,
    default: 5,
    min: 1,
    max: 5,
  },

  // History of trips handled by this driver
  trips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
  }],

  // Accumulated earnings from completed trips
  walletBalance: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true, // Auto-manages createdAt and updatedAt
});

// Add geospatial index for location-based queries ($near, $geoWithin)
driverSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Driver', driverSchema);
