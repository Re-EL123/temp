// Vercel API entry point - wraps the main server.js
const app = require('../server.js');

// Export as Vercel serverless function
module.exports = app;
