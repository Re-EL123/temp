# 🚸 SafeSchoolRide – Backend (Node.js)

A scalable, real-time backend system for **SafeSchoolRide**, a school transportation platform designed to safely manage student trips between home and school through **Parent**, **Admin**, and **Driver** panels.

---

## 📌 Project Overview

SafeSchoolRide enables parents to register children and request transport, administrators to assign drivers and manage capacity, and drivers to transport students while sharing real-time trip updates.

This repository contains the **backend API and real-time services** built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.

---

## 🎯 Core Objectives

- Enable parents to book school transport for their children
- Allow administrators to manage drivers and trip assignments
- Enforce vehicle seat capacity rules
- Provide real-time trip tracking and status updates
- Support mobile and web clients from a single backend

---

## 🏗 System Architecture

**Backend Stack:**

- Node.js
- Express.js
- MongoDB (Mongoose)
- Socket.IO (real-time communication)
- JWT Authentication
- RESTful API design

**Client Platforms:**

- React Native (Mobile – Expo)
- React.js / Expo Web (Web)

---

## 👥 User Panels & Responsibilities

### Parent Panel

- Register parent account
- Register one or more children
- Book pickup and drop-off trips
- Track trips in real time

### Admin Panel

- View all trips
- Assign drivers to trips
- Enforce seat capacity
- Monitor live trip activity

### Driver Panel

- View assigned trips
- Update trip status
- Share live GPS location during trips

---

## 📁 Project Structure

SafeschoolRide-backend-Node.js/
├── src/
│ ├── config/
│ │ └── db.js
│ ├── controllers/
│ │ ├── authController.js
│ │ ├── trip.controller.js
│ │ ├── paymentController.js
│ │ └── withdrawalController.js
│ ├── middleware/
│ │ ├── auth.js
│ │ ├── adminOnly.js
│ │ └── roleCheck.js
│ ├── models/
│ │ ├── User.js
│ │ ├── Child.js
│ │ ├── Driver.js
│ │ └── Trip.model.js
│ ├── routes/
│ │ ├── authRoutes.js
│ │ ├── protectedRoutes.js
│ │ ├── adminRoutes.js
│ │ ├── tripRoutes.js
│ │ ├── paymentRoutes.js
│ │ └── withdrawalRoute.js
│ └── socket.js
├── server.js
├── .env
├── package.json
└── README.md

yaml
Copy code

---

## 🗂 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ CHILD : registers
    USER ||--o{ TRIP : creates
    DRIVER ||--o{ TRIP : assigned_to
    CHILD ||--o{ TRIP : participates_in

    USER {
        ObjectId _id
        string name
        string email
        string role
    }

    CHILD {
        ObjectId _id
        ObjectId parentId
        string fullName
        string schoolName
        string homeAddress
        string grade
    }

    DRIVER {
        ObjectId _id
        ObjectId userId
        number vehicleSeats
        number assignedStudents
    }

    TRIP {
        ObjectId _id
        ObjectId parentId
        ObjectId childId
        ObjectId driverId
        string tripType
        string pickupLocation
        string dropoffLocation
        string status
        date pickupTime
    }
🔐 Authentication & Authorization
JWT-based authentication

Role-based access control:

parent

admin

driver

Protected routes enforced via middleware

🔁 Trip Lifecycle
nginx
Copy code
pending → assigned → in_progress → completed
                ↘ cancelled
🔴 Real-Time Features (Socket.IO)
Live driver GPS tracking

Real-time trip status updates

Instant trip assignment notifications

Parent, Admin, and Driver event subscriptions

Socket Events
Event	Description
trip:new	New trip requested
trip:assigned	Driver assigned
trip:status	Status updated
trip:location	Driver GPS update
trip:deleted	Trip removed

🌍 API Overview
Base URL: /api

Key Endpoints
Method	Endpoint	Description
POST	/auth/login	User login
POST	/trips/request	Parent books trip
POST	/trips/assign-driver	Admin assigns driver
GET	/trips/driver	Driver gets assigned trips
PATCH	/trips/:id/status	Update trip status

⚙️ Environment Variables
Create a .env file in the root directory:

env
Copy code
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
▶️ Running the Project
Install Dependencies
bash
Copy code
npm install
Start Server
bash
Copy code
npm run dev
# or
node server.js
Server will run on:

arduino
Copy code
http://localhost:3000
📡 Deployment Ready
Compatible with:

Render

Railway

VPS (Ubuntu / Nginx)

Docker (optional)

🚀 Future Enhancements
Google Maps route optimization

Geofencing (auto arrival detection)

Push notifications (Firebase)

Trip analytics & reports

Offline driver mode

Audit logs for admin actions

👨‍💻 Contributors
Backend Development: SafeSchoolRide Engineering Team

Architecture & Design: Ground Up Grinders

