// api/trips/once-off.js
const mongoose = require('mongoose');
const Trip = require('../../src/models/Trip.model');
const Driver = require('../../src/models/Driver');
const User = require('../../src/models/User');

// Connect to MongoDB
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
      date,
      pickupTime,
      pickupLocation,
      dropoffLocation,
      activity,
      instructions,
      requestedDriver,
    } = req.body;

    // Validation
    if (!childId || !parentId || !pickupLocation || !dropoffLocation || !date || !pickupTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Parse pickup location coordinates
    const pickupCoords = pickupLocation.coordinates || {
      latitude: pickupLocation.latitude,
      longitude: pickupLocation.longitude,
    };

    // Find available drivers near pickup location (within 10km radius)
    const nearbyDrivers = await Driver.find({
      status: 'available',
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [pickupCoords.longitude, pickupCoords.latitude],
          },
          $maxDistance: 10000, // 10km in meters
        },
      },
    }).limit(10);

    if (nearbyDrivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available drivers found near your location',
      });
    }

    // Create the trip request
    const newTrip = new Trip({
      parent: parentId,
      child: childId,
      tripType: 'once-off',
      status: 'pending',
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
      notifiedDrivers: nearbyDrivers.map(d => d._id),
      requestedAt: new Date(),
    });

    await newTrip.save();

    // Emit socket event to notify nearby drivers
    if (global.io) {
      nearbyDrivers.forEach((driver) => {
        global.io.to(`driver_${driver._id}`).emit('new-trip-request', {
          tripId: newTrip._id,
          childName,
          school,
          pickupLocation: pickupLocation.address,
          dropoffLocation: dropoffLocation.address,
          pickupTime,
          date,
          activity,
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: `Trip request sent to ${nearbyDrivers.length} nearby drivers`,
      data: {
        tripId: newTrip._id,
        notifiedDrivers: nearbyDrivers.length,
      },
    });

  } catch (error) {
    console.error('Once-off trip creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create trip request',
      error: error.message,
    });
  }
};
