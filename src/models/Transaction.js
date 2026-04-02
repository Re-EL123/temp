/**
 * Transaction Model
 * Immutable ledger of all wallet movements: top-ups, payments,
 * earnings, withdrawals, refunds.
 */

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    type: {
      type: String,
      enum: ["credit", "debit", "withdrawal", "payment", "refund", "earning", "topup"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      required: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["completed", "pending", "failed", "processing"],
      default: "pending",
    },

    reference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // PayFast specific
    payfast: {
      paymentId: { type: String, default: null },
      pfPaymentId: { type: String, default: null },
      paymentStatus: { type: String, default: null },
    },

    // For withdrawals
    bankDetails: {
      bankName: String,
      accountNumber: String,
      accountType: String,
      branchCode: String,
      accountHolder: String,
    },

    // Flexible metadata (trip ID, child name, etc.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Balance snapshot after this transaction
    balanceAfter: {
      type: Number,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    failedReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ "payfast.paymentId": 1 });
transactionSchema.index({ status: 1, type: 1 });

/**
 * Virtual: date field that the frontend expects
 */
transactionSchema.virtual("date").get(function () {
  return this.createdAt;
});

// Ensure virtuals show in JSON
transactionSchema.set("toJSON", { virtuals: true });
transactionSchema.set("toObject", { virtuals: true });

/**
 * Static: generate a unique reference
 */
transactionSchema.statics.generateReference = function (prefix = "TXN") {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${ts}_${rand}`;
};

module.exports = mongoose.model("Transaction", transactionSchema);
