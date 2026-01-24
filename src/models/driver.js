const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  townshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Township',
  },
  townshipName: String,
  vehicleSeats: {
    type: Number,
    required: true,
  },
  assignedStudents: {
    type: Number,
    default: 0,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    default: 5,
    min: 1,
    max: 5,
  },
  trips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
  }],
  vehicleModel: String,
  vehicleRegistration: String,
  totalEarnings: {
    type: Number,
    default: 0,
  },
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

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ townshipId: 1, status: 1 });

module.exports = mongoose.model('Driver', driverSchema);
