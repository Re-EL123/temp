const User = require("../models/user");
const Driver = require("../models/driver");
const Trip = require("../models/trip.model");

/**
 * @desc Get Admin Dashboard Statistics
 * Aggregates core system metrics like total users, drivers, active trips, and pending approvals.
 * @route GET /api/admin/stats
 * @returns {Object} JSON object containing counts for parents, drivers, pending verifications, and active trips.
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // Run all count queries in parallel for better performance
        const [userCount, driverCount, pendingVerification, activeTrips] = await Promise.all([
            User.countDocuments({ role: 'parent' }),
            Driver.countDocuments(),
            Driver.countDocuments({ isVerified: false }),
            Trip.countDocuments({ status: 'started' })
        ]);

        res.json({
            success: true,
            stats: {
                totalParents: userCount,
                totalDrivers: driverCount,
                pendingVerification,
                activeTrips
            }
        });
    } catch (error) {
        console.error("[ADMIN_STATS] Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * @desc List all drivers with user details
 * Retrieves the full list of drivers and joins them with their basic identity information from the User model.
 * @route GET /api/admin/drivers
 * @returns {Array} List of drivers with populated name, surname, email, and phone.
 */
exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find().populate('userId', 'name surname email phone');
        res.json({ success: true, drivers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * @desc Verify / Unverify a driver
 * Updates the verification status of a driver. Once verified, a driver can accept trip requests.
 * @route PATCH /api/admin/verify-driver/:id
 * @param {string} id - The MongoDB ID of the Driver document.
 * @param {boolean} verified - The target verification status.
 */
exports.verifyDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;

        const driver = await Driver.findByIdAndUpdate(
            id,
            { isVerified: verified },
            { new: true }
        ).populate('userId', 'name surname');

        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        res.json({
            success: true,
            message: `Driver ${driver.userId.name} ${verified ? 'verified' : 'unverified'} successfully`,
            driver
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * @desc Get all trips for global monitoring
 * Retrieves every trip in the system, sorted by newest first, for admin oversight.
 * @route GET /api/admin/trips
 * @returns {Array} List of trips with populated parent and driver data.
 */
exports.getAllTrips = async (req, res) => {
    try {
        const trips = await Trip.find()
            .populate('parent', 'name surname email')
            .populate('driver', 'userId')
            .sort({ createdAt: -1 });

        res.json({ success: true, trips });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * @desc Get all registered users
 * Fetches all users (parents/drivers/admins) excluding their password hashes for security.
 * @route GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * @desc Delete a user and associated driver profile
 * Performs a cascading delete: removes the user and their driver document if it exists.
 * @route DELETE /api/admin/users/:id
 */
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Clean up driver profile if they were a driver
        await Driver.findOneAndDelete({ userId: user._id });

        res.json({ success: true, message: "User and associated data deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
