const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api';
const PARENT_EMAIL = 'testparent@example.com';
const PARENT_PASS = 'password123';

async function testPhotoUpload() {
    try {
        console.log("🚀 Starting Photo Upload Test...");

        // 1. Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: PARENT_EMAIL,
            password: PARENT_PASS
        });
        const token = loginRes.data.token;
        console.log("✅ Logged in");

        // 2. Get children
        const childrenRes = await axios.get(`${API_URL}/children`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!childrenRes.data.children || childrenRes.data.children.length === 0) {
            console.log("❌ No children found for test parent. Please run test_parent_flow.js first.");
            return;
        }

        const childId = childrenRes.data.children[0]._id;
        console.log(`✅ Using child ID: ${childId}`);

        // 3. Prepare Dummy Photo
        const testFilePath = path.join(__dirname, 'test_image.jpg');
        fs.writeFileSync(testFilePath, 'dummy image content');

        // 4. Upload Photo
        const form = new FormData();
        form.append('photo', fs.createReadStream(testFilePath));

        const uploadRes = await axios.post(`${API_URL}/children/${childId}/photo`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        console.log("🎊 UPLOAD RESPONSE:", uploadRes.data);

        if (uploadRes.data.success) {
            console.log("✨ TEST PASSED!");
        } else {
            console.log("❌ TEST FAILED:", uploadRes.data.message);
        }

        // Cleanup
        fs.unlinkSync(testFilePath);

    } catch (error) {
        console.error("❌ ERROR:", error.response ? error.response.data : error.message);
    }
}

testPhotoUpload();
