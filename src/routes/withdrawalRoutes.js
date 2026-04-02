const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const withdrawalController = require("../controllers/walletController");

// Create a withdrawal request
router.post("/", verifyToken(), withdrawalController.requestWithdrawal);

// Get withdrawal history for driver
router.get("/history", verifyToken(), withdrawalController.getWithdrawalHistory);

module.exports = router;
