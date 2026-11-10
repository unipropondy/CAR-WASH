const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

// GET /api/vehicle-types (or /api/vehicles)
router.get('/', vehicleController.getVehicleTypes);

// GET /api/vehicle-types/:id/image (or /api/vehicles/:id/image)
router.get('/:id/image', vehicleController.getVehicleImage);

module.exports = router;

