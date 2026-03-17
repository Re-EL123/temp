/**
 * Shared CORS configuration for SafeSchoolRide API and Socket.IO
 */
const allowedOrigins = [
    "http://localhost:8081",
    "http://localhost:19006",
    process.env.FRONTEND_URL
].filter(Boolean);

const isOriginAllowed = (origin) => {
    // Allow requests with no origin (like mobile apps or local scripts)
    if (!origin) return true;

    const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
    return allowedOrigins.indexOf(origin) !== -1 || isLocalhost;
};

module.exports = {
    allowedOrigins,
    isOriginAllowed
};
