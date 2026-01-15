const mongoose = require('mongoose');

const childSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    surname: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true
    },
    schoolName: {
      type: String,
      required: true
    },
    grade: String,
    homeAddress: {
      type: String,
      required: true
    },
    schoolAddress: String,
    parentName: String,
    relationship: String,
    parentContact: {
      type: String,
      required: true
    },
    photoUrl: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Child', childSchema);
