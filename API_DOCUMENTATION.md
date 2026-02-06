# SafeSchoolRide Backend - API Documentation

## Base URL
```
https://temp-weld-rho.vercel.app
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 1. Authentication Endpoints

### 1.1 Register a New User
**POST** `/api/auth/register`

#### Request Body:
```json
{
  "name": "John",
  "surname": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "parent"  // Optional: "parent", "admin", "driver" (defaults to "parent")
}
```

#### Response (201):
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

#### Error Responses:
- **400**: Missing required fields or email already exists
- **500**: Server error

---

### 1.2 Login
**POST** `/api/auth/login`

#### Request Body:
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Response (200):
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John",
    "surname": "Doe",
    "email": "john@example.com",
    "role": "parent"
  }
}
```

#### Error Responses:
- **400**: Invalid credentials
- **404**: User not found
- **500**: Server error

---

## 2. User Profile Endpoints

### 2.1 Get User Profile
**GET** `/api/user/profile`

#### Headers:
```
Authorization: Bearer <token>
```

#### Response (200):
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John",
    "surname": "Doe",
    "email": "john@example.com",
    "role": "parent",
    "createdAt": "2026-01-08T10:00:00.000Z",
    "updatedAt": "2026-01-08T10:00:00.000Z"
  }
}
```

#### Error Responses:
- **401**: No token provided or invalid token
- **404**: User not found
- **500**: Server error

---

## 3. Children Management Endpoints

### 3.1 Get All Children
**GET** `/api/user/children`

#### Headers:
```
Authorization: Bearer <token>
```

#### Response (200):
```json
{
  "success": true,
  "children": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Emma Doe",
      "gender": "female",
      "age": 8,
      "grade": "3",
      "schoolName": "ABC Primary School",
      "parent": "507f1f77bcf86cd799439011"
    }
  ]
}
```

---

### 3.2 Add a New Child
**POST** `/api/user/children`

#### Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body:
```json
{
  "name": "Emma Doe",
  "gender": "female",  // Required
  "age": 8,
  "grade": "3",
  "schoolName": "ABC Primary School"
}
```

#### Response (201):
```json
{
  "success": true,
  "message": "Child added successfully",
  "child": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Emma Doe",
    "gender": "female",
    "age": 8,
    "grade": "3",
    "schoolName": "ABC Primary School",
    "parent": "507f1f77bcf86cd799439011"
  }
}
```

#### Error Responses:
- **400**: Missing required fields (name, gender)
- **401**: No token provided or invalid token
- **500**: Server error

---

### 3.3 Update a Child
**PUT** `/api/user/children?childId=<childId>`

#### Headers:
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Query Parameters:
- `childId` (required): The ID of the child to update

#### Request Body:
```json
{
  "name": "Emma Doe",
  "gender": "female",
  "age": 9,
  "grade": "4",
  "schoolName": "ABC Primary School"
}
```

#### Response (200):
```json
{
  "success": true,
  "message": "Child updated successfully",
  "child": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Emma Doe",
    "gender": "female",
    "age": 9,
    "grade": "4",
    "schoolName": "ABC Primary School",
    "parent": "507f1f77bcf86cd799439011"
  }
}
```

#### Error Responses:
- **401**: No token provided or invalid token
- **404**: Child not found
- **500**: Server error

---

### 3.4 Delete a Child
**DELETE** `/api/user/children?childId=<childId>`

#### Headers:
```
Authorization: Bearer <token>
```

#### Query Parameters:
- `childId` (required): The ID of the child to delete

#### Response (200):
```json
{
  "success": true,
  "message": "Child deleted successfully"
}
```

#### Error Responses:
- **401**: No token provided or invalid token
- **404**: Child not found
- **500**: Server error

---

## 4. Driver Management Endpoints

### 4.1 Get Available Drivers
**GET** `/api/users/drivers/available`

#### Headers:
```
Authorization: Bearer <token>
```

#### Query Parameters:
- `lat` (required): Latitude of pickup location
- `lng` (required): Longitude of pickup location
- `radius` (optional): Search radius in kilometers (default: 50km)

#### Example Request:
```
GET /api/users/drivers/available?lat=-26.0667&lng=28.0667&radius=20
```

#### Response (200):
```json
{
  "success": true,
  "count": 3,
  "drivers": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "John Smith",
      "email": "john.driver@example.com",
      "vehicle": "Toyota Corolla - ABC123GP",
      "carBrand": "Toyota",
      "carModel": "Corolla",
      "registrationNumber": "ABC123GP",
      "seats": 4,
      "rating": 4.5,
      "distance": 1.2,
      "latitude": -26.0717,
      "longitude": 28.0717,
      "address": "123 Main St, Johannesburg",
      "available": true
    },
    {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Sarah Johnson",
      "email": "sarah.driver@example.com",
      "vehicle": "Honda Civic - XYZ789GP",
      "carBrand": "Honda",
      "carModel": "Civic",
      "registrationNumber": "XYZ789GP",
      "seats": 5,
      "rating": 4.5,
      "distance": 2.3,
      "latitude": -26.0597,
      "longitude": 28.0697,
      "address": "456 Second Ave, Johannesburg",
      "available": true
    }
  ],
  "searchLocation": {
    "latitude": -26.0667,
    "longitude": 28.0667,
    "radius": 20
  }
}
```

#### Error Responses:
- **400**: Missing or invalid coordinates
- **401**: No token provided or invalid token
- **500**: Server error

#### Notes:
- Drivers are sorted by distance (nearest first)
- Only active drivers with completed onboarding are returned
- Distance is calculated using the Haversine formula
- Default search radius is 50km

---

## CORS Headers
All endpoints have CORS enabled with the following headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin
```

## Error Handling

All error responses follow this format:
```json
{
  "message": "Error description",
  "error": "Additional error details (in development mode)"
}
```

Common HTTP Status Codes:
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **404**: Not Found
- **405**: Method Not Allowed
- **500**: Server Error

## Implementation Notes for Frontend

1. **Token Storage**: Store the JWT token securely (AsyncStorage for React Native)
2. **Token Expiration**: Tokens expire in 7 days
3. **Refresh Strategy**: Implement automatic login redirect on 401 responses
4. **Error Handling**: Always check the `success` field and handle error messages appropriately
5. **CORS**: All endpoints support CORS, no special handling needed
6. **Location Tracking**: For drivers, ensure location updates are sent regularly to maintain accuracy

## Testing the API

You can test these endpoints using tools like:
- Postman
- Thunder Client (VS Code)
- curl
- React Native's `fetch` API

Example React Native fetch call:
```javascript
const response = await fetch('https://temp-weld-rho.vercel.app/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'parent'
  })
});

const data = await response.json();
if (data.message) {
  console.log('Success:', data.message);
}
```

### Example: Fetching Available Drivers
```javascript
const token = await AsyncStorage.getItem('userToken');
const response = await fetch(
  'https://temp-weld-rho.vercel.app/api/users/drivers/available?lat=-26.0667&lng=28.0667&radius=20',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();
if (data.success) {
  console.log(`Found ${data.count} drivers:`, data.drivers);
}
```
