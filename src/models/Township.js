const mongoose = require('mongoose');

const townshipSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  province: String,
  coordinates: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  radius_km: {
    type: Number,
    default: 15,
  },
  active_drivers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
    },
  ],
  active_parents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

townshipSchema.index({
  'coordinates.latitude': 1,
  'coordinates.longitude': 1,
});

module.exports = mongoose.model('Township', townshipSchema);
