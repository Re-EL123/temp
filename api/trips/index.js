// api/trips/index.js
const mongoose = require('mongoose');
const Trip = require('../../src/models/Trip.model');
const Driver = require('../../src/models/Driver');
const User = require('../../src/models/User');
const connectDB = require('../../src/config/db');

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
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { tripType } = req.body;

    // Route based on tripType
    if (tripType === 'once-off') {
      return await handleOnceOffTrip(req, res);
    } else if (tripType === 'weekly' || tripType === 'monthly') {
      return await handleRecurringTrip(req, res);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing tripType. Must be "once-off", "weekly", or "monthly"',
      });
    }
  } catch (error) {
    console.error('Trip creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create trip',
      error: error.message,
    });
  }
};

// Handler for once-off trips
async function handleOnceOffTrip(req, res) {
  const {
    childId,
    parentId,
    date,
    pickupTime,
    pickupLocation,
    dropoffLocation,
    activity,
    instructions,
    townshipId,
  } = req.body;

  if (!childId || !parentId || !pickupLocation || !dropoffLocation || !date || !pickupTime) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const pickupCoords = pickupLocation.coordinates || {
    latitude: pickupLocation.latitude,
    longitude: pickupLocation.longitude,
  };

  const query = {
    status: { $in: ['available', 'offline'] },
    isVerified: true,
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [pickupCoords.longitude, pickupCoords.latitude],
        },
        $maxDistance: 10000,
      },
    },
  };

  if (townshipId) query.townshipId = mongoose.Types.ObjectId(townshipId);

  const nearbyDrivers = await Driver.find(query).limit(10);

  if (nearbyDrivers.length === 0) {
    return res.status(404).json({ success: false, message: 'No available drivers found' });
  }

  const newTrip = new Trip({
    parent: parentId,
    child: childId,
    tripType: 'once-off',
    status: 'pending_assignment',
    pickupLocation: {
      type: 'Point',
      coordinates: [pickupCoords.longitude, pickupCoords.latitude],
      address: pickupLocation.address || '',
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: [dropoffLocation.longitude, dropoffLocation.latitude],
      address: dropoffLocation.address || '',
    },
    scheduledDate: new Date(date),
    pickupTime,
    activity,
    instructions,
    notifiedDrivers: nearbyDrivers.map((d) => d._id),
    requestedAt: new Date(),
  });

  await newTrip.save();

  if (global.io) {
    nearbyDrivers.forEach((driver) => {
      global.io.to(`driver_${driver._id}`).emit('new-trip-request', {
        tripId: newTrip._id,
        pickupTime,
        date,
      });
    });
  }

  return res.status(201).json({
    success: true,
    message: `Trip request created and sent to ${nearbyDrivers.length} drivers`,
    data: {
      tripId: newTrip._id,
      notifiedDrivers: nearbyDrivers.length,
      drivers: nearbyDrivers,
    },
  });
}

// Handler for recurring trips
async function handleRecurringTrip(req, res) {
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
    selectedDays,
  } = req.body;

  // Validation
  if (!childId || !parentId || !pickupLocation || !dropoffLocation || !date || !pickupTime) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
    });
  }

  if (!selectedDays || selectedDays.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one day for recurring trips',
    });
  }

  if (!['weekly', 'monthly'].includes(tripType)) {
    return res.status(400).json({
      success: false,
      message: 'Trip type must be either "weekly" or "monthly"',
    });
  }

  // Parse coordinates
  const pickupCoords = pickupLocation.coordinates || {
    latitude: pickupLocation.latitude,
    longitude: pickupLocation.longitude,
  };

  const dropoffCoords = dropoffLocation.coordinates || {
    latitude: dropoffLocation.latitude,
    longitude: dropoffLocation.longitude,
  };

  // Create recurring trip request (pending admin assignment)
  const newTrip = new Trip({
    parent: parentId,
    child: childId,
    tripType,
    status: 'pending_assignment',
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
    scheduledDate: new Date(date),
    pickupTime,
    activity,
    instructions,
    recurringSchedule: {
      days: selectedDays,
      startDate: new Date(date),
      endDate:
        tripType === 'weekly'
          ? new Date(new Date(date).setDate(new Date(date).getDate() + 7))
          : new Date(new Date(date).setMonth(new Date(date).getMonth() + 1)),
    },
    requestedAt: new Date(),
  });

  await newTrip.save();

  // Emit socket event to notify admin
  if (global.io) {
    global.io.to('admin').emit('new-recurring-trip-request', {
      tripId: newTrip._id,
      tripType,
      childName,
      school,
      pickupLocation: pickupLocation.address,
      dropoffLocation: dropoffLocation.address,
      pickupTime,
      selectedDays,
      startDate: date,
    });
  }

  return res.status(201).json({
    success: true,
    message: `${tripType.charAt(0).toUpperCase() + tripType.slice(1)} trip request submitted to admin for driver assignment`,
    data: {
      tripId: newTrip._id,
      tripType,
      status: 'pending_assignment',
    },
  });
}
