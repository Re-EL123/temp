const axios = require('axios');

async function testChildAddition() {
    const API_URL = 'http://localhost:3000/api';
    const parentCredentials = {
        email: 'testparent@example.com',
        password: 'password123' // Registered in previous step
    };

    try {
        console.log('1. Logging in as parent...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, parentCredentials);
        const token = loginRes.data.token;
        console.log('✅ Login successful.');

        console.log('2. Adding a test child...');
        const childData = {
            name: 'Test',
            surname: 'Child',
            age: 8,
            gender: 'male',
            schoolName: 'Greenwood Primary',
            grade: '3',
            homeAddress: '123 Home St, Capetown',
            schoolAddress: '456 School Rd, Capetown',
            parentContact: '0215551234',
            relationship: 'Father'
        };

        const addChildRes = await axios.post(`${API_URL}/children`, childData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Child added successfully:', addChildRes.data.child._id);

        console.log('3. Verifying child list...');
        const listRes = await axios.get(`${API_URL}/children`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Parent now has ${listRes.data.children.length} children.`);

    } catch (error) {
        console.error('❌ Test failed:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
    }
}

testChildAddition();
