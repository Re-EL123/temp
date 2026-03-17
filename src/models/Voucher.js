const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    isRedeemed: {
        type: Boolean,
        default: false
    },
    redeemedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    redeemedAt: {
        type: Date,
        default: null
    },
    expiryDate: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Voucher", voucherSchema);
