/**
 * PayFast Controller
 * Handles ITN notifications, return/cancel redirects.
 *
 * IMPORTANT: The /notify endpoint must NOT require authentication.
 * PayFast sends server-to-server POSTs with no Authorization header.
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const PayfastPayment = require("../models/PayfastPayment");
const payfastService = require("../services/payfastService");

// ═══════════════════════════════════════════════════════════════
//  POST /api/payfast/notify  –  PayFast ITN (Instant Transaction
//                                Notification) webhook
// ═══════════════════════════════════════════════════════════════
exports.handleITN = async (req, res) => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   PayFast ITN Received               ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("Body:", JSON.stringify(req.body, null, 2));

  // PayFast expects a 200 response immediately
  // Do processing, but always respond 200
  res.status(200).send("OK");

  try {
    const itnData = req.body;

    if (!itnData || !itnData.m_payment_id) {
      console.error("❌ ITN: Missing payment data");
      return;
    }

    const paymentId = itnData.m_payment_id;
    const pfPaymentId = itnData.pf_payment_id;
    const paymentStatus = itnData.payment_status;
    const amountGross = itnData.amount_gross;

    console.log(`📋 Payment ID:  ${paymentId}`);
    console.log(`📋 PF Pay ID:   ${pfPaymentId}`);
    console.log(`📋 Status:      ${paymentStatus}`);
    console.log(`📋 Amount:      R${amountGross}`);

    // ── Step 1: Verify source IP ────────────────────────────────
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.ip;

    if (!payfastService.validateItnSourceIp(clientIp)) {
      console.error(`❌ ITN: Untrusted IP: ${clientIp}`);
      return;
    }
    console.log("✅ Step 1: Source IP verified");

    // ── Step 2: Find the payment record ─────────────────────────
    const pfPayment = await PayfastPayment.findOne({ paymentId });
    if (!pfPayment) {
      console.error(`❌ ITN: No payment record found for ${paymentId}`);
      return;
    }

    // Check if already processed
    if (pfPayment.status === "complete") {
      console.log(`⏭️  ITN: Payment ${paymentId} already processed`);
      return;
    }

    // ── Step 3: Verify signature ────────────────────────────────
    const cfg = payfastService.config();
    const sigValid = payfastService.validateItnSignature(
      itnData,
      cfg.passphrase || null
    );

    if (!sigValid) {
      console.error("❌ ITN: Signature validation failed");
      pfPayment.status = "failed";
      pfPayment.itnData = itnData;
      await pfPayment.save();
      return;
    }
    console.log("✅ Step 2: Signature verified");

    // ── Step 4: Verify amount ───────────────────────────────────
    if (!payfastService.validateItnAmount(amountGross, pfPayment.amount)) {
      console.error("❌ ITN: Amount mismatch");
      pfPayment.status = "failed";
      pfPayment.itnData = itnData;
      await pfPayment.save();
      return;
    }
    console.log("✅ Step 3: Amount verified");

    // ── Step 5: Confirm with PayFast servers ────────────────────
    const confirmed = await payfastService.confirmWithPayfast(itnData);
    if (!confirmed) {
      console.error("❌ ITN: Server confirmation failed");
      pfPayment.status = "failed";
      pfPayment.itnData = itnData;
      await pfPayment.save();
      return;
    }
    console.log("✅ Step 4: Server confirmation passed");

    // ── Step 6: Process based on payment status ─────────────────
    pfPayment.pfPaymentId = pfPaymentId;
    pfPayment.itnData = itnData;
    pfPayment.ipAddress = clientIp;

    if (paymentStatus === "COMPLETE") {
      console.log("💰 Processing COMPLETE payment...");

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Credit the wallet
        const wallet = await Wallet.findOne({ user: pfPayment.user }).session(
          session
        );

        if (!wallet) {
          throw new Error(`Wallet not found for user ${pfPayment.user}`);
        }

        const creditAmount = parseFloat(amountGross);
        wallet.balance += creditAmount;
        wallet.lastTransactionAt = new Date();
        await wallet.save({ session });

        // Update the transaction
        const transaction = await Transaction.findById(
          pfPayment.transaction
        ).session(session);

        if (transaction) {
          transaction.status = "completed";
          transaction.payfast.pfPaymentId = pfPaymentId;
          transaction.payfast.paymentStatus = paymentStatus;
          transaction.balanceAfter = wallet.balance;
          transaction.processedAt = new Date();
          await transaction.save({ session });
        }

        // Update PayFast payment record
        pfPayment.status = "complete";
        pfPayment.completedAt = new Date();
        await pfPayment.save({ session });

        await session.commitTransaction();
        session.endSession();

        console.log(
          `✅ Wallet credited: R${creditAmount.toFixed(2)} → user ${pfPayment.user}`
        );
        console.log(`   New balance: R${wallet.balance.toFixed(2)}`);
      } catch (txErr) {
        await session.abortTransaction();
        session.endSession();
        console.error("❌ ITN: Transaction processing failed:", txErr);

        pfPayment.status = "failed";
        await pfPayment.save();
      }
    } else if (paymentStatus === "CANCELLED") {
      console.log("🚫 Payment cancelled");
      pfPayment.status = "cancelled";
      pfPayment.cancelledAt = new Date();
      await pfPayment.save();

      // Update transaction
      await Transaction.findByIdAndUpdate(pfPayment.transaction, {
        status: "failed",
        failedReason: "Payment cancelled by user",
      });
    } else if (paymentStatus === "FAILED") {
      console.log("❌ Payment failed");
      pfPayment.status = "failed";
      await pfPayment.save();

      await Transaction.findByIdAndUpdate(pfPayment.transaction, {
        status: "failed",
        failedReason: `PayFast status: ${paymentStatus}`,
      });
    } else {
      console.log(`⏳ Payment status: ${paymentStatus} (not terminal)`);
      pfPayment.status = "pending";
      await pfPayment.save();
    }
  } catch (err) {
    console.error("❌ ITN processing error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/payfast/return  –  Success redirect (user lands here)
// ═══════════════════════════════════════════════════════════════
exports.handleReturn = async (req, res) => {
  const paymentId = req.query.pid || req.query.m_payment_id;
  console.log(`✅ PayFast return for payment: ${paymentId}`);

  // For mobile WebView, the frontend detects this URL and closes the modal.
  // For web, we show a nice confirmation page.
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Payment Successful</title>
      <style>
        body {
          display: flex; justify-content: center; align-items: center;
          height: 100vh; margin: 0; font-family: -apple-system, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
        }
        .container { text-align: center; padding: 40px; }
        .check {
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(255,255,255,0.2); display: inline-flex;
          align-items: center; justify-content: center;
          margin-bottom: 24px; font-size: 40px;
        }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p  { opacity: 0.85; margin: 0 0 24px; }
        .btn {
          display: inline-block; padding: 14px 32px;
          background: #fff; color: #5A0FC8; border-radius: 12px;
          font-weight: 700; text-decoration: none; font-size: 16px;
        }
      </style>
    </head><body>
      <div class="container">
        <div class="check">✓</div>
        <h1>Payment Successful!</h1>
        <p>Your wallet has been topped up. You can close this page.</p>
        <a class="btn" href="javascript:void(0)" onclick="window.close()">Close</a>
      </div>
    </body></html>
  `);
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/payfast/cancel  –  Cancel redirect
// ═══════════════════════════════════════════════════════════════
exports.handleCancel = async (req, res) => {
  const paymentId = req.query.pid || req.query.m_payment_id;
  console.log(`🚫 PayFast cancel for payment: ${paymentId}`);

  // Mark the payment & transaction as cancelled
  if (paymentId) {
    try {
      const pfPayment = await PayfastPayment.findOne({ paymentId });
      if (pfPayment && pfPayment.status === "created") {
        pfPayment.status = "cancelled";
        pfPayment.cancelledAt = new Date();
        await pfPayment.save();

        await Transaction.findByIdAndUpdate(pfPayment.transaction, {
          status: "failed",
          failedReason: "Cancelled by user",
        });
      }
    } catch (err) {
      console.error("Cancel cleanup error:", err);
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Payment Cancelled</title>
      <style>
        body {
          display: flex; justify-content: center; align-items: center;
          height: 100vh; margin: 0; font-family: -apple-system, sans-serif;
          background: #f5f5f5; color: #333;
        }
        .container { text-align: center; padding: 40px; }
        .icon {
          width: 80px; height: 80px; border-radius: 50%;
          background: #FFEBEE; display: inline-flex;
          align-items: center; justify-content: center;
          margin-bottom: 24px; font-size: 40px;
        }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p  { color: #666; margin: 0 0 24px; }
        .btn {
          display: inline-block; padding: 14px 32px;
          background: #5A0FC8; color: #fff; border-radius: 12px;
          font-weight: 700; text-decoration: none; font-size: 16px;
        }
      </style>
    </head><body>
      <div class="container">
        <div class="icon">✕</div>
        <h1>Payment Cancelled</h1>
        <p>No charges were made. You can close this page and try again.</p>
        <a class="btn" href="javascript:void(0)" onclick="window.close()">Close</a>
      </div>
    </body></html>
  `);
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/payfast/verify/:paymentId  –  Check payment status
//  (called by frontend after returning from PayFast)
// ═══════════════════════════════════════════════════════════════
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id || req.user._id;

    const pfPayment = await PayfastPayment.findOne({
      paymentId,
      user: userId,
    });

    if (!pfPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const wallet = await Wallet.findOne({ user: userId });

    res.json({
      success: true,
      payment: {
        paymentId: pfPayment.paymentId,
        amount: pfPayment.amount,
        status: pfPayment.status,
        completedAt: pfPayment.completedAt,
      },
      balance: wallet?.balance || 0,
    });
  } catch (err) {
    console.error("❌ verifyPayment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
};
