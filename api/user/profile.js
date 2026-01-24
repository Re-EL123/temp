const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');
const Trip = require('../../src/models/trip');
const connectDB = require('../../src/config/db');

// CORS headers helper - allows ALL origins
const setCorsHeaders = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  return res;
};

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    console.log('[PROFILE] Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  try {
    await connectDB();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // ✅ Handle GET - fetch profile
    if (req.method === 'GET') {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      let totalEarningsToday = 0;
      try {
        const todayTrips = await Trip.find({
          driver: user._id,
          status: 'completed',
          completedAt: { $gte: startOfDay, $lte: endOfDay },
        });
        totalEarningsToday = todayTrips.reduce(
          (sum, trip) => sum + (trip.paymentAmount || 0),
          0
        );
      } catch (tripError) {
        console.error('[PROFILE] Error calculating earnings:', tripError);
      }

      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          surname: user.surname,
          email: user.email,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
          registrationNumber: user.registrationNumber, // ✅ Added
          carBrand: user.carBrand, // ✅ Added
          carModel: user.carModel, // ✅ Added
          isActive: user.isActive || false,
          totalEarnings: totalEarningsToday,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    }

    // ✅ Handle PUT - toggle isActive status
    if (req.method === 'PUT') {
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }

      const updatedUser = await User.findByIdAndUpdate(
        decoded.id,
        { isActive, updatedAt: new Date() },
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      console.log(`[PROFILE] User ${decoded.id} isActive updated to:`, isActive);

      return res.json({
        success: true,
        message: 'Active status updated',
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          surname: updatedUser.surname,
          email: updatedUser.email,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          registrationNumber: updatedUser.registrationNumber,
          carBrand: updatedUser.carBrand,
          carModel: updatedUser.carModel,
        },
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('[PROFILE] Error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
