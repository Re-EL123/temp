const mongoose = require("mongoose");

const childSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  fullName: { type: String, required: true },
  schoolName: { type: String, required: true },
  homeAddress: { type: String, required: true },
  grade: String
}, { timestamps: true });

module.exports = mongoose.model("Child", childSchema);
