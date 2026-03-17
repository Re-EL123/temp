const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/user');
const Child = require('../src/models/Child');

dotenv.config();

async function verifyDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Check Admin User
        const admin = await User.findOne({ email: 'admin@safeschoolride.com' });
        if (admin) {
            console.log('✅ Admin user found:');
            console.log(`   - Name: ${admin.name} ${admin.surname}`);
            console.log(`   - Role: ${admin.role}`);
            console.log(`   - Active: ${admin.isActive}`);
        } else {
            console.log('❌ Admin user NOT found.');
        }

        // 2. Count Users by Role
        const roleCounts = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        console.log('\n📊 User counts by role:');
        roleCounts.forEach(r => {
            console.log(`   - ${r._id || 'unassigned'}: ${r.count}`);
        });

        // 3. Count Children
        const childCount = await Child.countDocuments();
        console.log(`\n👶 Total children registered: ${childCount}`);

        // 4. Sample Child Data (Optional)
        if (childCount > 0) {
            const sampleChild = await Child.findOne().select('name surname parentId');
            console.log('📝 Sample child data:');
            console.log(`   - Name: ${sampleChild.name} ${sampleChild.surname}`);
            console.log(`   - Parent ID: ${sampleChild.parentId}`);
        }

    } catch (error) {
        console.error('❌ Error verifying database:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyDatabase();
