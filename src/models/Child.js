const mongoose = require('mongoose');

/**
 * Child Schema
 * Represents a student profile linked to a parent's account.
 * Stores school details and location data for routing.
 */
const childSchema = new mongoose.Schema(
  {
    // Link to the parent user who registered the child
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Identity
    name: { type: String, required: true },
    surname: { type: String, required: true },
    age: { type: Number, required: true },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true
    },

    // Academics
    schoolName: { type: String, required: true },
    grade: String, // e.g., "Grade 4"

    // Geospatial Data (Used for route distance and fare calculations)
    homeAddress: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0]
      },
      address: { type: String, required: true }
    },

    schoolAddress: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      },
      address: String
    },

    // Safeguarding & Contact
    parentName: String, // Cached for quick display
    relationship: String, // e.g., "Mother", "Guardian"
    parentContact: {
      type: String,
      required: true
    },

    // Relative URL to the child's profile photo
    photoUrl: String
  },
  { timestamps: true } // Handles registration and update dates
);

module.exports = mongoose.model('Child', childSchema);
