const express = require('express');
const router = express.Router();
const {
  getPaymodes,
  getPaymodeById,
  createPaymode,
  updatePaymode,
  togglePaymodeStatus,
  deletePaymode,
} = require('../controllers/paymodeController');

// 1. GET /api/paymodes - Fetch list (with ?all=true and ?search=...)
router.get('/', getPaymodes);

// 2. GET /api/paymodes/:payMode - Fetch single
router.get('/:payMode', getPaymodeById);

// 3. POST /api/paymodes - Create new payment mode
router.post('/', createPaymode);

// 4. PUT /api/paymodes/:payMode - Update payment mode
router.put('/:payMode', updatePaymode);

// 5. PATCH /api/paymodes/:payMode/status - Quick toggle active status
router.patch('/:payMode/status', togglePaymodeStatus);

// 6. DELETE /api/paymodes/:payMode - Delete payment mode
router.delete('/:payMode', deletePaymode);

module.exports = router;
