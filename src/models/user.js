//src/models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    
    email: { type: String, required: true, unique: true , trim: true},
    password: { type: String, required: true , trim: true},
    role: { 
      type: String, 
      enum: ["user", "parent", "driver", "admin"], 
      default: "user" 
    },
    onboardingCompleted: { type: Boolean, default: false },
    phone: { type: String , trim: true},
    address: { type: String , trim: true},
    location: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    registrationNumber: { 
                        type: String, trim: true,
                        required: function() { return this.role === 'driver'; }
                },
    passengerSeats: { 
                        type: Number, trim: true,
                        required: function() { return this.role === 'driver'; }
                },
    carBrand:  { 
                        type: String, trim: true,
                        required: function() { return this.role === 'driver'; }
                },
    carModel:  { 
                        type: String, trim: true,
                        required: function() { return this.role === 'driver'; }
                },
    
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
