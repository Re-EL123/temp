const express = require("express");
const router = express.Router();
const controller = require("../controllers/child.controller");
const verifyToken = require("../middleware/authMiddleware");

const upload = require("../middleware/upload.middleware");

// Apply auth middleware to all routes
router.use(verifyToken());

router.post("/", controller.addChild);
router.post("/add", controller.addChild);
router.get("/", controller.getChildren);
router.get("/:id", controller.getChild);
router.put("/:id", controller.updateChild);
router.delete("/:id", controller.deleteChild);

// Photo upload
router.post("/:id/photo", upload.single('photo'), controller.uploadChildPhoto);

module.exports = router;
