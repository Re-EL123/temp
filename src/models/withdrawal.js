const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: [1, "Minimum withdrawal amount is 1"]
        },
        status: {
            type: String,
            enum: ["pending", "processed", "rejected", "cancelled"],
            default: "pending"
        },
        bankDetails: {
            accountName: String,
            accountNumber: String,
            bankName: String,
            branchCode: String
        },
        processedAt: Date,
        rejectionReason: String
    },
    { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
