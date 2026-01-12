// api/admin/pending-requests.js
const mongoose = require('mongoose');
const RideRequest = require('../../src/models/RideRequest');
const connectDB = require('../../src/config/db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { type, status } = req.query;

    // Build query
    const query = {};
    
    if (type) {
      query.type = type.toUpperCase();
    } else {
      // Default: only show recurring trips that need assignment
      query.type = { $in: ['WEEKLY', 'MONTHLY'] };
    }

    if (status) {
      query.status = status.toUpperCase();
    } else {
      query.status = 'PENDING';
    }

    const pendingRequests = await RideRequest.find(query)
      .populate('childId', 'name age')
      .populate('parentId', 'name phoneNumber email')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: pendingRequests.length,
      data: pendingRequests,
    });

  } catch (error) {
    console.error('Fetch pending requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests',
      error: error.message,
    });
  }
};
