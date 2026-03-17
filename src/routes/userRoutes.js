const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/user");
const Child = require("../models/Child");
const Trip = require("../models/trip.model");
const Driver = require("../models/Driver");

/**
 * @desc Get authenticated user's profile
 * Supports both /api/user/profile and /api/users/profile.
 * Includes "self-healing" logic to ensure children arrays stay in sync between User and Child collections.
 * @route GET /api/user/profile
 * @access Private (Parent/Driver/Admin)
 */
router.get("/profile", verifyToken(), async (req, res) => {
    try {
        let user = await User.findById(req.user.id)
            .select("-password -__v")
            .populate('children');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // SELF-HEALING: Syncs the parent's children array if they were added via Child collection directly
        if (user.role === 'parent') {
            const childrenFromDb = await Child.find({ parentId: user._id });
            if (childrenFromDb.length > (user.children ? user.children.length : 0)) {
                console.log(`[USER_ROUTES] Self-healing children for parent ${user._id}`);
                const childIds = childrenFromDb.map(c => c._id);
                user = await User.findByIdAndUpdate(
                    user._id,
                    { $set: { children: childIds } },
                    { new: true }
                ).populate('children').select("-password -__v");
            }
        }

        let driverDetails = null;
        if (user.role === 'driver') {
            driverDetails = await Driver.findOne({ userId: user._id });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address,
                location: user.location,
                profilePhoto: user.profilePhoto,
                children: user.children || [],
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                driverInfo: driverDetails ? {
                    id: driverDetails._id,
                    registrationNumber: driverDetails.registrationNumber,
                    carBrand: driverDetails.carBrand,
                    carModel: driverDetails.carModel,
                    vehicleSeats: driverDetails.vehicleSeats,
                    cellNumber: driverDetails.cellNumber,
                    isVerified: driverDetails.isVerified,
                    status: driverDetails.status
                } : null
            }
        });
    } catch (error) {
        console.error("[USER_ROUTES] Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

/**
 * @desc Update user profile data
 * Allows users to update basic info. Drivers can also update their vehicle details here.
 * @route PUT /api/user/profile
 * @access Private
 */
router.put("/profile", verifyToken(), async (req, res) => {
    try {
        const { name, surname, phone, address, location, latitude, longitude, profilePhoto, isActive, driverInfo } = req.body;

        // Update core User profile
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                $set: {
                    name,
                    surname,
                    phone,
                    address: address || location,
                    location: location || address,
                    latitude,
                    longitude,
                    profilePhoto,
                    isActive
                }
            },
            { new: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update Driver-specific metadata profile if applicable
        if (updatedUser.role === 'driver' && driverInfo) {
            await Driver.findOneAndUpdate(
                { userId: updatedUser._id },
                {
                    $set: {
                        registrationNumber: driverInfo.registrationNumber,
                        carBrand: driverInfo.carBrand,
                        carModel: driverInfo.carModel,
                        vehicleSeats: driverInfo.vehicleSeats,
                        cellNumber: driverInfo.cellNumber
                    }
                },
                { upsert: true, new: true }
            );
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("[USER_ROUTES] Update Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

/**
 * @desc Discovery: Get nearby verified drivers
 * Uses MongoDB geospatial $near query to find drivers within a specified radius (in meters).
 * @route GET /api/user/drivers/available
 * @access Public/Private
 */
router.get("/drivers/available", async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        let drivers = [];

        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const maxDistance = parseInt(radius) || 10000;

            // Use aggregation to get distance calculated by MongoDB
            drivers = await Driver.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [longitude, latitude] },
                        distanceField: "distance",
                        maxDistance: maxDistance,
                        spherical: true,
                        query: { isVerified: true }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userDetails"
                    }
                },
                {
                    $unwind: "$userDetails"
                },
                {
                    $project: {
                        _id: 1,
                        registrationNumber: 1,
                        carBrand: 1,
                        carModel: 1,
                        vehicleSeats: 1,
                        rating: 1,
                        status: 1,
                        distance: 1,
                        location: 1,
                        userId: {
                            _id: "$userDetails._id",
                            name: "$userDetails.name",
                            surname: "$userDetails.surname",
                            phone: "$userDetails.phone",
                            email: "$userDetails.email",
                            profilePhoto: "$userDetails.profilePhoto"
                        }
                    }
                }
            ]);

            // Convert distance from meters to km (production logs showed values like 36.6)
            drivers = drivers.map(d => ({
                ...d,
                distance: parseFloat((d.distance / 1000).toFixed(1)),
                latitude: d.location.coordinates[1],
                longitude: d.location.coordinates[0]
            }));
        } else {
            drivers = await Driver.find({ isVerified: true })
                .populate('userId', 'name surname phone email profilePhoto');

            drivers = drivers.filter(d => d.userId).map(d => ({
                ...d.toObject(),
                latitude: d.location.coordinates[1],
                longitude: d.location.coordinates[0],
                distance: 0 // Default if no reference point
            }));
        }

        res.json({
            success: true,
            count: drivers.length,
            drivers: drivers
        });
    } catch (err) {
        console.error("[USER_ROUTES] Drivers Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
});

/**
 * Children Management Delegation
 */
const childRoutes = require('./childRoutes');
router.use('/children', childRoutes);

/**
 * @desc Update Expo Push Token
 * Used for routing push notifications to the correct physical device.
 * @route PUT /api/user/push-token
 * @access Private
 */
router.put("/push-token", verifyToken(), async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) {
            return res.status(400).json({ success: false, message: "Push token is required" });
        }

        await User.findByIdAndUpdate(req.user.id, { $set: { pushToken } });
        res.json({ success: true, message: "Push token updated successfully" });
    } catch (error) {
        console.error("[USER_ROUTES] Push Token Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @desc Fetch User Privacy Settings
 * @route GET /api/user/privacy
 */
router.get("/privacy", verifyToken(), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("privacySettings");
        res.json({ success: true, privacySettings: user.privacySettings || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @desc Update User Privacy Settings
 * @route PUT /api/user/privacy
 */
router.put("/privacy", verifyToken(), async (req, res) => {
    try {
        const { privacySettings } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { privacySettings } },
            { new: true }
        ).select("privacySettings");
        res.json({ success: true, privacySettings: updatedUser.privacySettings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @desc Permanent Account Deletion
 * Performs a cleanup of associated driver profiles and children.
 * Note: Trip history is preserved but dissociated.
 * @route DELETE /api/user/profile
 * @access Private
 */
router.delete("/profile", verifyToken(), async (req, res) => {
    try {
        const userId = req.user.id;

        await Driver.findOneAndDelete({ userId });
        await Child.deleteMany({ parentId: userId });

        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "Account successfully deleted" });
    } catch (error) {
        console.error("[USER_ROUTES] Delete Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

/**
 * @desc Get User Activity (Recent Trips)
 * @route GET /api/user/activity-logs
 */
router.get("/activity-logs", verifyToken(), async (req, res) => {
    try {
        const Trip = require("../models/trip.model");
        const logs = await Trip.find({ parent: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
