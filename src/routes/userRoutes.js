const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Child = require('../models/child');

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// GET all children for parent
router.get('/children', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('children');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      success: true,
      children: user.children || [],
    });
  } catch (error) {
    console.error('[GET Children] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST - Add new child
router.post('/children', authMiddleware, async (req, res) => {
  try {
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
    } = req.body;

    // Validation
    if (!name || !surname || !gender || !age || !schoolName || !homeAddress || !parentContact) {
      return res.status(400).json({
        message: 'Missing required fields: name, surname, gender, age, schoolName, homeAddress, parentContact',
      });
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0) {
      return res.status(400).json({ message: 'Invalid age value' });
    }

    const newChild = new Child({
      parentId: req.user.id,
      name,
      surname,
      age: parsedAge,
      gender: gender.toLowerCase(),
      schoolName,
      homeAddress,
      schoolAddress: schoolAddress || 'N/A',
      parentName: parentName || 'N/A',
      relationship: relationship || 'N/A',
      parentContact,
    });

    await newChild.save();

    // Add to parent's children array
    await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { children: newChild._id } },
      { new: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Child added successfully',
      child: newChild,
    });
  } catch (error) {
    console.error('[POST Children] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT - Update child
router.put('/children/:childId', authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const updateData = {};

    const { name, surname, age, gender, schoolName, homeAddress, schoolAddress, parentName, relationship, parentContact } = req.body;

    if (name) updateData.name = name;
    if (surname) updateData.surname = surname;
    if (age) updateData.age = parseInt(age, 10);
    if (gender) updateData.gender = gender.toLowerCase();
    if (schoolName) updateData.schoolName = schoolName;
    if (homeAddress) updateData.homeAddress = homeAddress;
    if (schoolAddress) updateData.schoolAddress = schoolAddress;
    if (parentName) updateData.parentName = parentName;
    if (relationship) updateData.relationship = relationship;
    if (parentContact) updateData.parentContact = parentContact;

    const child = await Child.findOneAndUpdate(
      { _id: childId, parentId: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    return res.json({
      success: true,
      message: 'Child updated successfully',
      child,
    });
  } catch (error) {
    console.error('[PUT Children] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE child
router.delete('/children/:childId', authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    const deletedChild = await Child.findOneAndDelete({
      _id: childId,
      parentId: req.user.id,
    });

    if (!deletedChild) {
      return res.status(404).json({ message: 'Child not found' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { children: childId },
    });

    return res.json({
      success: true,
      message: 'Child deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE Children] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
