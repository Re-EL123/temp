const jwt = require('jsonwebtoken');
const Child = require('../../../src/models/child');
const connectDB = require('../../../src/config/db');

// CORS headers helper
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Content-Length');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return res;
};

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Verify token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await connectDB();
    
    const { childId } = req.query;
    
    if (!childId) {
      return res.status(400).json({ message: 'Child ID is required' });
    }
    
    // POST - Upload photo
    if (req.method === 'POST') {
      // Check if child exists
      const child = await Child.findById(childId);
      if (!child) {
        return res.status(404).json({ message: 'Child not found' });
      }
      
      // For now, we store the photo URL as a base64 string or file path
      // In production, you would upload to CloudStorage or AWS S3
      // Frontend will send photo as FormData with 'photo' field
      
      // Validate that photo data exists
      if (!req.body.photo && !req.files?.photo) {
        return res.status(400).json({ message: 'Photo data is required' });
      }
      
      // Store photo data (this is a placeholder implementation)
      // In production, upload to cloud storage and store the URL
      const photoData = req.body.photo || null;
      
      // Update child with photo URL
      const updatedChild = await Child.findByIdAndUpdate(
        childId,
        { photoUrl: photoData || `https://placeholder.com/photo-${childId}` },
        { new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Photo uploaded successfully',
        child: updatedChild
      });
    }
    
    // GET - Retrieve photo
    if (req.method === 'GET') {
      const child = await Child.findById(childId).select('photoUrl');
      if (!child) {
        return res.status(404).json({ message: 'Child not found' });
      }
      return res.json({
        success: true,
        photoUrl: child.photoUrl || null
      });
    }
    
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('[CHILD_PHOTO] Error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
