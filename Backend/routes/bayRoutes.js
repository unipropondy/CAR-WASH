const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  getBays,
  getBayById,
  createBay,
  updateBay,
  updateBayStatus,
  assignBay,
  releaseBay,
  updateLayout,
} = require('../controllers/bayMasterController');

const JWT_SECRET = process.env.JWT_SECRET || 'car-wash-secret-key-fallback';

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Ignore invalid/expired token
  }
  next();
}

// 1. GET /api/bays - Fetch all bays from dbo.BayMaster
router.get('/', optionalAuth, getBays);

// 2. PUT /api/bays/layout - Update bay layout positions
router.put('/layout', optionalAuth, updateLayout);

// 3. GET /api/bays/:id - Fetch single bay by BayId or BayNumber
router.get('/:id', optionalAuth, getBayById);

// 4. POST /api/bays - Create new bay in dbo.BayMaster
router.post('/', optionalAuth, createBay);

// 5. PUT /api/bays/:id - Update bay properties
router.put('/:id', optionalAuth, updateBay);

// 6. PUT /api/bays/:id/status - Update bay status
router.put('/:id/status', optionalAuth, updateBayStatus);

// 7. PUT /api/bays/:id/assign - Assign customer and vehicle in dbo.BayMaster
router.put('/:id/assign', optionalAuth, assignBay);

// 8. PUT /api/bays/:id/release - Release bay to AVAILABLE
router.put('/:id/release', optionalAuth, releaseBay);

module.exports = router;

