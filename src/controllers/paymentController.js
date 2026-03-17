const mongoose = require('mongoose');
const Payment = require('../models/payment');

/* ---------------------- CREATE PAYMENT ---------------------- */
const createPayment = async (req, res) => {
    try {
        const { driverId, amount, method, status, description } = req.body;

        if (!driverId || !amount) {
            return res.status(400).json({ message: 'driverId and amount are required' });
        }

        const payment = await Payment.create({
            driverId,
            amount,
            method,
            status,
            description
        });

        res.status(201).json({ message: 'Payment created successfully', payment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- GET ALL PAYMENTS WITH FILTER & PAGINATION ---------------------- */
const getPayments = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = {};
        if (status && ['pending', 'completed', 'declined'].includes(status)) {
            query.status = status;
        }

        const payments = await Payment.find(query)
            .populate('driverId', 'name email')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            payments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- GET PAYMENT BY ID ---------------------- */
const getPaymentById = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).populate('driverId', 'name email');

        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        res.status(200).json(payment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- UPDATE PAYMENT STATUS ---------------------- */
const updatePaymentStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'completed', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        res.status(200).json({ message: 'Payment status updated', payment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- GET PAYMENTS FOR A DRIVER ---------------------- */
const getDriverPayments = async (req, res) => {
    try {
        const { driverId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { driverId };
        if (status && ['pending', 'completed', 'declined'].includes(status)) {
            query.status = status;
        }

        const payments = await Payment.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            payments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- GET DRIVER EARNINGS ---------------------- */
const getDriverEarnings = async (req, res) => {
    try {
        const { driverId } = req.params;

        const result = await Payment.aggregate([
            { $match: { driverId: new mongoose.Types.ObjectId(driverId), status: 'completed' } },
            { $group: { _id: '$driverId', totalEarnings: { $sum: '$amount' } } }
        ]);

        const totalEarnings = result[0]?.totalEarnings || 0;

        res.status(200).json({ driverId, totalEarnings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* ---------------------- EXPORT CONTROLLER ---------------------- */
module.exports = {
    createPayment,
    getPayments,
    getPaymentById,
    updatePaymentStatus,
    getDriverPayments,
    getDriverEarnings
};
