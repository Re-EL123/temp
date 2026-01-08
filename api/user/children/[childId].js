const jwt = require('jsonwebtoken');
const Child = require('../../../src/models/child');
const connectDB = require('../../../src/config/db');

// CORS headers helper
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return res;
};

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    await connectDB();

    const { childId } = req.query;

    if (req.method === 'GET') {
      const child = await Child.findById(childId);
      if (!child) {
        return res.status(404).json({ message: 'Child not found' });
      }
      return res.json({ success: true, child });
    }

    if (req.method === 'PUT') {
      const { name, gender, age, grade, schoolName, homeAddress, schoolAddress, parentName, relationship, parentContact } = req.body;
      const updatedChild = await Child.findByIdAndUpdate(childId, { name, gender, age, grade, schoolName, homeAddress, schoolAddress, parentName, relationship, parentContact }, { new: true });
      if (!updatedChild) {
        return res.status(404).json({ message: 'Child not found' });
      }
      return res.json({ success: true, message: 'Child updated', child: updatedChild });
    }

    if (req.method === 'DELETE') {
      const deleted = await Child.findByIdAndDelete(childId);
      if (!deleted) {
        return res.status(404).json({ message: 'Child not found' });
      }
      return res.json({ success: true, message: 'Child deleted' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('[CHILD_DETAILS] Error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
