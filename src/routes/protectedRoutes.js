const express = require("express");
const verifyToken = require("../middleware/authMiddleware");

const User = require("../models/user");
const Driver = require("../models/driver");

const router = express.Router();

// Protected dashboard route
router.get("/dashboard", verifyToken(), (req, res) => {
  res.json({
    message: "✅ Access granted",
    user: req.user, // Data from decoded token
  });
});

// Delete account route
router.delete("/delete-account", verifyToken(), async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Delete the User document
    const start = Date.now();
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. If user was a driver, delete the Driver document too
    // We try this regardless of role string to ensure clean database
    const deletedDriver = await Driver.findOneAndDelete({ userId: userId });

    console.log(`🗑️ Account deleted: ${deletedUser.email} (Driver profile: ${deletedDriver ? "Deleted" : "None found"}) - took ${Date.now() - start}ms`);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ message: "Server error deleting account" });
  }
});

module.exports = router;
