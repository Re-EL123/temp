const mongoose = require('mongoose');
const Trip = require('../../src/models/trip.model');
const Driver = require('../../src/models/Driver');
const connectDB = require('../../src/config/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await connectDB();
    const { childId, parentId, date, pickupTime, pickupLocation, dropoffLocation, activity, instructions, townshipId } = req.body;

    if (!childId || !parentId || !pickupLocation || !dropoffLocation || !date || !pickupTime) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const pickupCoords = pickupLocation.coordinates || { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude };
    const query = { status: { $in: ['available', 'offline'] }, isVerified: true, isActive: true, location: { $near: { $geometry: { type: 'Point', coordinates: [pickupCoords.longitude, pickupCoords.latitude] }, $maxDistance: 10000 } } };
    
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
      pickupLocation: { type: 'Point', coordinates: [pickupCoords.longitude, pickupCoords.latitude], address: pickupLocation.address || '' },
      dropoffLocation: { type: 'Point', coordinates: [dropoffLocation.longitude, dropoffLocation.latitude], address: dropoffLocation.address || '' },
      scheduledDate: new Date(date),
      pickupTime,
      activity,
      instructions,
      notifiedDrivers: nearbyDrivers.map(d => d._id),
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
      data: { tripId: newTrip._id, notifiedDrivers: nearbyDrivers.length, drivers: nearbyDrivers },
    });
  } catch (error) {
    console.error('Once-off trip error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create trip', error: error.message });
  }
};
