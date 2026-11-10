const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

// 1. GET /api/vehicle-types
router.get('/', vehicleController.getVehicleTypes);

// 2. GET /api/vehicle-types/:id/image
router.get('/:id/image', vehicleController.getVehicleImage);

// 3. POST /api/vehicle-types - Create new vehicle type
router.post('/', vehicleController.createVehicleType);

// 4. PUT /api/vehicle-types/:id - Update vehicle type
router.put('/:id', vehicleController.updateVehicleType);

// 5. DELETE /api/vehicle-types/:id - Delete or deactivate vehicle type
router.delete('/:id', vehicleController.deleteVehicleType);

module.exports = router;
