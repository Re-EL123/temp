/**
 * Shared CORS configuration for SafeSchoolRide API and Socket.IO
 */
const allowedOrigins = [
    "http://localhost:8081",
    "http://localhost:19006",
    "https://laughing-tribble-7v9qwjj559jx3pxvw-8081.app.github.dev", // Your current URL
    process.env.FRONTEND_URL
].filter(Boolean);

const isOriginAllowed = (origin) => {
    // Allow requests with no origin (like mobile apps or local scripts)
    if (!origin) return true;

    // Check if origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) return true;

    // Allow any localhost/127.0.0.1 variation
    const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
    if (isLocalhost) return true;

    // FIX: Allow GitHub Codespaces dynamically
    const isCodespace = origin.endsWith(".github.dev");
    if (isCodespace) return true;

    return false;
};

module.exports = {
    allowedOrigins,
    isOriginAllowed
};
