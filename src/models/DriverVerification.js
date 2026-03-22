const mongoose = require("mongoose");

/**
 * Individual Document Sub-Schema
 * Tracks each uploaded document's lifecycle from upload → review → approved/rejected
 */
const verificationDocumentSchema = new mongoose.Schema(
  {
    // Matches frontend document IDs (e.g. 'drivers_license', 'prdp', etc.)
    documentType: {
      type: String,
      required: true,
      enum: [
        "drivers_license",
        "prdp",
        "id_document",
        "police_clearance",
        "vehicle_registration",
        "vehicle_license_disc",
        "roadworthy_certificate",
        "vehicle_insurance",
        "operating_license",
        "proof_of_address",
        "profile_photo",
        "vehicle_photos",
      ],
    },

    status: {
      type: String,
      enum: ["not_uploaded", "uploaded", "approved", "rejected"],
      default: "not_uploaded",
    },

    // File metadata
    fileName: { type: String, default: null },
    filePath: { type: String, default: null },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, default: 0 },

    // Admin rejection feedback
    rejectionReason: { type: String, default: null },

    // Timestamps for audit trail
    uploadedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true }
);

/**
 * Driver Verification Schema
 * One-to-one relationship with a Driver/User.
 * Holds all document uploads and overall verification state.
 *
 * Lifecycle:
 *   unverified → (driver uploads docs) → pending → verified / rejected
 *   rejected → (driver re-uploads) → pending → verified / rejected
 */
const driverVerificationSchema = new mongoose.Schema(
  {
    // References
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    /**
     * Overall verification status:
     * - unverified: Initial state, no documents submitted
     * - pending: Documents submitted, awaiting admin review
     * - verified: All documents approved by admin
     * - rejected: One or more documents rejected, driver must re-upload
     */
    overallStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },

    // Array of all required documents
    documents: [verificationDocumentSchema],

    // Admin can leave a general message when rejecting
    reviewMessage: { type: String, default: null },

    // Key lifecycle timestamps
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },

    // Which admin reviewed this
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // How many times the driver has submitted for review
    submissionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────
driverVerificationSchema.index({ userId: 1 });
driverVerificationSchema.index({ driverId: 1 });
driverVerificationSchema.index({ overallStatus: 1 });

// ─── Instance Methods ────────────────────────────────────

/**
 * Convert documents array to the map format expected by the frontend:
 * { [documentType]: { status, fileName, rejectionReason } }
 */
driverVerificationSchema.methods.toDocumentsMap = function () {
  const map = {};
  this.documents.forEach((doc) => {
    map[doc.documentType] = {
      status: doc.status,
      fileName: doc.fileName || null,
      rejectionReason: doc.rejectionReason || null,
    };
  });
  return map;
};

/**
 * Build the API response object matching what the frontend expects
 */
driverVerificationSchema.methods.toAPIResponse = function () {
  return {
    overallStatus: this.overallStatus,
    documents: this.toDocumentsMap(),
    submittedAt: this.submittedAt ? this.submittedAt.toISOString() : null,
    verifiedAt: this.verifiedAt ? this.verifiedAt.toISOString() : null,
    rejectedAt: this.rejectedAt ? this.rejectedAt.toISOString() : null,
    reviewMessage: this.reviewMessage || null,
    submissionCount: this.submissionCount,
  };
};

// ─── Static: All required document types ─────────────────
driverVerificationSchema.statics.REQUIRED_DOCUMENT_TYPES = [
  "drivers_license",
  "prdp",
  "id_document",
  "police_clearance",
  "vehicle_registration",
  "vehicle_license_disc",
  "roadworthy_certificate",
  "vehicle_insurance",
  "operating_license",
  "proof_of_address",
  "profile_photo",
  "vehicle_photos",
];

/**
 * Static: Create a fresh verification record with all document slots
 * initialized to 'not_uploaded'
 */
driverVerificationSchema.statics.createForDriver = async function (
  userId,
  driverId
) {
  const documents = this.REQUIRED_DOCUMENT_TYPES.map((type) => ({
    documentType: type,
    status: "not_uploaded",
  }));

  return this.create({
    userId,
    driverId,
    overallStatus: "unverified",
    documents,
  });
};

module.exports = mongoose.model("DriverVerification", driverVerificationSchema);
