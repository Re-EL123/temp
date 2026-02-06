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

// ============================
// USER PROFILE ROUTES
// ============================

// GET user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
        phone: user.phone,
        address: user.address,
        location: user.location,
        latitude: user.latitude,
        longitude: user.longitude,
        registrationNumber: user.registrationNumber,
        passengerSeats: user.passengerSeats,
        carBrand: user.carBrand,
        carModel: user.carModel,
        driverPicture: user.driverPicture,
        isActive: user.isActive,
        seats: user.seats,
        currentLocation: user.currentLocation,
      }
    });
  } catch (error) {
    console.error('[GET Profile] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { isActive, phone, address, location, latitude, longitude } = req.body;
    
    const updateData = {};
    
    // Only update fields that are provided
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (location !== undefined) updateData.location = location;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`[PUT Profile] User ${req.user.id} updated:`, updateData);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted,
        phone: updatedUser.phone,
        address: updatedUser.address,
        location: updatedUser.location,
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        isActive: updatedUser.isActive,
        registrationNumber: updatedUser.registrationNumber,
        passengerSeats: updatedUser.passengerSeats,
        carBrand: updatedUser.carBrand,
        carModel: updatedUser.carModel,
        driverPicture: updatedUser.driverPicture,
        seats: updatedUser.seats,
        currentLocation: updatedUser.currentLocation,
      }
    });
  } catch (error) {
    console.error('[PUT Profile] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================
// DRIVER ONBOARDING ROUTES
// ============================

// POST driver onboarding
router.post('/driver-onboarding', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can complete onboarding' });
    }

    const {
      registrationNumber,
      passengerSeats,
      carBrand,
      carModel,
      phone,
      address,
    } = req.body;

    // Validation
    if (!registrationNumber || !passengerSeats || !carBrand || !carModel) {
      return res.status(400).json({
        message: 'Missing required fields: registrationNumber, passengerSeats, carBrand, carModel',
      });
    }

    const parsedSeats = parseInt(passengerSeats, 10);
    if (isNaN(parsedSeats) || parsedSeats < 1) {
      return res.status(400).json({ message: 'Invalid passenger seats value' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        registrationNumber: registrationNumber.trim(),
        passengerSeats: parsedSeats,
        carBrand: carBrand.trim(),
        carModel: carModel.trim(),
        phone: phone ? phone.trim() : '',
        address: address ? address.trim() : '',
        onboardingCompleted: true,
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`[POST Driver Onboarding] User ${req.user.id} completed onboarding`);

    return res.json({
      success: true,
      message: 'Driver onboarding completed successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted,
        phone: updatedUser.phone,
        address: updatedUser.address,
        registrationNumber: updatedUser.registrationNumber,
        passengerSeats: updatedUser.passengerSeats,
        carBrand: updatedUser.carBrand,
        carModel: updatedUser.carModel,
      },
    });
  } catch (error) {
    console.error('[POST Driver Onboarding] Error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================
// CHILDREN MANAGEMENT ROUTES
// ============================

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

    console.log(`[POST Children] Child ${newChild._id} added for user ${req.user.id}`);

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
    if (age) {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge < 0) {
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

    const child = await Child.findOneAndUpdate(
      { _id: childId, parentId: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    console.log(`[PUT Children] Child ${childId} updated for user ${req.user.id}`);

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

    console.log(`[DELETE Children] Child ${childId} deleted for user ${req.user.id}`);

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
