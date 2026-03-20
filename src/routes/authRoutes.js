const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/Driver");
const Child = require("../models/Child");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

// Handle preflight for auth routes to ensure CORS compatibility
router.options(/(.*)/, (req, res) => {
  res.status(200).end();
});

/**
 * @desc Fetch current authenticated user's basic profile
 * @route GET /api/auth/profile
 * @access Private
 */
router.get("/profile", verifyToken(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @desc Update authenticated user's profile
 * Allows changing name, email, phone, and password (re-hashes on update).
 * @route PUT /api/auth/profile
 * @access Private
 */
router.put("/profile", verifyToken(), async (req, res) => {
  try {
    const { name, surname, email, phone, address, password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (surname) user.surname = surname;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @desc Register a new user
 * Handles both Parent and Driver registration.
 * - Drivers: stores vehicle info on User model + creates Driver document
 * - Parents: creates Child document + links to User
 *
 * Frontend sends:
 *   { name, surname, email, password, role, phone, address,
 *     isSouthAfrican, idNumber, passportNumber,
 *     acceptedTerms, acceptedPrivacy, onboardingCompleted,
 *     driverProfile: { carBrand, carModel, carYear, carColor,
 *       registrationNumber, passengerSeats, hasChildSeats,
 *       licenseNumber, hasPrDP, operatingArea, typicalOperatingHours },
 *     parentProfile: { primaryChildName, primaryChildSchool,
 *       primaryChildGrade, primaryRoutePickup, primaryRouteDropoff,
 *       emergencyContactName, emergencyContactPhone,
 *       emergencyContactRelationship }
 *   }
 *
 * @route POST /api/auth/register
 * @access Public
 */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      surname,
      email,
      password,
      role,
      phone,
      address,
      onboardingCompleted,
      // Identity verification
      isSouthAfrican,
      idNumber,
      passportNumber,
      // Agreements
      acceptedTerms,
      acceptedPrivacy,
      // Role-specific profiles from frontend
      driverProfile,
      parentProfile,
      // Legacy flat fields (backwards compatibility with older frontend)
      registrationNumber,
      carBrand,
      carModel,
      passengerSeats,
      cellNumber,
    } = req.body;

    // ── Validation ──────────────────────────────────────
    if (!name || !surname || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, Surname, email & password required" });
    }

    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ── Hash password ───────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Build User document ─────────────────────────────
    const userData = {
      name,
      surname,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "parent",
      phone: phone || cellNumber || "",
      address: address || "",
      location: address || "",
      onboardingCompleted: onboardingCompleted || false,
    };

    // ── If driver: store vehicle info on User model ─────
    if (role === "driver") {
      // Prefer driverProfile object, fall back to flat fields
      const dp = driverProfile || {};
      userData.carBrand = dp.carBrand || carBrand || "";
      userData.carModel = dp.carModel || carModel || "";
      userData.carYear = dp.carYear || "";
      userData.carColor = dp.carColor || "";
      userData.registrationNumber =
        dp.registrationNumber || registrationNumber || "";
      userData.licenseNumber = dp.licenseNumber || "";
      userData.onboardingCompleted = true;
    }

    const newUser = await User.create(userData);

    console.log(
      `[Register] User created: ${newUser._id} (${role || "parent"}) - ${email}`
    );

    // ── If driver: create Driver model document ─────────
    if (role === "driver") {
      try {
        const dp = driverProfile || {};
        await Driver.create({
          userId: newUser._id,
          registrationNumber:
            dp.registrationNumber || registrationNumber || "",
          carBrand: dp.carBrand || carBrand || "",
          carModel: dp.carModel || carModel || "",
          carYear: dp.carYear || "",
          carColor: dp.carColor || "",
          vehicleSeats: dp.passengerSeats || passengerSeats || 0,
          passengerSeats: dp.passengerSeats || passengerSeats || 0,
          licenseNumber: dp.licenseNumber || "",
          cellNumber: phone || cellNumber || "",
          hasChildSeats: dp.hasChildSeats || false,
          hasPrDP: dp.hasPrDP || false,
          operatingArea: dp.operatingArea || "",
          typicalOperatingHours: dp.typicalOperatingHours || "",
          isSouthAfrican: isSouthAfrican || false,
          idNumber: idNumber || "",
          status: "offline",
          isVerified: false,
        });

        console.log(
          `[Register] Driver profile created for user ${newUser._id}`
        );
      } catch (driverErr) {
        console.error(
          "[Register] Driver profile creation error (non-fatal):",
          driverErr.message
        );
      }
    }

    // ── If parent: create Child document ────────────────
    if (
      role === "parent" &&
      parentProfile &&
      parentProfile.primaryChildName
    ) {
      try {
        const pp = parentProfile;

        const child = await Child.create({
          parentId: newUser._id,
          name: pp.primaryChildName || "",
          surname: surname || "",
          age: 0,
          gender: "male",
          schoolName: pp.primaryChildSchool || "",
          grade: pp.primaryChildGrade || "",
          homeAddress: {
            type: "Point",
            coordinates: [0, 0],
            address: pp.primaryRoutePickup || address || "",
          },
          schoolAddress: {
            type: "Point",
            coordinates: [0, 0],
            address: pp.primaryRouteDropoff || "",
          },
          parentName: `${name} ${surname}`,
          relationship: pp.emergencyContactRelationship || "Parent",
          parentContact: phone || "",
        });

        // Link child to parent user
        await User.findByIdAndUpdate(newUser._id, {
          $push: { children: child._id },
        });

        console.log(
          `[Register] Child "${pp.primaryChildName}" created and linked to parent ${newUser._id}`
        );
      } catch (childErr) {
        console.error(
          "[Register] Child creation error (non-fatal):",
          childErr.message
        );
      }
    }

    // ── Generate JWT ────────────────────────────────────
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        surname: newUser.surname,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[Register] Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already registered" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @desc Authenticate user & get JWT token
 * @route POST /api/auth/login
 * @access Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email & password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @desc Request password reset OTP
 * Generates a 4-digit code and expires it in 10 minutes.
 * @route POST /api/auth/forgot-password
 * @access Public
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    console.log(`[AUTH] OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: "OTP sent to email (check server logs for testing)",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

/**
 * @desc Reset password using OTP
 * Validates the token and updates the password hash.
 * @route POST /api/auth/reset-password
 * @access Public
 */
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOTP = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

module.exports = router;
