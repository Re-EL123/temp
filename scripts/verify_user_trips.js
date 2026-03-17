/**
 * Verification Script: test_user_trips.js
 * Verifies the new /api/trips/user-trips endpoint.
 */
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const API_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_here';

// We'll use the existing parent flow test login logic to get a token
async function verifyEndpoint() {
    try {
        console.log("🚀 Testing /api/trips/user-trips endpoint...");

        // 1. Login as parent (using credentials from test_parent_flow.js)
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: "joyner@gmail.com",
            password: "password123"
        });

        const token = loginRes.data.token;
        console.log("✅ Authenticated as parent.");

        // 2. Call user-trips
        const tripsRes = await axios.get(`${API_URL}/api/trips/user-trips`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (tripsRes.data.success) {
            console.log(`✅ Success: Found ${tripsRes.data.count} trips.`);
            console.log("Sample Trip ID:", tripsRes.data.trips[0]?._id || "No trips found");
        } else {
            console.error("❌ Failed: ", tripsRes.data);
        }

    } catch (error) {
        console.error("❌ Error during verification:", error.response?.data || error.message);
    }
}

verifyEndpoint();
