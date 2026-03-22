const express = require("express");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/authMiddleware");
const Driver = require("../models/Driver");
const User = require("../models/user");
const DriverVerification = require("../models/DriverVerification");
const uploadVerification = require("../config/multerVerification");

const router = express.Router();

// ─────────────────────────────────────────────────────────
// GET /api/driver/verification-status
// Returns the driver's current verification status and
// document upload states.
// ─────────────────────────────────────────────────────────
router.get(
  "/verification-status",
  verifyToken(["driver"]),
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Find existing verification record
      let verification = await DriverVerification.findOne({ userId });

      // If no record exists yet, find the Driver and create one
      if (!verification) {
        const driver = await Driver.findOne({ userId });

        if (!driver) {
          return res.status(404).json({
            message: "Driver profile not found. Please complete registration first.",
          });
        }

        // Check if driver is already verified (legacy / admin-set)
        if (driver.isVerified) {
          // Create a verified record for consistency
          verification = await DriverVerification.createForDriver(userId, driver._id);
          verification.overallStatus = "verified";
          verification.verifiedAt = new Date();
          verification.documents.forEach((doc) => {
            doc.status = "approved";
          });
          await verification.save();
        } else {
          // Create fresh unverified record
          verification = await DriverVerification.createForDriver(userId, driver._id);
        }

        console.log(
          `[Verification] Created new record for driver ${userId} (status: ${verification.overallStatus})`
        );
      }

      res.json(verification.toAPIResponse());
    } catch (error) {
      console.error("[Verification] Status fetch error:", error);
      res.status(500).json({
        message: "Server error fetching verification status",
        error: error.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────
// POST /api/driver/upload-document
// Uploads a single document for verification.
// Body (multipart/form-data):
//   - document: the file (JPEG, PNG, or PDF)
//   - documentType: string ID matching REQUIRED_DOCUMENT_TYPES
// ─────────────────────────────────────────────────────────
router.post(
  "/upload-document",
  verifyToken(["driver"]),
  (req, res, next) => {
    // Run multer, handle errors gracefully
    uploadVerification.single("document")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            message: "File too large. Maximum size is 10MB.",
          });
        }
        if (err.message && err.message.includes("Invalid file type")) {
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({
          message: "File upload error",
          error: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { documentType } = req.body;
      const file = req.file;

      // ── Validate inputs ───────────────────────────────
      if (!documentType) {
        // Clean up uploaded file if documentType is missing
        if (file && file.path) {
          fs.unlink(file.path, () => {});
        }
        return res.status(400).json({
          message: "documentType is required in the request body.",
        });
      }

      const validTypes = DriverVerification.REQUIRED_DOCUMENT_TYPES;
      if (!validTypes.includes(documentType)) {
        if (file && file.path) {
          fs.unlink(file.path, () => {});
        }
        return res.status(400).json({
          message: `Invalid documentType: '${documentType}'. Must be one of: ${validTypes.join(", ")}`,
        });
      }

      if (!file) {
        return res.status(400).json({
          message: "No file uploaded. Please attach a document.",
        });
      }

      // ── Find or create verification record ────────────
      let verification = await DriverVerification.findOne({ userId });

      if (!verification) {
        const driver = await Driver.findOne({ userId });
        if (!driver) {
          fs.unlink(file.path, () => {});
          return res.status(404).json({
            message: "Driver profile not found.",
          });
        }
        verification = await DriverVerification.createForDriver(
          userId,
          driver._id
        );
      }

      // ── Find the document slot in the array ───────────
      const docIndex = verification.documents.findIndex(
        (d) => d.documentType === documentType
      );

      if (docIndex === -1) {
        // Document type not in array — add it
        verification.documents.push({
          documentType,
          status: "uploaded",
          fileName: file.filename,
          filePath: file.path,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedAt: new Date(),
          rejectionReason: null,
        });
      } else {
        // Delete previous file if it exists
        const existingDoc = verification.documents[docIndex];
        if (existingDoc.filePath && fs.existsSync(existingDoc.filePath)) {
          fs.unlink(existingDoc.filePath, (err) => {
            if (err) console.error("[Upload] Failed to delete old file:", err);
          });
        }

        // Update the document slot
        verification.documents[docIndex].status = "uploaded";
        verification.documents[docIndex].fileName = file.filename;
        verification.documents[docIndex].filePath = file.path;
        verification.documents[docIndex].originalName = file.originalname;
        verification.documents[docIndex].mimeType = file.mimetype;
        verification.documents[docIndex].fileSize = file.size;
        verification.documents[docIndex].uploadedAt = new Date();
        verification.documents[docIndex].rejectionReason = null;
        verification.documents[docIndex].reviewedAt = null;
        verification.documents[docIndex].reviewedBy = null;
      }

      // If status was 'rejected', allow re-upload (keep overall as 'rejected'
      // until they re-submit)
      if (verification.overallStatus === "verified") {
        // Shouldn't happen but guard against it
        fs.unlink(file.path, () => {});
        return res.status(400).json({
          message: "Your account is already verified.",
        });
      }

      await verification.save();

      console.log(
        `[Upload] Driver ${userId} uploaded ${documentType}: ${file.filename} (${(file.size / 1024).toFixed(1)}KB)`
      );

      res.json({
        message: `${documentType} uploaded successfully.`,
        document: {
          documentType,
          status: "uploaded",
          fileName: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
        },
      });
    } catch (error) {
      console.error("[Upload] Error:", error);
      // Attempt to clean up the file on error
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(500).json({
        message: "Server error during document upload",
        error: error.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────
// POST /api/driver/submit-verification
// Submits all uploaded documents for admin review.
// Validates that all required documents have been uploaded.
// ─────────────────────────────────────────────────────────
router.post(
  "/submit-verification",
  verifyToken(["driver"]),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const verification = await DriverVerification.findOne({ userId });

      if (!verification) {
        return res.status(404).json({
          message:
            "No verification record found. Please upload your documents first.",
        });
      }

      if (verification.overallStatus === "verified") {
        return res.status(400).json({
          message: "Your account is already verified.",
        });
      }

      if (verification.overallStatus === "pending") {
        return res.status(400).json({
          message:
            "Your documents are already under review. Please wait for the outcome.",
        });
      }

      // ── Check all required documents are uploaded ─────
      const requiredTypes = DriverVerification.REQUIRED_DOCUMENT_TYPES;
      const missingDocs = [];

      requiredTypes.forEach((type) => {
        const doc = verification.documents.find(
          (d) => d.documentType === type
        );
        if (!doc || doc.status === "not_uploaded") {
          missingDocs.push(type);
        }
      });

      if (missingDocs.length > 0) {
        // Format names for display
        const formatName = (type) =>
          type
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

        return res.status(400).json({
          message: `Missing required documents: ${missingDocs.map(formatName).join(", ")}`,
          missingDocuments: missingDocs,
        });
      }

      // ── Mark as pending ───────────────────────────────
      verification.overallStatus = "pending";
      verification.submittedAt = new Date();
      verification.submissionCount += 1;
      verification.reviewMessage = null;
      verification.rejectedAt = null;

      await verification.save();

      console.log(
        `[Verification] Driver ${userId} submitted for review (submission #${verification.submissionCount})`
      );

      res.json({
        message:
          "Documents submitted for verification successfully. You will be notified once reviewed.",
        submittedAt: verification.submittedAt.toISOString(),
        submissionCount: verification.submissionCount,
      });
    } catch (error) {
      console.error("[Verification] Submit error:", error);
      res.status(500).json({
        message: "Server error during submission",
        error: error.message,
      });
    }
  }
);

// ═════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// These are used by the admin panel to review and approve
// or reject driver verification submissions.
// ═════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// GET /api/driver/admin/pending-verifications
// Lists all drivers awaiting verification.
// ─────────────────────────────────────────────────────────
router.get(
  "/admin/pending-verifications",
  verifyToken(["admin"]),
  async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const filter = {};
      if (status) {
        filter.overallStatus = status;
      } else {
        // Default: show pending
        filter.overallStatus = "pending";
      }

      const total = await DriverVerification.countDocuments(filter);
      const verifications = await DriverVerification.find(filter)
        .populate("userId", "name surname email phone")
        .populate("driverId", "carBrand carModel registrationNumber")
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const results = verifications.map((v) => ({
        id: v._id,
        userId: v.userId?._id,
        driverName: v.userId
          ? `${v.userId.name} ${v.userId.surname}`
          : "Unknown",
        driverEmail: v.userId?.email,
        driverPhone: v.userId?.phone,
        vehicle: v.driverId
          ? `${v.driverId.carBrand} ${v.driverId.carModel} (${v.driverId.registrationNumber})`
          : "N/A",
        overallStatus: v.overallStatus,
        submittedAt: v.submittedAt,
        submissionCount: v.submissionCount,
        documentsCount: v.documents.length,
        uploadedCount: v.documents.filter(
          (d) => d.status === "uploaded" || d.status === "approved"
        ).length,
      }));

      res.json({
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        verifications: results,
      });
    } catch (error) {
      console.error("[Admin] List verifications error:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/driver/admin/verification/:userId
// Get detailed verification record for a specific driver.
// Includes file URLs for each document.
// ─────────────────────────────────────────────────────────
router.get(
  "/admin/verification/:userId",
  verifyToken(["admin"]),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const verification = await DriverVerification.findOne({ userId })
        .populate("userId", "name surname email phone address")
        .populate(
          "driverId",
          "carBrand carModel carYear carColor registrationNumber licenseNumber passengerSeats"
        );

      if (!verification) {
        return res.status(404).json({
          message: "No verification record found for this driver.",
        });
      }

      // Build document details with file URLs
      const baseUrl =
        process.env.BASE_URL ||
        `${req.protocol}://${req.get("host")}`;

      const documentsDetail = verification.documents.map((doc) => ({
        documentType: doc.documentType,
        status: doc.status,
        fileName: doc.fileName,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        fileUrl: doc.fileName
          ? `${baseUrl}/uploads/verification/${userId}/${doc.fileName}`
          : null,
        rejectionReason: doc.rejectionReason,
        uploadedAt: doc.uploadedAt,
        reviewedAt: doc.reviewedAt,
      }));

      res.json({
        success: true,
        verification: {
          id: verification._id,
          user: verification.userId,
          driver: verification.driverId,
          overallStatus: verification.overallStatus,
          documents: documentsDetail,
          submittedAt: verification.submittedAt,
          verifiedAt: verification.verifiedAt,
          rejectedAt: verification.rejectedAt,
          reviewMessage: verification.reviewMessage,
          submissionCount: verification.submissionCount,
        },
      });
    } catch (error) {
      console.error("[Admin] Get verification detail error:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────
// POST /api/driver/admin/review-document
// Approve or reject a single document.
// Body: { userId, documentType, action: 'approve'|'reject',
//         rejectionReason? }
// ─────────────────────────────────────────────────────────
router.post(
  "/admin/review-document",
  verifyToken(["admin"]),
  async (req, res) => {
    try {
      const { userId, documentType, action, rejectionReason } = req.body;

      if (!userId || !documentType || !action) {
        return res.status(400).json({
          message: "userId, documentType, and action are required.",
        });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          message: "action must be 'approve' or 'reject'.",
        });
      }

      if (action === "reject" && !rejectionReason) {
        return res.status(400).json({
          message: "rejectionReason is required when rejecting a document.",
        });
      }

      const verification = await DriverVerification.findOne({ userId });
      if (!verification) {
        return res.status(404).json({
          message: "Verification record not found.",
        });
      }

      const docIndex = verification.documents.findIndex(
        (d) => d.documentType === documentType
      );

      if (docIndex === -1) {
        return res.status(404).json({
          message: `Document type '${documentType}' not found in records.`,
        });
      }

      const doc = verification.documents[docIndex];

      if (doc.status === "not_uploaded") {
        return res.status(400).json({
          message: "This document has not been uploaded yet.",
        });
      }

      // Update document status
      doc.status = action === "approve" ? "approved" : "rejected";
      doc.rejectionReason =
        action === "reject" ? rejectionReason : null;
      doc.reviewedAt = new Date();
      doc.reviewedBy = req.user.id;

      verification.documents[docIndex] = doc;
      await verification.save();

      console.log(
        `[Admin] Document ${documentType} for driver ${userId}: ${action}d by admin ${req.user.id}`
      );

      res.json({
        success: true,
        message: `Document ${action}d successfully.`,
        document: {
          documentType: doc.documentType,
          status: doc.status,
          rejectionReason: doc.rejectionReason,
        },
      });
    } catch (error) {
      console.error("[Admin] Review document error:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────
// POST /api/driver/admin/finalize-verification
// Final decision: approve or reject the entire verification.
// Approving sets Driver.isVerified = true and User.verified = true.
// Body: { userId, action: 'approve'|'reject', reviewMessage? }
// ─────────────────────────────────────────────────────────
router.post(
  "/admin/finalize-verification",
  verifyToken(["admin"]),
  async (req, res) => {
    try {
      const { userId, action, reviewMessage } = req.body;

      if (!userId || !action) {
        return res.status(400).json({
          message: "userId and action are required.",
        });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          message: "action must be 'approve' or 'reject'.",
        });
      }

      const verification = await DriverVerification.findOne({ userId });
      if (!verification) {
        return res.status(404).json({
          message: "Verification record not found.",
        });
      }

      if (verification.overallStatus === "verified") {
        return res.status(400).json({
          message: "This driver is already verified.",
        });
      }

      if (action === "approve") {
        // ── Approve ───────────────────────────────────
        // Mark all uploaded documents as approved
        verification.documents.forEach((doc) => {
          if (doc.status === "uploaded") {
            doc.status = "approved";
            doc.reviewedAt = new Date();
            doc.reviewedBy = req.user.id;
          }
        });

        verification.overallStatus = "verified";
        verification.verifiedAt = new Date();
        verification.reviewedBy = req.user.id;
        verification.reviewMessage = reviewMessage || null;

        await verification.save();

        // Update Driver model
        await Driver.findOneAndUpdate(
          { userId },
          { isVerified: true }
        );

        // Update User model
        await User.findByIdAndUpdate(userId, { verified: true });

        console.log(
          `[Admin] Driver ${userId} VERIFIED by admin ${req.user.id}`
        );

        res.json({
          success: true,
          message: "Driver verified successfully. They can now accept trips.",
          overallStatus: "verified",
        });
      } else {
        // ── Reject ────────────────────────────────────
        if (!reviewMessage) {
          return res.status(400).json({
            message:
              "reviewMessage is required when rejecting verification.",
          });
        }

        verification.overallStatus = "rejected";
        verification.rejectedAt = new Date();
        verification.reviewedBy = req.user.id;
        verification.reviewMessage = reviewMessage;

        await verification.save();

        // Ensure driver stays unverified
        await Driver.findOneAndUpdate(
          { userId },
          { isVerified: false }
        );
        await User.findByIdAndUpdate(userId, { verified: false });

        console.log(
          `[Admin] Driver ${userId} REJECTED by admin ${req.user.id}: ${reviewMessage}`
        );

        res.json({
          success: true,
          message: "Driver verification rejected.",
          overallStatus: "rejected",
        });
      }
    } catch (error) {
      console.error("[Admin] Finalize verification error:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
