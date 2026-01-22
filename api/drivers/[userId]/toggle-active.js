// Toggle driver active status endpoint
const Driver = require('../../../src/models/Driver');
const connectDB = require('../../../src/config/db');

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
    
    // Only allow PUT for toggling active status
    if (req.method !== 'PUT') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid isActive value' });
    }
    
    // Update driver active status
    const updatedDriver = await Driver.findByIdAndUpdate(
      userId,
      { isActive, status: isActive ? 'available' : 'offline', updatedAt: new Date() },
      { new: true }
    ).populate('userId', 'name surname email');
    
    if (!updatedDriver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    
    return res.status(200).json({
      success: true,
      message: `Driver status updated to ${isActive ? 'active' : 'inactive'}`,
      data: {
        _id: updatedDriver._id,
        userId: updatedDriver.userId,
        isActive: updatedDriver.isActive,
        status: updatedDriver.status,
        totalEarnings: updatedDriver.totalEarnings || 0,
        updatedAt: updatedDriver.updatedAt,
      },
    });
  } catch (error) {
    console.error('Toggle active status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
