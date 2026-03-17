const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./src/models/user');
const Driver = require('./src/models/Driver');

async function listDrivers() {
    try {
        console.log('Connecting to MongoDB:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const drivers = await Driver.find({}).populate('userId');
        console.log(`Found ${drivers.length} drivers:`);

        drivers.forEach(d => {
            console.log('---');
            console.log(`ID: ${d._id}`);
            console.log(`Name: ${d.userId ? (d.userId.name + ' ' + d.userId.surname) : 'Unknown User'}`);
            console.log(`Vehicle: ${d.carBrand} ${d.carModel} (${d.registrationNumber})`);
            console.log(`Location: ${JSON.stringify(d.location.coordinates)}`);
            console.log(`Verified: ${d.isVerified}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

listDrivers();
