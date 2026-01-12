// scripts/generate-instances.js
// Cron job to auto-generate RideInstances for active recurring trips
const mongoose = require('mongoose');
const RideRequest = require('../src/models/RideRequest');
const RideInstance = require('../src/models/RideInstance');
require('dotenv').config();

const DAYS_AHEAD = 14; // Generate instances for next 14 days

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected for instance generation');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const isSchoolDay = (date) => {
  const day = date.getDay();
  // Monday (1) to Friday (5) - adjust based on your requirements
  return day >= 1 && day <= 5;
};

const generateInstances = async (rideRequest, daysAhead) => {
  const instances = [];
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(rideRequest.schedule.endDate);
  const toDate = new Date(currentDate);
  toDate.setDate(toDate.getDate() + daysAhead);
  
  const finalDate = toDate > endDate ? endDate : toDate;

  let checkDate = new Date(currentDate);

  while (checkDate <= finalDate) {
    let shouldCreateInstance = false;

    // Check if it's a school day (skip weekends/holidays)
    if (!isSchoolDay(checkDate)) {
      checkDate.setDate(checkDate.getDate() + 1);
      continue;
    }

    if (rideRequest.type === 'WEEKLY') {
      const dayOfWeek = checkDate.getDay();
      if (rideRequest.schedule.daysOfWeek.includes(dayOfWeek)) {
        shouldCreateInstance = true;
      }
    } else if (rideRequest.type === 'MONTHLY') {
      const dayOfMonth = checkDate.getDate();
      if (rideRequest.schedule.daysOfMonth.includes(dayOfMonth)) {
        shouldCreateInstance = true;
      }
    }

    if (shouldCreateInstance) {
      // Check if instance already exists
      const existingInstance = await RideInstance.findOne({
        rideRequestId: rideRequest._id,
        date: checkDate,
      });

      if (!existingInstance) {
        const instance = {
          rideRequestId: rideRequest._id,
          date: new Date(checkDate),
          pickupTime: rideRequest.pickupTime,
          driverId: rideRequest.assignedDriverId,
          childId: rideRequest.childId,
          parentId: rideRequest.parentId,
          status: 'SCHEDULED',
          pickupLocation: rideRequest.pickupLocation,
          dropoffLocation: rideRequest.dropoffLocation,
          activity: rideRequest.activity,
          instructions: rideRequest.instructions,
        };
        instances.push(instance);
      }
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }

  if (instances.length > 0) {
    await RideInstance.insertMany(instances);
  }

  return instances.length;
};

const main = async () => {
  try {
    await connectDB();

    console.log('🔄 Starting RideInstance generation...');

    // Find all ACTIVE recurring ride requests
    const activeRequests = await RideRequest.find({
      type: { $in: ['WEEKLY', 'MONTHLY'] },
      status: 'ACTIVE',
      assignedDriverId: { $ne: null },
    });

    console.log(`📋 Found ${activeRequests.length} active recurring requests`);

    let totalGenerated = 0;

    for (const request of activeRequests) {
      try {
        const count = await generateInstances(request, DAYS_AHEAD);
        totalGenerated += count;
        console.log(`✅ Generated ${count} instances for request ${request._id}`);
      } catch (error) {
        console.error(`❌ Error generating instances for ${request._id}:`, error.message);
      }
    }

    console.log(`✅ Total instances generated: ${totalGenerated}`);
    console.log('✨ Instance generation complete!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
};

main();
