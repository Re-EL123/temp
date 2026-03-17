const Withdrawal = require("../models/withdrawal");
const Driver = require("../models/Driver");
const User = require("../models/user");

exports.requestWithdrawal = async (req, res) => {
    try {
        const { amount, bankDetails } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const driver = await Driver.findOne({ userId });
        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        if ((driver.walletBalance || 0) < amount) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }

        const withdrawal = new Withdrawal({
            driver: driver._id,
            userId: userId,
            amount,
            bankDetails
        });

        await withdrawal.save();

        // Deduct from balance immediately or wait for approval?
        // Usually we deduct immediately and "freeze" the funds.
        driver.walletBalance = (driver.walletBalance || 0) - amount;
        await driver.save();

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully",
            withdrawal
        });
    } catch (error) {
        console.error("[WITHDRAWAL_CONTROLLER] Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.getWithdrawalHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await Withdrawal.find({ userId }).sort({ createdAt: -1 });

        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error("[WITHDRAWAL_CONTROLLER] History Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
