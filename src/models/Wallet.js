/**
 * Wallet Model
 * Stores balance, pending balance, earnings stats, and bank details per user.
 * One wallet per user (parent or driver).
 */

const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    accountType: { type: String, default: "Savings" },
    branchCode: { type: String, default: "" },
    accountHolder: { type: String, default: "" },
  },
  { _id: false }
);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },

    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },

    currency: {
      type: String,
      default: "ZAR",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastTransactionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Instance method: safely credit the wallet
 * Uses save() to trigger validation + middleware
 */
walletSchema.methods.credit = async function (amount, session = null) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  this.balance += amount;
  this.lastTransactionAt = new Date();
  const opts = session ? { session } : {};
  return this.save(opts);
};

/**
 * Instance method: safely debit the wallet
 */
walletSchema.methods.debit = async function (amount, session = null) {
  if (amount <= 0) throw new Error("Debit amount must be positive");
  if (this.balance < amount) throw new Error("Insufficient balance");
  this.balance -= amount;
  this.lastTransactionAt = new Date();
  const opts = session ? { session } : {};
  return this.save(opts);
};

/**
 * Static: find or create wallet for a user
 */
walletSchema.statics.findOrCreate = async function (userId) {
  let wallet = await this.findOne({ user: userId });
  if (!wallet) {
    wallet = await this.create({ user: userId });
    console.log(`💰 Created new wallet for user ${userId}`);
  }
  return wallet;
};

module.exports = mongoose.model("Wallet", walletSchema);
