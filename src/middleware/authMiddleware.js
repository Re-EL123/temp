// src/middleware/authMiddleware.js - Authentication Middleware
const jwt = require("jsonwebtoken");

/**
 * Authentication middleware with role-based access control
 * @param {Array} allowedRoles - Array of roles that can access the route (optional)
 * @returns {Function} Express middleware function
 */
const authMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }

      // Extract token
      const token = authHeader.replace("Bearer ", "").trim();

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid token format.",
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        });
      }

      // Attach user data to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    } catch (error) {
      console.error("[Auth Middleware] Error:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token.",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Authentication failed.",
        error: error.message,
      });
    }
  };
};

/**
 * Verify token and check if user is admin
 */
const verifyAdmin = (req, res, next) => {
  return authMiddleware(["admin"])(req, res, next);
};

/**
 * Verify token and check if user is driver
 */
const verifyDriver = (req, res, next) => {
  return authMiddleware(["driver"])(req, res, next);
};

/**
 * Verify token and check if user is parent
 */
const verifyParent = (req, res, next) => {
  return authMiddleware(["parent"])(req, res, next);
};

/**
 * Verify token without role restriction
 */
const verifyToken = (req, res, next) => {
  return authMiddleware()(req, res, next);
};

module.exports = authMiddleware;
module.exports.verifyAdmin = verifyAdmin;
module.exports.verifyDriver = verifyDriver;
module.exports.verifyParent = verifyParent;
module.exports.verifyToken = verifyToken;
