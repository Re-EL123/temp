const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    if (!MONGO_URI) {
      throw new Error("MongoDB connection string (MONGO_URI) is missing in .env");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`Database name: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message || error);
    process.exit(1); // Stop the server if DB connection fails
  }

  // Optional: runtime event listeners
  mongoose.connection.on("error", (err) => {
    console.error("⚠️ MongoDB runtime error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected!");
  });
}

module.exports = connectDB;
