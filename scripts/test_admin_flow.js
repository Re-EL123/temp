const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@safeschoolride.com';
const ADMIN_PASS = 'adminPassword123';

async function testAdminFlow() {
    try {
        console.log("🚀 Starting Admin Flow Test...");

        // 1. Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASS
        });
        const token = loginRes.data.token;
        console.log("✅ Logged in as Admin");

        // 2. Get Stats
        const statsRes = await axios.get(`${API_URL}/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("📊 Global Stats:", statsRes.data.stats);

        // 3. List Drivers
        const driversRes = await axios.get(`${API_URL}/admin/drivers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`🚛 Found ${driversRes.data.drivers.length} drivers`);

        if (driversRes.data.drivers.length > 0) {
            const driver = driversRes.data.drivers[0];
            console.log(`📍 Testing verification for driver ID: ${driver._id} (${driver.userId.name})`);

            // 4. Verify Driver
            const verifyRes = await axios.patch(`${API_URL}/admin/verify-driver/${driver._id}`,
                { verified: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("✅ VERIFICATION RESPONSE:", verifyRes.data.message);

            // 5. Unverify Driver (cleanup)
            await axios.patch(`${API_URL}/admin/verify-driver/${driver._id}`,
                { verified: false },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("🔄 Reset verification for next test");
        }

        // 6. List Trips
        const tripsRes = await axios.get(`${API_URL}/admin/trips`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`🛣️ Found ${tripsRes.data.trips.length} total trips`);

        console.log("✨ ADMIN FLOW TEST PASSED!");

    } catch (error) {
        console.error("❌ ERROR:", error.response ? error.response.data : error.message);
    }
}

testAdminFlow();
