const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const verifyToken = require('../middleware/authMiddleware');

// GET all reviews (demo) or per driver
router.get('/', async (req, res) => {
    try {
        const reviews = await Review.find().populate("parentId", "name surname").sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// GET reviews for a specific driver
router.get('/driver/:driverId', async (req, res) => {
    try {
        const { driverId } = req.params;
        const reviews = await Review.find({ driverId }).populate("parentId", "name surname").sort({ createdAt: -1 });
        res.json({ success: true, reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


// POST a review
router.post('/', verifyToken(), async (req, res) => {
    try {
        const { rating, comment, driverId } = req.body;

        if (!rating || !comment) {
            return res.status(400).json({ message: "Rating and comment required" });
        }

        const review = await Review.create({
            parentId: req.user.id,
            driverId: driverId || null, // Optional if generic
            rating,
            comment
        });

        // Return with populated user
        const populatedReview = await Review.findById(review._id).populate("parentId", "name surname");
        res.status(201).json(populatedReview);

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
