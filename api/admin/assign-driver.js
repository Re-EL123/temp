// api/admin/assign-driver.js
const mongoose = require('mongoose');
const RideRequest = require('../../src/models/RideRequest');
const RideInstance = require('../../src/models/RideInstance');
const Driver = require('../../src/models/Driver');
const connectDB = require('../../src/config/db');

// Helper function to generate ride instances for next X days
const generateRideInstances = async (rideRequest, daysAhead = 14) => {
  const instances = [];
  const startDate = new Date(rideRequest.schedule.startDate);
  const endDate = new Date(rideRequest.schedule.endDate);
  const currentDate = new Date();
  
  // Start from today or scheduled start date, whichever is later
  const fromDate = currentDate > startDate ? currentDate : startDate;
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + daysAhead);
  
  // Don't go beyond end date
  const finalDate = toDate > endDate ? endDate : toDate;

  let checkDate = new Date(fromDate);
  checkDate.setHours(0, 0, 0, 0);

  while (checkDate <= finalDate) {
    let shouldCreateInstance = false;

    if (rideRequest.type === 'WEEKLY') {
      const dayOfWeek = checkDate.getDay();
      if (rideRequest.schedule.daysOfWeek.includes(dayOfWeek)) {
        shouldCreateInstance = true;
      }
    } else if (rideRequest.type === 'MONTHLY') {
      const dayOfMonth = checkDate.getDate();
      if (rideRequest.schedule.daysOfMonth.includes(dayOfMonth)) {
        shouldCreateInstance = true;
      }
    }

    if (shouldCreateInstance) {
      // Check if instance already exists for this date
      const existingInstance = await RideInstance.findOne({
        rideRequestId: rideRequest._id,
        date: checkDate,
      });

      if (!existingInstance) {
        const instance = new RideInstance({
          rideRequestId: rideRequest._id,
          date: new Date(checkDate),
          pickupTime: rideRequest.pickupTime,
          driverId: rideRequest.assignedDriverId,
          childId: rideRequest.childId,
          parentId: rideRequest.parentId,
          status: 'SCHEDULED',
          pickupLocation: rideRequest.pickupLocation,
          dropoffLocation: rideRequest.dropoffLocation,
          activity: rideRequest.activity,
          instructions: rideRequest.instructions,
        });
        instances.push(instance);
      }
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }

  // Bulk insert all instances
  if (instances.length > 0) {
    await RideInstance.insertMany(instances);
  }

  return instances.length;
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { rideRequestId, driverId } = req.body;

    // Validation
    if (!rideRequestId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'Missing rideRequestId or driverId',
      });
    }

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideRequestId);
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found',
      });
    }

    // Check if already assigned
    if (rideRequest.status === 'ACTIVE' && rideRequest.assignedDriverId) {
      return res.status(400).json({
        success: false,
        message: 'This ride request is already assigned to a driver',
      });
    }

    // Verify driver exists and is verified
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    if (!driver.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not verified',
      });
    }

    // Update ride request
    rideRequest.assignedDriverId = driverId;
    rideRequest.status = 'ACTIVE';
    await rideRequest.save();

    // Generate ride instances
    const instancesCreated = await generateRideInstances(rideRequest);

    // Notify driver via socket
    if (global.io) {
      global.io.to(`driver_${driverId}`).emit('recurring-trip-assigned', {
        rideRequestId: rideRequest._id,
        type: rideRequest.type,
        childName: rideRequest.childName,
        schoolName: rideRequest.schoolName,
        pickupLocation: rideRequest.pickupLocation.address,
        dropoffLocation: rideRequest.dropoffLocation.address,
        pickupTime: rideRequest.pickupTime,
        schedule: rideRequest.schedule,
        instancesCreated,
      });
    }

    // Notify parent
    if (global.io) {
      global.io.to(`parent_${rideRequest.parentId}`).emit('driver-assigned', {
        rideRequestId: rideRequest._id,
        driverId,
        driverName: driver.name,
        driverPhone: driver.phoneNumber,
        vehicleInfo: driver.vehicleInfo,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: {
        rideRequestId: rideRequest._id,
        driverId,
        instancesCreated,
        status: 'ACTIVE',
      },
    });

  } catch (error) {
    console.error('Driver assignment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign driver',
      error: error.message,
    });
  }
};
