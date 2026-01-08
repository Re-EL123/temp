const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');
const Child = require('../../src/models/child');
const connectDB = require('../../src/config/db');
const bcrypt = require('bcryptjs');

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
    // Verify token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await connectDB();

    // GET - Fetch all children for parent
    if (req.method === 'GET') {
      const user = await User.findById(decoded.id).populate('children');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.json({ 
        success: true,
        children: user.children || [] 
      });
    }

    // POST - Add a new child
    if (req.method === 'POST') {
      const { name, gender, age, grade, schoolName } = req.body;
      
      if (!name || !gender) {
        return res.status(400).json({ message: 'Name and gender are required' });
      }

      // Create new child
      const newChild = new Child({
        name,
        gender: gender.toLowerCase(),
        age,
        grade,
        schoolName,
        parent: decoded.id
      });

      await newChild.save();

      // Add child to parent's children array
      await User.findByIdAndUpdate(decoded.id, {
        $push: { children: newChild._id }
      });

      return res.status(201).json({
        success: true,
        message: 'Child added successfully',
        child: newChild
      });
    }

    // PUT - Update a child
    if (req.method === 'PUT') {
      const { childId } = req.query;
      const { name, gender, age, grade, schoolName } = req.body;

      const child = await Child.findByIdAndUpdate(
        childId,
        { name, gender: gender?.toLowerCase(), age, grade, schoolName },
        { new: true, runValidators: true }
      );

      if (!child) {
        return res.status(404).json({ message: 'Child not found' });
      }

      return res.json({
        success: true,
        message: 'Child updated successfully',
        child
      });
    }

    // DELETE - Delete a child
    if (req.method === 'DELETE') {
      const { childId } = req.query;

      await Child.findByIdAndDelete(childId);
      await User.findByIdAndUpdate(decoded.id, {
        $pull: { children: childId }
      });

      return res.json({
        success: true,
        message: 'Child deleted successfully'
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('[CHILDREN] Error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
