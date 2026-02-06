// api/users/drivers/available.js - Get Available Drivers Near Location
const connectDB = require('../../../src/config/db');
const User = require('../../../src/models/user');
const Driver = require('../../../src/models/driver');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Connect to database
    await connectDB();

    // Get location parameters from query
    const { lat, lng, radius = 50 } = req.query; // Default radius: 50km

    // Validate required parameters
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude (lat) and longitude (lng) are required',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided',
      });
    }

    console.log(`[Available Drivers] Searching near lat: ${latitude}, lng: ${longitude}, radius: ${searchRadius}km`);

    // Find all active drivers (users with role 'driver' and isActive = true)
    const activeDrivers = await User.find({
      role: 'driver',
      isActive: true,
      onboardingCompleted: true,
      'currentLocation.latitude': { $exists: true, $ne: null },
      'currentLocation.longitude': { $exists: true, $ne: null },
    }).select('name surname email currentLocation carBrand carModel registrationNumber passengerSeats');

    console.log(`[Available Drivers] Found ${activeDrivers.length} active drivers`);

    // Calculate distances and filter by radius
    const driversWithDistance = activeDrivers
      .map(driver => {
        const distance = calculateDistance(
          latitude,
          longitude,
          driver.currentLocation.latitude,
          driver.currentLocation.longitude
        );

        return {
          _id: driver._id.toString(),
          name: `${driver.name} ${driver.surname}`,
          email: driver.email,
          vehicle: `${driver.carBrand} ${driver.carModel} - ${driver.registrationNumber}`,
          carBrand: driver.carBrand,
          carModel: driver.carModel,
          registrationNumber: driver.registrationNumber,
          seats: driver.passengerSeats || 4,
          rating: 4.5, // Default rating (you can enhance this with actual ratings from trips)
          distance: parseFloat(distance.toFixed(2)),
          latitude: driver.currentLocation.latitude,
          longitude: driver.currentLocation.longitude,
          address: driver.currentLocation.address || '',
          available: true,
        };
      })
      .filter(driver => driver.distance <= searchRadius) // Filter by radius
      .sort((a, b) => a.distance - b.distance); // Sort by distance (nearest first)

    console.log(`[Available Drivers] ${driversWithDistance.length} drivers within ${searchRadius}km radius`);

    return res.status(200).json({
      success: true,
      count: driversWithDistance.length,
      drivers: driversWithDistance,
      searchLocation: {
        latitude,
        longitude,
        radius: searchRadius,
      },
    });

  } catch (error) {
    console.error('[Available Drivers] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
