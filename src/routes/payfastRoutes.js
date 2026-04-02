/**
 * PayFast Routes
 * Mounts at: /api/payfast
 *
 * CRITICAL: The /notify endpoint must NOT use the `protect` middleware.
 * PayFast sends server-to-server POST requests with no Authorization header.
 * The ITN is validated via IP check + signature + server confirmation instead.
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const payfastController = require("../controllers/payfastController");

// ── ITN Webhook (NO AUTH - PayFast server-to-server) ────────────
// POST /api/payfast/notify
router.post("/notify", payfastController.handleITN);

// ── Return URL (user redirected here after successful payment) ──
// GET /api/payfast/return
router.get("/return", payfastController.handleReturn);

// ── Cancel URL (user redirected here if they cancel) ────────────
// GET /api/payfast/cancel
router.get("/cancel", payfastController.handleCancel);

// ── Verify payment status (authenticated, called by frontend) ───
// GET /api/payfast/verify/:paymentId
router.get("/verify/:paymentId", protect, payfastController.verifyPayment);

module.exports = router;
