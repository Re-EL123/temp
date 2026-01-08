const mongoose = require("mongoose");
// Note: dotenv not needed in Vercel serverless environment - env vars are injected

// Support both MONGO_URI and MONGODB_URI
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

let cachedConnection = null;

async function connectDB() {
  // Return cached connection if available
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log("✅ Using cached MongoDB connection");
    return cachedConnection;
  }

  try {
    if (!MONGO_URI) {
      throw new Error("MongoDB connection string (MONGODB_URI or MONGO_URI) is missing in environment variables");
    }

    const connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`Database name: ${mongoose.connection.name}`);
    
    cachedConnection = connection;
    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message || error);
    throw error; // Throw error instead of exiting in serverless
  }
}

module.exports = connectDB;
