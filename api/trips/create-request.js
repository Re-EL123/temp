// api/trips/create-request.js
const mongoose = require('mongoose');
const RideRequest = require('../../src/models/RideRequest');
const RideInstance = require('../../src/models/RideInstance');
const Driver = require('../../src/models/Driver');
const connectDB = require('../../src/config/db');

// Helper: Convert day name to number (Mon=1, Tue=2, etc.)
const dayNameToNumber = {
  'Mon': 1,
  'Tue': 2,
  'Wed': 3,
  'Thu': 4,
  'Fri': 5,
  'Sat': 6,
  'Sun': 0,
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

    const {
      childName,
      childId,
      parentId,
      school,
      tripType,
      date,
      pickupTime,
      pickupLocation,
      dropoffLocation,
      activity,
      instructions,
      selectedDays, // For weekly/monthly
    } = req.body;

    // Validation
    if (!childId || !parentId || !pickupLocation || !dropoffLocation || !date || !pickupTime || !tripType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Parse coordinates
    const pickupCoords = {
      longitude: pickupLocation.longitude || pickupLocation.coordinates?.[0],
      latitude: pickupLocation.latitude || pickupLocation.coordinates?.[1],
    };

    const dropoffCoords = {
      longitude: dropoffLocation.longitude || dropoffLocation.coordinates?.[0],
      latitude: dropoffLocation.latitude || dropoffLocation.coordinates?.[1],
    };

    // Convert tripType to uppercase format
    const rideType = tripType.toUpperCase().replace('-', '_'); // once-off -> ONCE_OFF

    // Build schedule object based on trip type
    const schedule = {};
    const startDate = new Date(date);

    if (rideType === 'ONCE_OFF') {
      schedule.dates = [startDate];
      schedule.startDate = startDate;
      schedule.endDate = startDate;
    } else if (rideType === 'WEEKLY') {
      if (!selectedDays || selectedDays.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one day for weekly trips',
        });
      }
      // Convert day names to numbers
      schedule.daysOfWeek = selectedDays.map(day => dayNameToNumber[day]);
      schedule.startDate = startDate;
      // Default: 3 months for weekly (can be modified later by admin)
      schedule.endDate = new Date(startDate.setMonth(startDate.getMonth() + 3));
    } else if (rideType === 'MONTHLY') {
      if (!selectedDays || selectedDays.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one day for monthly trips',
        });
      }
      // For monthly, convert day names to day of month (or use as-is if numbers)
      schedule.daysOfMonth = selectedDays.map(day => 
        typeof day === 'number' ? day : parseInt(day) || dayNameToNumber[day]
      );
      schedule.startDate = startDate;
      // Default: 6 months for monthly
      schedule.endDate = new Date(startDate.setMonth(startDate.getMonth() + 6));
    }

    // Create RideRequest
    const rideRequest = new RideRequest({
      parentId,
      childId,
      pickupLocation: {
        type: 'Point',
        coordinates: [pickupCoords.longitude, pickupCoords.latitude],
        address: pickupLocation.address || '',
      },
      dropoffLocation: {
        type: 'Point',
        coordinates: [dropoffCoords.longitude, dropoffCoords.latitude],
        address: dropoffLocation.address || '',
      },
      pickupTime,
      type: rideType,
      schedule,
      status: rideType === 'ONCE_OFF' ? 'PENDING' : 'PENDING', // PENDING awaiting admin assignment for recurring
      activity,
      instructions,
      childName,
      schoolName: school,
    });

    await rideRequest.save();

    // Handle based on trip type
    if (rideType === 'ONCE_OFF') {
      // Find nearby drivers and create RideInstance immediately
      const nearbyDrivers = await Driver.find({
        status: 'available',
        isVerified: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [pickupCoords.longitude, pickupCoords.latitude],
            },
            $maxDistance: 10000, // 10km
          },
        },
      }).limit(10);

      if (nearbyDrivers.length === 0) {
        // No drivers available, but still save the request
        return res.status(201).json({
          success: true,
          message: 'Trip request created but no drivers available nearby. We will notify you when a driver becomes available.',
          data: {
            rideRequestId: rideRequest._id,
            type: 'ONCE_OFF',
            status: 'PENDING',
          },
        });
      }

      // Create RideInstance for this once-off trip
      const rideInstance = new RideInstance({
        rideRequestId: rideRequest._id,
        date: startDate,
        pickupTime,
        childId,
        parentId,
        status: 'SCHEDULED',
        pickupLocation: rideRequest.pickupLocation,
        dropoffLocation: rideRequest.dropoffLocation,
        activity,
        instructions,
        notifiedDrivers: nearbyDrivers.map(d => d._id),
      });

      await rideInstance.save();

      // Emit socket event to nearby drivers
      if (global.io) {
        nearbyDrivers.forEach((driver) => {
          global.io.to(`driver_${driver._id}`).emit('new-trip-request', {
            rideInstanceId: rideInstance._id,
            rideRequestId: rideRequest._id,
            childName,
            school,
            pickupLocation: pickupLocation.address,
            dropoffLocation: dropoffLocation.address,
            pickupTime,
            date: startDate,
            activity,
          });
        });
      }

      return res.status(201).json({
        success: true,
        message: `Request sent to ${nearbyDrivers.length} nearby drivers`,
        data: {
          rideRequestId: rideRequest._id,
          rideInstanceId: rideInstance._id,
          notifiedDrivers: nearbyDrivers.length,
        },
      });

    } else {
      // Weekly or Monthly - notify admin for driver assignment
      if (global.io) {
        global.io.to('admin').emit('new-recurring-trip-request', {
          rideRequestId: rideRequest._id,
          type: rideType,
          childName,
          school,
          pickupLocation: pickupLocation.address,
          dropoffLocation: dropoffLocation.address,
          pickupTime,
          selectedDays: rideType === 'WEEKLY' ? schedule.daysOfWeek : schedule.daysOfMonth,
          startDate: schedule.startDate,
        });
      }

      return res.status(201).json({
        success: true,
        message: `${tripType} trip request submitted to admin for driver assignment`,
        data: {
          rideRequestId: rideRequest._id,
          type: rideType,
          status: 'PENDING',
        },
      });
    }

  } catch (error) {
    console.error('Trip request creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create trip request',
      error: error.message,
    });
  }
};
