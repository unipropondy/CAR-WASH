const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  getPaymodes,
  createOrder,
  updatePayment,
  updateStatus,
  getOrders,
  getOrderById,
  getOrderHistory,
} = require('../controllers/carwashOrderController');
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
const {
  requestHelp,
  getActiveHelpRequests,
  resolveHelpRequest,
  clearAllHelpRequests,
} = require('../controllers/helpNotificationController');

const JWT_SECRET = process.env.JWT_SECRET || 'car-wash-secret-key-fallback';

// Optional auth middleware for POS actions
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Session token invalid or expired; proceed without req.user
  }
  next();
}

// 1. GET /api/carwash/paymodes - Fetch active payment modes
router.get('/paymodes', getPaymodes);

// 2. POST /api/carwash/orders - Kiosk customer booking (saves customer details)
router.post('/orders', createOrder);

// 3. GET /api/carwash/orders - Fetch orders for Staff POS queue
router.get('/orders', optionalAuth, getOrders);

// 4. GET /api/carwash/orders/:id - Fetch single order details
router.get('/orders/:id', optionalAuth, getOrderById);

// 5. PUT /api/carwash/orders/:id/payment - Update payment mode / confirm payment
router.put('/orders/:id/payment', optionalAuth, updatePayment);

// 6. PUT /api/carwash/orders/:id/status - Update order status (Cashier operations)
router.put('/orders/:id/status', optionalAuth, updateStatus);

// 7. GET /api/carwash/orders/:id/history - Get complete audit status history
router.get('/orders/:id/history', optionalAuth, getOrderHistory);

// ================= BAY MANAGEMENT (BayMaster ONLY) =================
// 8. GET /api/carwash/bays - Fetch all bays from dbo.BayMaster
router.get('/bays', optionalAuth, getBays);

// 9. PUT /api/carwash/bays/layout - Update bay layout positions
router.put('/bays/layout', optionalAuth, updateLayout);

// 10. GET /api/carwash/bays/:id - Fetch single bay by BayId or BayNumber
router.get('/bays/:id', optionalAuth, getBayById);

// 11. POST /api/carwash/bays - Create new bay in dbo.BayMaster
router.post('/bays', optionalAuth, createBay);

// 12. PUT /api/carwash/bays/:id - Update bay properties
router.put('/bays/:id', optionalAuth, updateBay);

// 13. PUT /api/carwash/bays/:id/status - Update bay status
router.put('/bays/:id/status', optionalAuth, updateBayStatus);

// 14. PUT /api/carwash/bays/:id/assign - Assign customer and vehicle in dbo.BayMaster
router.put('/bays/:id/assign', optionalAuth, assignBay);

// 15. PUT /api/carwash/bays/:id/release - Release bay to AVAILABLE
router.put('/bays/:id/release', optionalAuth, releaseBay);

// ================= KIOSK HELP & NOTIFICATIONS =================
// 16. POST /api/carwash/help - Kiosk customer requests assistance
router.post('/help', requestHelp);

// 17. GET /api/carwash/help - POS queries active help requests
router.get('/help', optionalAuth, getActiveHelpRequests);

// 18. PUT /api/carwash/help/:id/resolve - Cashier resolves help request
router.put('/help/:id/resolve', optionalAuth, resolveHelpRequest);

// 19. DELETE /api/carwash/help - Clear all help requests
router.delete('/help', optionalAuth, clearAllHelpRequests);

module.exports = router;

