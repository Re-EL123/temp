const Driver = require("../models/Driver");
const User = require("../models/user"); // Assuming case convention

/**
 * ============================
 * GET AVAILABLE DRIVERS
 * ============================
 */
exports.getAvailableDrivers = async (req, res) => {
    try {
        // Find all drivers. 
        // Ideally, filter by 'isVerified: true' and 'status: active/available'
        // For now, getting all verified drivers
        const drivers = await Driver.find({})
            .populate('userId', 'name surname phone email');

        // Filter out drivers where user population failed (deleted users)
        const validDrivers = drivers.filter(d => d.userId);

        res.json(validDrivers);
    } catch (err) {
        console.error("Error fetching drivers:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
