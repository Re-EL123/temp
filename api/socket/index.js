const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/user');

let io;

// Store active driver locations
const activeDrivers = new Map();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.user.name} (${socket.user.role})`);

    // Driver joins their location room
    if (socket.user.role === 'driver') {
      socket.join(`driver-${socket.user._id}`);
      
      // Update driver location
      socket.on('updateLocation', (data) => {
        const { latitude, longitude, address } = data;
        
        if (socket.user.isActive) {
          activeDrivers.set(socket.user._id.toString(), {
            driverId: socket.user._id,
            name: socket.user.name,
            surname: socket.user.surname,
            latitude,
            longitude,
            address,
            registrationNumber: socket.user.registrationNumber,
            carBrand: socket.user.carBrand,
            carModel: socket.user.carModel,
            seats: socket.user.seats || 4,
            lastUpdated: new Date()
          });

          console.log(`[SOCKET] Driver ${socket.user.name} location updated:`, { latitude, longitude });
        }
      });

      // Driver goes offline
      socket.on('goOffline', () => {
        activeDrivers.delete(socket.user._id.toString());
        socket.user.isActive = false;
        console.log(`[SOCKET] Driver ${socket.user.name} went offline`);
      });
    }

    // Parent requests nearby drivers
    if (socket.user.role === 'parent') {
      socket.on('findDrivers', async (data) => {
        const { town, latitude, longitude, radius = 15000 } = data;
        
        console.log(`[SOCKET] Parent ${socket.user.name} searching for drivers in ${town}`);
        
        const nearbyDrivers = Array.from(activeDrivers.values()).filter(driver => {
          // Calculate distance using Haversine formula
          const distance = calculateDistance(
            latitude,
            longitude,
            driver.latitude,
            driver.longitude
          );
          
          return distance <= radius; // Within radius (default 15km)
        });

        socket.emit('driversFound', nearbyDrivers);
        console.log(`[SOCKET] Found ${nearbyDrivers.length} drivers for ${socket.user.name}`);
      });

      // Parent requests specific driver
      socket.on('requestDriver', (data) => {
        const { driverId, pickupLocation, dropoffLocation, tripDetails } = data;
        
        io.to(`driver-${driverId}`).emit('tripRequest', {
          parentId: socket.user._id,
          parentName: `${socket.user.name} ${socket.user.surname}`,
          pickupLocation,
          dropoffLocation,
          tripDetails,
          requestedAt: new Date()
        });

        console.log(`[SOCKET] Trip request sent to driver ${driverId}`);
      });
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      if (socket.user.role === 'driver') {
        activeDrivers.delete(socket.user._id.toString());
      }
      console.log(`[SOCKET] User disconnected: ${socket.user.name}`);
    });

    // Trip started - join trip room
    socket.on('startTrip', (tripId) => {
      socket.join(`trip-${tripId}`);
      console.log(`[SOCKET] Trip ${tripId} started`);
    });

    // Real-time trip location updates
    socket.on('tripLocationUpdate', (data) => {
      const { tripId, latitude, longitude } = data;
      io.to(`trip-${tripId}`).emit('driverLocationUpdate', {
        latitude,
        longitude,
        timestamp: new Date()
      });
    });

    // Trip completed
    socket.on('completeTrip', (tripId) => {
      io.to(`trip-${tripId}`).emit('tripCompleted', {
        tripId,
        completedAt: new Date()
      });
      console.log(`[SOCKET] Trip ${tripId} completed`);
    });
  });

  return io;
};

// Haversine formula for distance calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

module.exports = { initializeSocket, getIO: () => io };
