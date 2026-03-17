const express = require("express");
const router = express.Router();
const Voucher = require("../models/Voucher");
const User = require("../models/user");
const Transaction = require("../models/Transaction");
const verifyToken = require("../middleware/authMiddleware");

/**
 * @route   POST /api/vouchers/redeem
 * @desc    Redeem a voucher and add amount to user wallet
 * @access  Private (Parent/Driver)
 */
router.post("/redeem", verifyToken(), async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: "Voucher code is required" });
        }

        const voucher = await Voucher.findOne({ code: code.toUpperCase() });

        if (!voucher) {
            return res.status(404).json({ success: false, message: "Invalid voucher code" });
        }

        if (voucher.isRedeemed) {
            return res.status(400).json({ success: false, message: "Voucher already redeemed" });
        }

        if (voucher.expiryDate && voucher.expiryDate < new Date()) {
            return res.status(400).json({ success: false, message: "Voucher has expired" });
        }

        // Add amount to user wallet (assuming User model has walletBalance)
        // Check user model first
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update user balance
        user.walletBalance = (user.walletBalance || 0) + voucher.amount;
        await user.save();

        // Mark voucher as redeemed
        voucher.isRedeemed = true;
        voucher.redeemedBy = req.user.id;
        voucher.redeemedAt = new Date();
        await voucher.save();

        // Create transaction record
        if (Transaction) {
            await Transaction.create({
                userId: req.user.id,
                amount: voucher.amount,
                type: 'credit',
                description: `Voucher redemption: ${voucher.code}`,
                status: 'completed',
                paymentMethod: 'voucher'
            });
        }

        res.json({
            success: true,
            message: `Success! R${voucher.amount} has been added to your wallet.`,
            newBalance: user.walletBalance
        });

    } catch (error) {
        console.error("[VOUCHER_REDEEM] Error:", error);
        res.status(500).json({ success: false, message: "Server error during redemption", error: error.message });
    }
});

/**
 * @route   POST /api/vouchers/generate (Admin only)
 * @desc    Generate a new voucher
 * @access  Private (Admin)
 */
router.post("/generate", verifyToken(['admin']), async (req, res) => {
    try {
        const { code, amount, expiryDays } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }

        let voucherCode = code ? code.toUpperCase() : Math.random().toString(36).substring(2, 10).toUpperCase();

        const existing = await Voucher.findOne({ code: voucherCode });
        if (existing) {
            return res.status(400).json({ success: false, message: "Voucher code already exists" });
        }

        let expiryDate = null;
        if (expiryDays) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expiryDays);
        }

        const voucher = await Voucher.create({
            code: voucherCode,
            amount,
            expiryDate
        });

        res.status(201).json({ success: true, voucher });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

module.exports = router;
