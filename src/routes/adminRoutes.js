const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/user");

// ✔ ADMIN-ONLY DASHBOARD
router.get("/dashboard", verifyToken(["admin"]), (req, res) => {
  res.json({
    message: "Welcome Admin",
    admin: req.user,
  });
});

// ✔ Get all users (admin only)
router.get("/users", verifyToken(["admin"]), async (req, res) => {
  try {
    const users = await User.find();
    res.json({ message: "Users fetched successfully", users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✔ Delete a user (admin only)
router.delete("/delete/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
