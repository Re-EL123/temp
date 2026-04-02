const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Original middleware – used by all existing routes.
 * Usage: router.get("/admin", verifyToken(["admin"]), handler)
 */
function verifyToken(allowedRoles = []) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Ensure req.user.id is always available (some JWTs use _id or userId)
      if (!req.user.id) {
        req.user.id = decoded._id || decoded.userId || decoded.id;
      }

      // If the JWT doesn't contain name/email, try loading from DB
      // (wallet controller needs req.user.name and req.user.email)
      if (!req.user.name || !req.user.email) {
        try {
          const userId = req.user.id || req.user._id || req.user.userId;
          const dbUser = await User.findById(userId).select("name surname email role phone").lean();
          if (dbUser) {
            req.user.name = req.user.name || dbUser.name || "";
            req.user.surname = req.user.surname || dbUser.surname || "";
            req.user.email = req.user.email || dbUser.email || "";
            req.user.role = req.user.role || dbUser.role || "";
            req.user.phone = req.user.phone || dbUser.phone || "";
          }
        } catch (_) {
          // DB lookup failed – continue with decoded JWT data only
        }
      }

      // If routes require a specific role
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired – please log in again" });
      }
      res.status(401).json({ message: "Invalid token" });
    }
  };
}

/**
 * protect – alias used by wallet & payfast routes.
 * Usage: router.get("/wallet", protect, handler)
 *
 * Same as verifyToken() with no role restriction.
 */
const protect = verifyToken([]);

/**
 * restrictTo – optional role gate used after protect.
 * Usage: router.post("/admin-only", protect, restrictTo("admin"), handler)
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    next();
  };
}

// ── Export everything ──────────────────────────────────────────
// Default export   → verifyToken  (existing routes keep working)
// Named exports    → protect, restrictTo, verifyToken (new routes work too)
module.exports = verifyToken;
module.exports.protect = protect;
module.exports.restrictTo = restrictTo;
module.exports.verifyToken = verifyToken;
