/**
 * PayfastPayment Model
 * Tracks the full lifecycle of each PayFast payment attempt.
 * Separate from Transaction so we can store raw ITN data for auditing.
 */

const mongoose = require("mongoose");

const payfastPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },

    // Our internal payment ID (m_payment_id sent to PayFast)
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // PayFast's own payment ID (returned in ITN)
    pfPaymentId: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    itemName: {
      type: String,
      default: "Wallet Top Up",
    },

    status: {
      type: String,
      enum: ["created", "pending", "complete", "failed", "cancelled"],
      default: "created",
    },

    // Raw ITN data for audit trail
    itnData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Form data we sent to PayFast (sans sensitive keys)
    formData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payfastPaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PayfastPayment", payfastPaymentSchema);
