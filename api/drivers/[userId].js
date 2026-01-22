// Driver endpoint for getting driver data and updating active status
const Driver = require('../../src/models/Driver');
const connectDB = require('../../src/config/db');
const verifyToken = require('../../src/middleware/auth');

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    await connectDB();
    const { userId } = req.query;
    
    // Validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No authorization header' });
    }

    // GET endpoint: Retrieve driver data
    if (req.method === 'GET') {
      const driver = await Driver.findById(userId)
        .populate('userId', 'name surname email')
        .select('+totalEarnings +isActive');
      
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          _id: driver._id,
          userId: driver.userId,
          totalEarnings: driver.totalEarnings || 0,
          isActive: driver.isActive || false,
          status: driver.status,
          rating: driver.rating || 0,
          tripsCompleted: driver.tripsCompleted || 0,
          licenseNumber: driver.licenseNumber,
          vehicleInfo: driver.vehicleInfo,
        },
      });
    }
    
    // PUT endpoint: Update driver active status
    if (req.method === 'PUT') {
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Invalid isActive value' });
      }
      
      const updatedDriver = await Driver.findByIdAndUpdate(
        userId,
        { isActive },
        { new: true }
      ).populate('userId', 'name surname email');
      
      if (!updatedDriver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          _id: updatedDriver._id,
          userId: updatedDriver.userId,
          totalEarnings: updatedDriver.totalEarnings || 0,
          isActive: updatedDriver.isActive,
          status: updatedDriver.status,
        },
      });
    }
    
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Driver endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
