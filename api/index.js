// Vercel API entry point - wraps the main server.js and handles serverless errors
try {
  // Prevent server.listen() errors in serverless by setting environment variable
  process.env.VERCEL_URL = process.env.VERCEL_URL || 'serverless';
  const app = require('../server.js');
  module.exports = app;
} catch (error) {
  // Log error but still export a basic error handler
  console.error('Error loading server.js:', error.message);
  const express = require('express');
  const app = express();
  app.use((req, res) => {
    res.status(500).json({ error: 'Server initialization failed', message: error.message });
  });
  module.exports = app;
}
