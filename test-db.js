require('dotenv').config();
const mongoose = require('mongoose');

async function testQuery() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://dumo:dumo@safeschoolride.f375f.mongodb.net/test");
    console.log("Connected to DB.");

    const child = await mongoose.connection.db.collection('children').findOne({ _id: new mongoose.Types.ObjectId("699efb1c5e32b3e98eb5726f") });
    console.log("Child Example 1:", child ? "Found" : "Not Found", child);

    const childString = await mongoose.connection.db.collection('children').findOne({ _id: "699efb1c5e32b3e98eb5726f" });
    console.log("Child Example 2 (String):", childString ? "Found" : "Not Found");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

testQuery();
