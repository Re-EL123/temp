const mongoose = require("mongoose");

/**
 * User Schema
 * Represents all platform participants: Parents, Drivers, and Admins.
 * Stores identity, security, profile, and system settings.
 */
const userSchema = new mongoose.Schema(
  {
    // Identity Information
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Bcrypt hash

    /**
     * Role segregation:
     * - parent: Can book trips and manage children.
     * - driver: Can accept trips and needs a linked Driver profile.
     * - admin: System moderator.
     */
    role: {
      type: String,
      enum: ["user", "parent", "driver", "admin"],
      default: "user"
    },

    // Contact & Profile
    phone: { type: String },
    address: { type: String },
    location: { type: String },
    profilePhoto: { type: String, default: null },

    /**
     * Onboarding State:
     * Tracks if the user has completed the profile setup (e.g., driver vehicle details).
     */
    onboardingCompleted: { type: Boolean, default: false },

    // Geospatial data for real-time distance discovery
    latitude: { type: Number },
    longitude: { type: Number },

    // Financial balance for Payments/Refunds
    walletBalance: { type: Number, default: 0 },

    // Linked Child profiles (only for 'parent' role)
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Child'
      }
    ],

    // User preference flags
    privacySettings: {
      profileVisibility: { type: Boolean, default: true },
      shareActivity: { type: Boolean, default: true },
      locationSharing: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false }
    },

    // Mobile specific: Expo push token for notifications
    pushToken: { type: String, default: null },

    // Availability flag (primarily for drivers)
    isActive: { type: Boolean, default: false },

    // Password reset handles
    resetPasswordOTP: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
  },
  { timestamps: true } // Auto-manages createdAt and updatedAt
);

module.exports = mongoose.model("User", userSchema);
