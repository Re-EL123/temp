// api/trips/recurring.js
const mongoose = require('mongoose');
const Trip = require('../../src/models/Trip.model');
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
        endDate: tripType === 'weekly' 
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

  } catch (error) {
    console.error('Recurring trip creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create recurring trip request',
      error: error.message,
    });
  }
};
