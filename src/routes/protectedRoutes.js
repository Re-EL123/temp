const express = require("express");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

// Protected dashboard route
router.get("/dashboard", verifyToken(), (req, res) => {
  res.json({
    message: "✅ Access granted",
    user: req.user, // Data from decoded token
  });
});

module.exports = router;
