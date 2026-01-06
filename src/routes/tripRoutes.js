const express = require("express");
const router = express.Router();
const controller = require("../controllers/trip.controller");


router.post("/request", controller.requestTrip);
router.get("/", controller.getTrips);
router.put("/:id/status", controller.updateTripStatus);
router.post("/create", controller.createTrip);
router.delete("/:id", controller.deleteTrip);


module.exports = router;