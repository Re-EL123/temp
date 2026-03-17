const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        read: { type: Boolean, default: false },
        date: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
