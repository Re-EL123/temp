# SafeSchoolRide Frontend Implementation Guide

## Account Creation (CreateAccount.tsx) - Full Implementation

This guide provides comprehensive instructions for implementing a fully functional account creation flow in your React Native (Expo) frontend that integrates with the SafeSchoolRide backend.

### Overview

The frontend must:
1. Collect user registration data via form inputs
2. Send data to the backend registration endpoint
3. Handle success/error responses
4. Store user information securely
5. Navigate to next screen after successful registration

### Backend Endpoints Used

#### Registration Endpoint
- **URL**: `https://temp-weld-rho.vercel.app/api/auth/register`
- **Method**: POST
- **Required Fields**: name, surname, email, password
- **Optional Fields**: role (defaults to "parent")
- **Response**: User object with id, name, surname, email, role

#### Login Endpoint
- **URL**: `https://temp-weld-rho.vercel.app/api/auth/login`
- **Method**: POST
- **Required Fields**: email, password
- **Response**: JWT token + User object

### Implementation Steps

#### 1. State Management

Define state variables for:
- Form inputs (name, surname, email, password, role)
- Loading state
- Error messages
- Validation errors

#### 2. Form Input Handling

Create input fields for:
- First Name / Name
- Last Name / Surname
- Email Address
- Password
- Role Selection (optional: parent, admin, driver)

#### 3. Validation

Implement client-side validation:
- Name and surname: non-empty, 2-50 characters
- Email: valid email format
- Password: minimum 8 characters, strong password recommendations
- All fields required

#### 4. Registration Request

```typescript
const registerUser = async () => {
  // Validate inputs
  if (!validateInputs()) {
    setErrorMessage('Please fill in all fields correctly');
    return;
  }

  setLoading(true);
  
  try {
    const response = await fetch(
      'https://temp-weld-rho.vercel.app/api/auth/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: firstName,
          surname: lastName,
          email: email,
          password: password,
          role: role || 'parent',
        }),
      }
    );

    const data = await response.json();

    if (response.ok && data.user) {
      // Success - store user data
      await storeUserData(data.user);
      
      // Navigate to next screen
      navigation.navigate('LoginScreen'); // or 'HomeScreen' if auto-logging in
    } else {
      // Handle error response
      setErrorMessage(data.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    setErrorMessage('Network error. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

#### 5. Secure Data Storage

Use AsyncStorage for React Native:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const storeUserData = async (user) => {
  try {
    await AsyncStorage.setItem(
      'userData',
      JSON.stringify({
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        registeredAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('Error storing user data:', error);
  }
};
```

#### 6. Error Handling

Handle common backend errors:
- 400: Missing fields or email already exists
- 500: Server error
- Network errors: Connection issues

Display user-friendly error messages based on response.

#### 7. UI Preservation

Keep the existing UI structure and styling unchanged. Only modify:
- Form submission logic
- State management
- API calls
- Navigation behavior

### Complete Example Code

```typescript
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CreateAccount = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateInputs = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }
    if (password.length < 8) {
      return false;
    }
    return true;
  };

  const storeUserData = async (user) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    
    if (!validateInputs()) {
      setErrorMessage('Please enter valid information');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(
        'https://temp-weld-rho.vercel.app/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: firstName,
            surname: lastName,
            email: email.toLowerCase(),
            password: password,
            role: role,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.user) {
        await storeUserData(data.user);
        navigation.navigate('Login'); // or auto-login and navigate to home
      } else {
        setErrorMessage(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Your existing UI components */}
      
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 10,
  },
});

export default CreateAccount;
```

### Testing Checklist

- [ ] Form validation works correctly
- [ ] Valid registration data creates account
- [ ] Duplicate email returns error
- [ ] Missing fields show validation errors
- [ ] Network errors handled gracefully
- [ ] User data stored in AsyncStorage
- [ ] Navigation works after successful registration
- [ ] Loading state prevents double submission
- [ ] UI remains unchanged from original design

### Security Considerations

1. **Password Handling**: Never log passwords, clear sensitive data after submission
2. **Token Storage**: Store JWT securely (AsyncStorage is sufficient for development)
3. **HTTPS**: All requests use HTTPS (Vercel deployment)
4. **Input Sanitization**: Trim whitespace, validate email format
5. **Error Messages**: Don't expose internal server details to users

### Common Issues & Solutions

**Issue**: "Email already exists" error
- Solution: Check if email is already registered, provide clear message

**Issue**: Network timeout
- Solution: Implement timeout and retry logic

**Issue**: Token expiration
- Solution: Store token and implement refresh logic for protected endpoints

### Next Steps After Registration

1. Auto-login user (optional)
2. Navigate to home screen or profile setup
3. Load user's children (if parent role)
4. Redirect based on role (parent/admin/driver)

### API Response Examples

**Success (201)**:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John",
    "surname": "Doe",
    "email": "john@example.com",
    "role": "parent"
  }
}
```

**Error (400)**:
```json
{
  "message": "Email already exists"
}
```

**Error (500)**:
```json
{
  "message": "Server error",
  "error": "Internal server error details"
}
```

### Deployment Notes

- Backend URL: `https://temp-weld-rho.vercel.app`
- CORS is enabled on all endpoints
- All endpoints support OPTIONS preflight requests
- No authentication required for registration
- JWT tokens have 7-day expiration
