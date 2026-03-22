const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Multer configuration for driver verification document uploads.
 * Saves files to: uploads/verification/{userId}/{documentType}-{timestamp}.ext
 *
 * Accepted formats: JPEG, PNG, PDF
 * Max file size: 10MB per document
 */

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific directory
    const userId = req.user?.id || "unknown";
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "verification",
      userId
    );

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // Generate unique filename: documentType-timestamp.ext
    const documentType = req.body.documentType || "document";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${documentType}-${timestamp}${ext}`;

    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and PDF files are allowed.`
      ),
      false
    );
  }
};

const uploadVerification = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // One document per request
  },
});

module.exports = uploadVerification;
