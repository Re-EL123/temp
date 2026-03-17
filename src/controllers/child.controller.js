const Child = require("../models/child");
const User = require("../models/user");
const Trip = require("../models/trip.model");
const { getIO } = require("../socket");

/**
 * @desc Add a new child profile to a parent's account
 * Creates a child record and links it to the authenticated parent user.
 * @route POST /api/children/add
 */
exports.addChild = async (req, res) => {
    try {
        const parentId = req.user.id;
        const {
            name,
            surname,
            age,
            gender,
            schoolName,
            grade,
            homeAddress,
            schoolAddress,
            parentContact,
            relationship,
            photoUrl
        } = req.body;

        if (!name || !surname || !age || !gender || !schoolName || !homeAddress || !parentContact) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const parentUser = await User.findById(parentId);

        const newChild = await Child.create({
            parentId,
            name,
            surname,
            age,
            gender,
            schoolName,
            grade,
            homeAddress: typeof homeAddress === 'string' ? { address: homeAddress, type: 'Point', coordinates: [0, 0] } : { ...homeAddress, type: 'Point' },
            schoolAddress: typeof schoolAddress === 'string' ? { address: schoolAddress, type: 'Point', coordinates: [0, 0] } : { ...schoolAddress, type: 'Point' },
            parentName: parentUser ? `${parentUser.name} ${parentUser.surname}` : "Unknown Parent",
            relationship: relationship || "Parent",
            parentContact,
            photoUrl
        });

        // Maintain the bi-directional relationship in the User model
        await User.findByIdAndUpdate(parentId, {
            $push: { children: newChild._id }
        });

        // Notify other logged-in sessions for this parent (Real-time sync)
        getIO().emit("child:added", {
            child: newChild,
            parent: {
                id: parentId,
                name: parentUser ? `${parentUser.name} ${parentUser.surname}` : "Unknown Parent"
            }
        });

        res.status(201).json({ message: "Child added successfully", child: newChild });
    } catch (err) {
        console.error("Error adding child:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * @desc Fetch all children profiles
 * Behavior varies by role: Parents see their own children, Drivers see children assigned to their active trips.
 * @route GET /api/children
 */
exports.getChildren = async (req, res) => {
    try {
        if (req.user.role === 'driver') {
            const Driver = require("../models/driver");
            const driver = await Driver.findOne({ userId: req.user.id });
            if (!driver) return res.status(404).json({ message: "Driver not found" });

            // Drivers only get access to children they are currently transporting
            const trips = await Trip.find({
                driver: driver._id,
                status: { $in: ['assigned', 'in_progress'] }
            }).populate('children');

            const childrenMap = new Map();
            trips.forEach(trip => {
                if (trip.children && Array.isArray(trip.children)) {
                    trip.children.forEach(c => childrenMap.set(c._id.toString(), c));
                }
            });
            const children = Array.from(childrenMap.values());
            return res.json(children);
        } else {
            // Parents get their registered children
            const children = await Child.find({ parentId: req.user.id }).sort({ createdAt: -1 });
            res.json({ success: true, children: children });
        }
    } catch (err) {
        console.error("Error fetching children:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * @desc Get details for a single child
 * @route GET /api/children/:id
 */
exports.getChild = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CHILD_CONTROLLER] Fetching child details for ID: ${id} requested by user: ${req.user.id}`);
        const child = await Child.findById(id);

        if (!child) {
            console.log(`[CHILD_CONTROLLER] Child not found with ID: ${id}`);
            return res.status(404).json({ message: "Child not found" });
        }

        // Security check: Only the parent can view full details
        if (child.parentId.toString() !== req.user.id && req.user.role !== 'admin') {
            console.log(`[CHILD_CONTROLLER] Unauthorized access attempt for child ${id} by user ${req.user.id}`);
            return res.status(403).json({ message: "Unauthorized access" });
        }

        res.json(child);
    } catch (err) {
        console.error(`[CHILD_CONTROLLER] Error getting child ${req.params.id}:`, err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * @desc Update a child's profile details
 * @route PUT /api/children/:id
 */
exports.updateChild = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        console.log(`[CHILD_CONTROLLER] Updating child ${id} requested by user: ${req.user.id}`);

        const child = await Child.findById(id);
        if (!child) {
            console.log(`[CHILD_CONTROLLER] Child not found: ${id}`);
            return res.status(404).json({ message: "Child not found" });
        }
        
        if (child.parentId.toString() !== req.user.id && req.user.role !== 'admin') {
            console.log(`[CHILD_CONTROLLER] Unauthorized access attempt: ${id} by parent ${req.user.id}`);
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const updatedChild = await Child.findByIdAndUpdate(id, updates, { new: true });
        console.log(`[CHILD_CONTROLLER] Child ${id} updated successfully`);
        res.json({ message: "Child updated successfully", child: updatedChild });
    } catch (err) {
        console.error(`[CHILD_CONTROLLER] Error updating child ${req.params.id}:`, err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * @desc Delete a child profile
 * @route DELETE /api/children/:id
 */
exports.deleteChild = async (req, res) => {
    try {
        const { id } = req.params;
        const child = await Child.findById(id);

        if (!child) return res.status(404).json({ message: "Child not found" });

        if (child.parentId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        await Child.findByIdAndDelete(id);

        // Remove reference from the parent's user document
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { children: id }
        });

        res.json({ message: "Child deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * @desc Upload or update a child's profile photo
 * @route POST /api/children/:id/photo
 */
exports.uploadChildPhoto = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const child = await Child.findById(id);
        if (!child) {
            return res.status(404).json({ message: "Child not found" });
        }

        if (child.parentId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const photoUrl = `/uploads/${req.file.filename}`;
        child.photoUrl = photoUrl;
        await child.save();

        res.json({
            success: true,
            message: "Photo uploaded successfully",
            photoUrl: photoUrl
        });
    } catch (err) {
        console.error("Error uploading photo:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
