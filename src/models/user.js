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
    onboardingCompleted: { type: Boolean, default: false },
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
