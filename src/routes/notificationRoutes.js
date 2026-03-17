const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const verifyToken = require('../middleware/authMiddleware');

// GET User Notifications
router.get('/', verifyToken(), async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Create Mock Notification (For testing)
router.post('/test', verifyToken(), async (req, res) => {
    try {
        const { title, message } = req.body;
        const note = await Notification.create({
            userId: req.user.id,
            title,
            message
        });
        res.json(note);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Mark as Read
router.put('/:id/read', verifyToken(), async (req, res) => {
    try {
        const note = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { read: true },
            { new: true }
        );
        res.json(note);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Delete Notification
router.delete('/:id', verifyToken(), async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Clear All
router.delete('/', verifyToken(), async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });
        res.json({ message: "All notifications cleared" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
