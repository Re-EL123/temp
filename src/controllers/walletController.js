/**
 * Wallet Controller
 * Handles balance queries, top-up initiation, withdrawals,
 * and bank detail management.
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const PayfastPayment = require("../models/PayfastPayment");
const payfastService = require("../services/payfastService");

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet  –  Fetch wallet overview
// ═══════════════════════════════════════════════════════════════
exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const wallet = await Wallet.findOrCreate(userId);

    // Fetch recent transactions (last 50)
    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Calculate monthly earnings (for drivers)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyAgg = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: { $in: ["earning", "credit"] },
          status: "completed",
          createdAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const monthlyEarnings = monthlyAgg[0]?.total || 0;

    // Pending transactions total
    const pendingAgg = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          status: { $in: ["pending", "processing"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const pendingBalance = pendingAgg[0]?.total || 0;

    res.json({
      success: true,
      balance: wallet.balance,
      pendingBalance,
      totalEarnings: wallet.totalEarnings,
      monthlyEarnings,
      totalWithdrawn: wallet.totalWithdrawn,
      currency: wallet.currency,
      bankDetails: wallet.bankDetails,
      transactions: transactions.map((tx) => ({
        _id: tx._id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date: tx.createdAt,
        status: tx.status,
        reference: tx.reference,
      })),
    });
  } catch (err) {
    console.error("❌ getWallet error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch wallet" });
  }
};

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/topup  –  Initiate PayFast top-up (Parent)
// ═══════════════════════════════════════════════════════════════
exports.initiateTopUp = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { amount } = req.body;

    // Validation
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum top-up is R 10.00",
      });
    }
    if (amt > 50000) {
      return res.status(400).json({
        success: false,
        message: "Maximum top-up is R 50,000.00",
      });
    }

    // Ensure wallet exists
    const wallet = await Wallet.findOrCreate(userId);

    // Generate unique payment ID
    const paymentId = `PF_${userId.toString().slice(-6)}_${Date.now()}`;
    const reference = Transaction.generateReference("TOP");

    // Create pending transaction
    const transaction = await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "topup",
      amount: amt,
      description: `Wallet top-up via PayFast`,
      status: "pending",
      reference,
      payfast: { paymentId },
    });

    // Create PayFast payment record
    await PayfastPayment.create({
      user: userId,
      transaction: transaction._id,
      paymentId,
      amount: amt,
      itemName: "Wallet Top Up",
      status: "created",
      formData: { amount: amt, reference },
    });

    // Build PayFast form
    const firstName = req.user.name || "";
    const email = req.user.email || "";

    const payFastHtml = payfastService.buildPaymentHtml({
      paymentId,
      amount: amt,
      itemName: "Wallet Top Up",
      firstName,
      email,
    });

    const paymentData = payfastService.buildPaymentData({
      paymentId,
      amount: amt,
      itemName: "Wallet Top Up",
      firstName,
      email,
    });

    console.log(`💳 Top-up initiated: ${paymentId} for R${amt.toFixed(2)} by user ${userId}`);

    res.json({
      success: true,
      paymentId,
      transactionId: transaction._id,
      payFastHtml,
      paymentData: paymentData.formData,
      processUrl: paymentData.processUrl,
    });
  } catch (err) {
    console.error("❌ initiateTopUp error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to initiate top-up",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/withdraw  –  Request withdrawal (Driver)
// ═══════════════════════════════════════════════════════════════
exports.requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id || req.user._id;
    const { amount, bankDetails } = req.body;

    // Role check
    if (req.user.role !== "driver") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Only drivers can request withdrawals",
      });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 50) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Minimum withdrawal is R 50.00",
      });
    }

    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (wallet.balance < amt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Use provided bank details or saved ones
    const bank = bankDetails || wallet.bankDetails;
    if (!bank?.accountNumber || !bank?.bankName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Bank details are required for withdrawal",
      });
    }

    const reference = Transaction.generateReference("WDR");

    // Debit balance atomically
    wallet.balance -= amt;
    wallet.totalWithdrawn += amt;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    // Create processing transaction
    const transaction = await Transaction.create(
      [
        {
          user: userId,
          wallet: wallet._id,
          type: "withdrawal",
          amount: amt,
          description: `Withdrawal to ${bank.bankName} (...${bank.accountNumber.slice(-4)})`,
          status: "processing",
          reference,
          bankDetails: bank,
          balanceAfter: wallet.balance,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(
      `💸 Withdrawal requested: ${reference} for R${amt.toFixed(2)} by driver ${userId}`
    );

    res.json({
      success: true,
      message: "Withdrawal request submitted. Processing takes 1-3 business days.",
      reference,
      transactionId: transaction[0]._id,
      newBalance: wallet.balance,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ requestWithdrawal error:", err);
    res.status(500).json({
      success: false,
      message: err.message === "Insufficient balance"
        ? err.message
        : "Failed to process withdrawal",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PUT /api/wallet/bank-details  –  Save bank details (Driver)
// ═══════════════════════════════════════════════════════════════
exports.updateBankDetails = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { bankDetails } = req.body;

    if (!bankDetails) {
      return res.status(400).json({
        success: false,
        message: "Bank details are required",
      });
    }

    const { bankName, accountNumber, accountType, branchCode, accountHolder } =
      bankDetails;

    if (!bankName || !accountNumber || !branchCode || !accountHolder) {
      return res.status(400).json({
        success: false,
        message: "Bank name, account number, branch code, and account holder are required",
      });
    }

    // Basic validation
    if (accountNumber.length < 5 || accountNumber.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Invalid account number length",
      });
    }

    if (branchCode.length < 4 || branchCode.length > 7) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch code",
      });
    }

    const wallet = await Wallet.findOrCreate(userId);

    wallet.bankDetails = {
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountType: accountType || "Savings",
      branchCode: branchCode.trim(),
      accountHolder: accountHolder.trim(),
    };

    await wallet.save();

    console.log(`🏦 Bank details updated for user ${userId}`);

    res.json({
      success: true,
      message: "Bank details saved successfully",
      bankDetails: wallet.bankDetails,
    });
  } catch (err) {
    console.error("❌ updateBankDetails error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save bank details",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet/transactions  –  Paginated transaction list
// ═══════════════════════════════════════════════════════════════
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const type = req.query.type; // optional filter
    const status = req.query.status; // optional filter

    const filter = { user: userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        _id: tx._id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date: tx.createdAt,
        status: tx.status,
        reference: tx.reference,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("❌ getTransactions error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/pay  –  Pay for a trip (Parent → Driver)
// ═══════════════════════════════════════════════════════════════
exports.payForTrip = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id || req.user._id;
    const { tripId, driverId, amount, description } = req.body;

    if (!driverId || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Driver ID and amount are required",
      });
    }

    const amt = parseFloat(amount);

    // Get parent wallet
    const parentWallet = await Wallet.findOne({ user: userId }).session(session);
    if (!parentWallet || parentWallet.balance < amt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // Get or create driver wallet
    let driverWallet = await Wallet.findOne({ user: driverId }).session(session);
    if (!driverWallet) {
      driverWallet = await Wallet.create([{ user: driverId }], { session });
      driverWallet = driverWallet[0];
    }

    const reference = Transaction.generateReference("PAY");

    // Debit parent
    parentWallet.balance -= amt;
    parentWallet.lastTransactionAt = new Date();
    await parentWallet.save({ session });

    // Credit driver
    driverWallet.balance += amt;
    driverWallet.totalEarnings += amt;
    driverWallet.lastTransactionAt = new Date();
    await driverWallet.save({ session });

    // Create parent debit transaction
    await Transaction.create(
      [
        {
          user: userId,
          wallet: parentWallet._id,
          type: "payment",
          amount: amt,
          description: description || "Trip payment",
          status: "completed",
          reference,
          balanceAfter: parentWallet.balance,
          metadata: { tripId, driverId },
          processedAt: new Date(),
        },
      ],
      { session }
    );

    // Create driver earning transaction
    await Transaction.create(
      [
        {
          user: driverId,
          wallet: driverWallet._id,
          type: "earning",
          amount: amt,
          description: description || "Trip earning",
          status: "completed",
          reference: `${reference}_E`,
          balanceAfter: driverWallet.balance,
          metadata: { tripId, parentId: userId },
          processedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(`💰 Payment: R${amt.toFixed(2)} from ${userId} to driver ${driverId}`);

    res.json({
      success: true,
      message: "Payment successful",
      reference,
      newBalance: parentWallet.balance,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ payForTrip error:", err);
    res.status(500).json({
      success: false,
      message: "Payment failed",
    });
  }
};
