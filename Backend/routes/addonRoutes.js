const express = require('express');
const router = express.Router();
const {
  getAddons,
  createAddon,
  updateAddon,
  deleteAddon,
} = require('../controllers/addonMasterController');

// GET /api/service-addons
router.get('/', getAddons);

// POST /api/service-addons
router.post('/', createAddon);

// PUT /api/service-addons/:id
router.put('/:id', updateAddon);

// DELETE /api/service-addons/:id
router.delete('/:id', deleteAddon);

module.exports = router;
