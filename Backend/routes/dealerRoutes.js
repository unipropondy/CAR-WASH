const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealerController');
const carwashOrderController = require('../controllers/carwashOrderController');

// Paymodes for Dealer Settlements (from dbo.Paymode)
router.get('/paymodes', carwashOrderController.getPaymodes);

// Credit & Payment Settlement Endpoints (Must be declared before /:id)
router.get('/credit/history', dealerController.getDealerCreditHistory);
router.get('/credit/outstanding', dealerController.getDealerOutstandingBills);
router.get('/credit/payments', dealerController.getDealerPaymentHistory);
router.post('/credit/settle', dealerController.settleDealerCredit);

// Vehicle History & Visit Count Endpoints (Must be declared before /:id)
router.get('/history/summary', dealerController.getDealerVehicleHistorySummary);
router.get('/history/visits', dealerController.getDealerDetailedVisits);

// Base Dealer CRUD Endpoints
router.get('/', dealerController.getDealers);
router.get('/:id', dealerController.getDealerById);
router.post('/', dealerController.createDealer);
router.put('/:id', dealerController.updateDealer);
router.delete('/:id', dealerController.deleteDealer);

module.exports = router;


