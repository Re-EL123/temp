const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
    {
        driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: false }, // Optional for now if general
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        date: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
