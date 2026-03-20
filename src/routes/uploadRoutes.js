const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/authMiddleware");

// Create uploads directory if it doesn't exist
// __dirname here is: /home/ubuntu/temp/src/routes
// We want:            /home/ubuntu/temp/uploads
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
console.log("uploadRoutes.js uploadsDir =", uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Ensured uploads directory:", uploadsDir);
}

// Configure multer storage – save directly into /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

// File filter — only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * POST /api/upload/photo
 * Upload a single photo and return the URL
 */
router.post("/photo", verifyToken(), upload.single("photo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No photo file provided",
      });
    }

    // File is saved directly under /uploads
    const photoUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${photoUrl}`;

    console.log(
      `[Upload] Photo saved: ${req.file.filename} (${(req.file.size / 1024).toFixed(
        1
      )}KB) at ${photoUrl}; diskPath=${req.file.path}`
    );

    res.json({
      success: true,
      message: "Photo uploaded successfully",
      url: fullUrl,
      path: photoUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/upload/photo/:filename
 * Delete a previously uploaded photo
 */
router.delete("/photo/:filename", verifyToken(), (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Upload] Photo deleted: ${filename}`);
      res.json({ success: true, message: "Photo deleted" });
    } else {
      res.status(404).json({ success: false, message: "Photo not found" });
    }
  } catch (error) {
    console.error("[Upload] Delete error:", error);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

module.exports = router;
