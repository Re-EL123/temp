const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Transaction = require('../models/Transaction');
const verifyToken = require('../middleware/authMiddleware');

// GET Wallet Balance
router.get('/balance', verifyToken(), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ balance: user.walletBalance || 0 });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// POST Initialize Payment (PayFast)
router.post('/initialize-payment', verifyToken(), async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        const transactionId = `TX_${Date.now()}`;

        const payfastData = {
            merchant_id: process.env.PAYFAST_MERCHANT_ID || '10000100', // Sandbox ID
            merchant_key: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
            return_url: `${process.env.FRONTEND_URL}/payment-success`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
            notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`,
            name_first: user.name,
            name_last: user.surname,
            email_address: user.email,
            m_payment_id: transactionId,
            amount: amount,
            item_name: 'Wallet Topup',
            custom_str1: user._id.toString() // Pass user ID to webhook
        };

        res.json({
            success: true,
            payfastUrl: 'https://sandbox.payfast.co.za/eng/process',
            data: payfastData
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// POST Webhook (PayFast Notification)
router.post('/webhook', async (req, res) => {
    try {
        const pfData = req.body;

        // Note: In real production, you MUST verify the signature from PayFast here

        if (pfData.payment_status === 'COMPLETE') {
            const userId = pfData.custom_str1;
            const amount = parseFloat(pfData.amount_gross);

            const user = await User.findById(userId);
            if (user) {
                user.walletBalance = (user.walletBalance || 0) + amount;
                await user.save();

                await Transaction.create({
                    userId: user._id,
                    amount: amount,
                    type: 'credit',
                    description: `Wallet Topup via PayFast (${pfData.m_payment_id})`
                });
                console.log(`[Payment Webhook] Success: Credited ${amount} to user ${userId}`);
            } else {
                console.error(`[Payment Webhook] User not found: ${userId}`);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('[Payment Webhook] Error:', error);
        res.sendStatus(500);
    }
});

// POST Topup Wallet (Manual Support)
router.post('/topup', verifyToken(), async (req, res) => {
    try {
        const { amount, method } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.walletBalance = (user.walletBalance || 0) + Number(amount);
        await user.save();

        await Transaction.create({
            userId: user._id,
            amount: Number(amount),
            type: 'credit',
            description: `Wallet Topup via ${method || 'app'}`
        });

        res.json({ message: "Topup successful", balance: user.walletBalance });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// GET Transaction History
router.get('/history', verifyToken(), async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
