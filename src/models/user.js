const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, // NO trim on password
    role: { 
      type: String, 
      enum: ["user", "parent", "driver", "admin"], 
      default: "user" 
    },
    onboardingCompleted: { type: Boolean, default: false },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    location: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    
    // Driver-specific fields - only required after onboarding is completed
    registrationNumber: { 
      type: String, 
      trim: true,
      required: function() { 
        return this.role === 'driver' && this.onboardingCompleted === true; 
      }
    },
    passengerSeats: { 
      type: Number,
      required: function() { 
        return this.role === 'driver' && this.onboardingCompleted === true; 
      }
    },
    carBrand: { 
      type: String, 
      trim: true,
      required: function() { 
        return this.role === 'driver' && this.onboardingCompleted === true; 
      }
    },
    carModel: { 
      type: String, 
      trim: true,
      required: function() { 
        return this.role === 'driver' && this.onboardingCompleted === true; 
      }
    },
    driverPicture: { type: String, trim: true },
    
    // Driver online/offline status
    isActive: { type: Boolean, default: false },
    
    // Additional vehicle details for Socket.IO integration
    seats: { 
      type: Number, 
      default: function() { return this.passengerSeats || 4; }
    },
    
    // Enhanced location tracking for real-time driver positioning
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, trim: true },
      town: { type: String, trim: true }
    },
    
    // Parent-specific: reference to children
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Child'
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
