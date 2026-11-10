const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const packageController = require('../controllers/packageController');

// GET /api/service-categories (or /api/categories)
router.get('/', categoryController.getServiceCategories);

// GET /api/service-categories/:categoryId/packages
router.get('/:categoryId/packages', packageController.getPackages);

// GET /api/service-categories/:id/image
router.get('/:id/image', categoryController.getCategoryImage);

module.exports = router;

