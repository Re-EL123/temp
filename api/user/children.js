const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');
const Child = require('../../src/models/child');
const connectDB = require('../../src/config/db');
const bcrypt = require('bcryptjs'); // currently unused but kept to preserve everything

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

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Basic auth header check
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure DB connection
    await connectDB();

    // GET - Fetch all children for parent
    if (req.method === 'GET') {
      const user = await User.findById(decoded.id).populate('children');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        children: user.children || [],
      });
    }

    // POST - Add a new child
    if (req.method === 'POST') {
      const {
        name,
        surname,
        age,
        gender,
        schoolName,
        homeAddress,
        schoolAddress,
        parentName,
        relationship,
        parentContact,
      } = req.body || {};

      // Required fields check
      if (!name || !surname || !gender || !age || !schoolName || !homeAddress || !parentContact) {
        return res.status(400).json({
          message:
            'Missing required fields: name, surname, gender, age, schoolName, homeAddress, parentContact',
        });
      }

      const parsedAge = parseInt(age, 10);
      if (Number.isNaN(parsedAge) || parsedAge < 0) {
        return res.status(400).json({ message: 'Invalid age value' });
      }

      const normalizedGender = typeof gender === 'string' ? gender.toLowerCase() : gender;

      const newChild = new Child({
        parentId: decoded.id,
        name,
        surname,
        age: parsedAge,
        gender: normalizedGender,
        schoolName,
        homeAddress,
        schoolAddress: schoolAddress || 'N/A',
        parentName: parentName || 'N/A',
        relationship: relationship || 'N/A',
        parentContact,
      });

      await newChild.save();

      // Add child to parent's children array if user exists
      await User.findByIdAndUpdate(
        decoded.id,
        { $addToSet: { children: newChild._id } }, // prevent accidental duplicates
        { new: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Child added successfully',
        child: newChild,
      });
    }

    // PUT - Update a child
    if (req.method === 'PUT') {
      const { childId } = req.query || {};

      if (!childId) {
        return res.status(400).json({ message: 'childId query parameter is required' });
      }

      const {
        name,
        surname,
        age,
        gender,
        schoolName,
        homeAddress,
        schoolAddress,
        parentName,
        relationship,
        parentContact,
      } = req.body || {};

      const updateData = {};

      if (name) updateData.name = name;
      if (surname) updateData.surname = surname;
      if (age !== undefined && age !== null && age !== '') {
        const parsedAge = parseInt(age, 10);
        if (Number.isNaN(parsedAge) || parsedAge < 0) {
          return res.status(400).json({ message: 'Invalid age value' });
        }
        updateData.age = parsedAge;
      }
      if (gender) updateData.gender = gender.toLowerCase();
      if (schoolName) updateData.schoolName = schoolName;
      if (homeAddress) updateData.homeAddress = homeAddress;
      if (schoolAddress) updateData.schoolAddress = schoolAddress;
      if (parentName) updateData.parentName = parentName;
      if (relationship) updateData.relationship = relationship;
      if (parentContact) updateData.parentContact = parentContact;

      // Ensure only this parent can update their child
      const child = await Child.findOneAndUpdate(
        { _id: childId, parentId: decoded.id },
        updateData,
        { new: true, runValidators: true }
      );

      if (!child) {
        return res.status(404).json({ message: 'Child not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Child updated successfully',
        child,
      });
    }

    // DELETE - Delete a child
    if (req.method === 'DELETE') {
      const { childId } = req.query || {};
      if (!childId) {
        return res.status(400).json({ message: 'childId query parameter is required' });
      }

      // Ensure only this parent can delete their child
      const deletedChild = await Child.findOneAndDelete({
        _id: childId,
        parentId: decoded.id,
      });

      if (!deletedChild) {
        return res.status(404).json({ message: 'Child not found' });
      }

      await User.findByIdAndUpdate(decoded.id, {
        $pull: { children: childId },
      });

      return res.status(200).json({
        success: true,
        message: 'Child deleted successfully',
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('[CHILDREN] Error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid token' });
    }

    return res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};
