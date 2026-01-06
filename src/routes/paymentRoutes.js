const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create a new payment
router.post('/', paymentController.createPayment);

// Get all payments
router.get('/', paymentController.getPayments);

// Get a payment by ID
router.get('/:id', paymentController.getPaymentById);

// Update payment status
router.patch('/:id/status', paymentController.updatePaymentStatus);

// Get all payments for a specific driver (with optional status & pagination)
router.get('/driver/:driverId', paymentController.getDriverPayments);


module.exports = router;
