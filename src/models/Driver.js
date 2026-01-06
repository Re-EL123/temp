const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  vehicleSeats: { type: Number, required: true },
  assignedStudents: { type: Number, default: 0 }
});

module.exports = mongoose.model("Driver", driverSchema);
