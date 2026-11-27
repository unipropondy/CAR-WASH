const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// 1. GET /api/service-packages or /api/service-packages?categoryId=1
router.get('/', packageController.getPackages);

// 2. GET /api/service-packages/category/:categoryId
router.get('/category/:categoryId', packageController.getPackages);

// 8. GET /api/service-packages/all-vehicle-prices (must be before /:packageId routes)
router.get('/all-vehicle-prices', packageController.getAllPackageVehicleTypePrices);

// 3. GET /api/service-packages/:packageId/features
router.get('/:packageId/features', packageController.getPackageFeatures);

// 6. GET /api/service-packages/:packageId/vehicle-prices
router.get('/:packageId/vehicle-prices', packageController.getPackageVehicleTypePrices);

// 7. PUT /api/service-packages/:packageId/vehicle-prices/:vehicleTypeId
router.put('/:packageId/vehicle-prices/:vehicleTypeId', packageController.upsertPackageVehicleTypePrice);

// 4. POST /api/service-packages - Create new package
router.post('/', packageController.createPackage);

// 5. PUT /api/service-packages/:id - Update package
router.put('/:id', packageController.updatePackage);

// 6. DELETE /api/service-packages/:id - Delete or deactivate package
router.delete('/:id', packageController.deletePackage);

module.exports = router;
