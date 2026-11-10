const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const packageController = require('../controllers/packageController');

// 1. GET /api/service-categories
router.get('/', categoryController.getServiceCategories);

// 2. GET /api/service-categories/:categoryId/packages
router.get('/:categoryId/packages', packageController.getPackages);

// 3. GET /api/service-categories/:id/image
router.get('/:id/image', categoryController.getCategoryImage);

// 4. POST /api/service-categories
router.post('/', categoryController.createServiceCategory);

// 5. PUT /api/service-categories/:id
router.put('/:id', categoryController.updateServiceCategory);

// 6. DELETE /api/service-categories/:id
router.delete('/:id', categoryController.deleteServiceCategory);

module.exports = router;
