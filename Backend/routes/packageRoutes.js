const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// GET /api/service-packages or /api/service-packages?categoryId=1
router.get('/', packageController.getPackages);

// GET /api/service-packages/category/:categoryId
router.get('/category/:categoryId', packageController.getPackages);

// GET /api/service-packages/:packageId/features
router.get('/:packageId/features', packageController.getPackageFeatures);

module.exports = router;

