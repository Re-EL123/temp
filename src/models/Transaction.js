const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ["credit", "debit"], required: true },
        description: { type: String, required: true },
        date: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
