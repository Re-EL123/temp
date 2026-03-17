const mongoose = require("mongoose");

/**
 * User Schema
 * Represents all platform participants: Parents, Drivers, and Admins.
 * Stores identity, security, profile, and system settings.
 */
const userSchema = new mongoose.Schema(
  {
    // ─── Identity Information ─────────────────────────────
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    /**
     * Role segregation:
     * - parent: Can book trips and manage children.
     * - driver: Can accept trips and needs a linked Driver profile.
     * - admin: System moderator.
     */
    role: {
      type: String,
      enum: ["user", "parent", "driver", "admin"],
      default: "user",
    },

    // ─── Contact & Profile ────────────────────────────────
    phone: { type: String },
    address: { type: String },
    location: { type: String },
    profilePhoto: { type: String, default: null },

    /**
     * Onboarding State:
     * Tracks if the user has completed the profile setup.
     */
    onboardingCompleted: { type: Boolean, default: false },

    // ─── Geospatial (set by driver dashboard when going online) ──
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },

    // ─── Availability (primarily for drivers) ─────────────
    isActive: { type: Boolean, default: false },
    status: { type: String, default: "offline" },
    verified: { type: Boolean, default: false },

    // ─── Vehicle fields (driver can set on User directly) ─
    carBrand: { type: String, default: "" },
    carModel: { type: String, default: "" },
    carYear: { type: String, default: "" },
    carColor: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },

    // ─── Rating & Stats ──────────────────────────────────
    rating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    // ─── Financial ────────────────────────────────────────
    walletBalance: { type: Number, default: 0 },

    // ─── Linked Children (parent role only) ───────────────
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Child",
      },
    ],

    // ─── User Preferences ─────────────────────────────────
    privacySettings: {
      profileVisibility: { type: Boolean, default: true },
      shareActivity: { type: Boolean, default: true },
      locationSharing: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
    },

    // ─── Push Notifications ───────────────────────────────
    pushToken: { type: String, default: null },

    // ─── Password Reset ───────────────────────────────────
    resetPasswordOTP: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
