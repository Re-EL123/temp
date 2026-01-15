const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      enum: ["user", "parent", "driver", "admin"], 
      default: "user" 
    },
    phone: { type: String },
    address: { type: String },
    location: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Child'
      }
    ]
        ],

    // Driver onboarding fields
    onboardingCompleted: {
      type: Boolean,
      default: false
    },
    registrationNumber: { type: String },
    passengerSeats: { type: Number },
    carBrand: { type: String },
    carModel: { type: String },
    cellNumber: { type: String },
    driverPicture: { type: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
