const mongoose = require('mongoose');

const childSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gender: { 
      type: String, 
      enum: ['male', 'female'], 
      required: true 
    },
    age: { type: Number },
    grade: { type: String },
    schoolName: { type: String },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Child', childSchema);
