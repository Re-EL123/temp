const { io } = require("socket.io-client");
const axios = require("axios");

async function testSocketAlert() {
    const SOCKET_URL = "http://localhost:3000";
    const API_URL = "http://localhost:3000/api";

    // 1. Connect to Socket.IO
    console.log("🔗 Connecting to Socket.IO...");
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
        console.log("✅ Connected to Socket.IO server.");
    });

    // 2. Listen for 'child:added' event
    socket.on("child:added", (data) => {
        console.log("\n🎊 RECEIVED SOCKET ALERT: 'child:added'");
        console.log("   - Child:", data.child.name, data.child.surname);
        console.log("   - Parent:", data.parent.name);
        console.log("   - Address:", data.child.homeAddress.address);

        console.log("\n✅ Verification Successful!");
        socket.disconnect();
        process.exit(0);
    });

    // 3. Trigger Child Addition via API
    try {
        console.log("🔑 Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "testparent@example.com",
            password: "password123"
        });
        const token = loginRes.data.token;

        console.log("👶 Adding child to trigger alert...");
        await axios.post(`${API_URL}/children`, {
            name: "Socket",
            surname: "Test",
            age: 5,
            gender: "female",
            schoolName: "Tech Academy",
            grade: "R",
            homeAddress: {
                address: "789 Socket Way, Capetown",
                coordinates: [18.4233, -33.9249]
            },
            schoolAddress: "123 Logic Lane, Capetown",
            parentContact: "0219999999",
            relationship: "Mother"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

    } catch (error) {
        console.error("❌ Error during test:", error.response?.data || error.message);
        socket.disconnect();
        process.exit(1);
    }

    // Timeout after 10 seconds
    setTimeout(() => {
        console.log("\n❌ Timeout: No socket alert received.");
        socket.disconnect();
        process.exit(1);
    }, 10000);
}

testSocketAlert();
