/**
 * Wallet Routes
 * Mounts at: /api/wallet
 *
 * All routes require authentication via the `protect` middleware
 * (user must send a valid JWT in the Authorization header).
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const walletController = require("../controllers/walletController");

// ── Wallet overview ─────────────────────────────────────────────
// GET /api/wallet
router.get("/", protect, walletController.getWallet);

// ── Top-up (Parent) ────────────────────────────────────────────
// POST /api/wallet/topup
router.post("/topup", protect, walletController.initiateTopUp);

// ── Withdraw (Driver) ──────────────────────────────────────────
// POST /api/wallet/withdraw
router.post("/withdraw", protect, walletController.requestWithdrawal);

// ── Bank details (Driver) ──────────────────────────────────────
// PUT /api/wallet/bank-details
router.put("/bank-details", protect, walletController.updateBankDetails);

// ── Transaction history (paginated) ────────────────────────────
// GET /api/wallet/transactions?page=1&limit=20&type=topup&status=completed
router.get("/transactions", protect, walletController.getTransactions);

// ── Pay for a trip (Parent → Driver) ───────────────────────────
// POST /api/wallet/pay
router.post("/pay", protect, walletController.payForTrip);

module.exports = router;
