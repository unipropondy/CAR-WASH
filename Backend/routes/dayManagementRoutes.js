const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dayManagementController = require('../controllers/dayManagementController');

const JWT_SECRET = process.env.JWT_SECRET || 'car-wash-secret-key-fallback';

/**
 * Optional or user authentication middleware
 */
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

// 1. GET /api/day-management/status
router.get('/status', optionalAuth, dayManagementController.getStatus);

// 2. POST /api/day-management/start
router.post('/start', optionalAuth, dayManagementController.startDay);

// 3. GET /api/day-management/summary
router.get('/summary', optionalAuth, dayManagementController.getSummary);

// 4. POST /api/day-management/cash-movement
router.post('/cash-movement', optionalAuth, dayManagementController.recordCashMovement);

// 5. GET /api/day-management/closing-preview
router.get('/closing-preview', optionalAuth, dayManagementController.getClosingPreview);

// 6. POST /api/day-management/close
router.post('/close', optionalAuth, dayManagementController.closeDay);

// 7. GET /api/day-management/history
router.get('/history', optionalAuth, dayManagementController.getHistory);

// 8. GET /api/day-management/:dayId/details
router.get('/:dayId/details', optionalAuth, dayManagementController.getDayDetails);

// 9. GET /api/day-management/:dayId/audit
router.get('/:dayId/audit', optionalAuth, dayManagementController.getDayAudit);

module.exports = router;
