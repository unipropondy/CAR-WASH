const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// 1. GET /api/service-packages or /api/service-packages?categoryId=1
router.get('/', packageController.getPackages);

// 2. GET /api/service-packages/category/:categoryId
router.get('/category/:categoryId', packageController.getPackages);

// 3. GET /api/service-packages/:packageId/features
router.get('/:packageId/features', packageController.getPackageFeatures);

// 4. POST /api/service-packages - Create new package
router.post('/', packageController.createPackage);

// 5. PUT /api/service-packages/:id - Update package
router.put('/:id', packageController.updatePackage);

// 6. DELETE /api/service-packages/:id - Delete or deactivate package
router.delete('/:id', packageController.deletePackage);

module.exports = router;
