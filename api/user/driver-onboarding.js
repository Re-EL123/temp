const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');
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
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    console.log('[DRIVER-ONBOARDING] Submitting driver onboarding data...');
    
    // Connect to MongoDB
    try {
      await connectDB();
      console.log('[DRIVER-ONBOARDING] Database connected');
    } catch (dbError) {
      console.error('[DRIVER-ONBOARDING] Database connection error:', dbError);
      return res.status(500).json({ 
        message: 'Database connection failed', 
        error: dbError.message 
      });
    }
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[DRIVER-ONBOARDING] No authorization token provided');
      return res.status(401).json({ message: 'No authorization token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    if (!process.env.JWT_SECRET) {
      console.error('[DRIVER-ONBOARDING] JWT_SECRET not found');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('[DRIVER-ONBOARDING] Token verified for user:', decoded.id);
    } catch (jwtError) {
      console.log('[DRIVER-ONBOARDING] Invalid token:', jwtError.message);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Extract onboarding data from request body
    const { 
      registrationNumber, 
      passengerSeats, 
      carBrand, 
      carModel, 
      cellNumber,
      driverPicture 
    } = req.body;
    
    console.log('[DRIVER-ONBOARDING] Received data:', {
      registrationNumber,
      passengerSeats,
      carBrand,
      carModel,
      cellNumber
    });
    
    // Validate required fields
    if (!registrationNumber || !passengerSeats || !carBrand || !carModel || !cellNumber) {
      console.log('[DRIVER-ONBOARDING] Missing required fields');
      return res.status(400).json({ 
        message: 'Missing required onboarding fields',
        received: { registrationNumber, passengerSeats, carBrand, carModel, cellNumber }
      });
    }
    
    // Validate passengerSeats is a number
    const seatsNumber = parseInt(passengerSeats, 10);
    if (isNaN(seatsNumber) || seatsNumber <= 0) {
      return res.status(400).json({ 
        message: 'Passenger seats must be a positive number' 
      });
    }
    
    // Update user with onboarding data and mark as completed
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      {
        onboardingCompleted: true,
        registrationNumber,
        passengerSeats: seatsNumber,
        carBrand,
        carModel,
        phone: cellNumber,
        driverPicture: driverPicture || 'https://via.placeholder.com/150',
        updatedAt: new Date()
      },
      { 
        new: true,
        runValidators: true
      }
    ).select('-password');
    
    if (!updatedUser) {
      console.log('[DRIVER-ONBOARDING] User not found');
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('[DRIVER-ONBOARDING] Onboarding completed successfully for user:', decoded.id);
    return res.json({
      success: true,
      message: 'Driver profile completed successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted,
        registrationNumber: updatedUser.registrationNumber,
        passengerSeats: updatedUser.passengerSeats,
        carBrand: updatedUser.carBrand,
        carModel: updatedUser.carModel,
        phone: updatedUser.phone,
        driverPicture: updatedUser.driverPicture,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('[DRIVER-ONBOARDING] Error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
