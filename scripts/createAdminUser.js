import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String,
});
const User = mongoose.model('User', userSchema);

mongoose.connect('mongodb://127.0.0.1:27017/safeschoolride');

async function createUser() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const user = new User({
    email: 'admin@example.com',
    password: hashedPassword,
    role: 'admin',
  });

  await user.save();
  console.log('User created successfully!');
  mongoose.disconnect();
}

createUser();
