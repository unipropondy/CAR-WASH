const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');

// Printer management CRUD routes (backed by PrintMaster)
router.get('/', printerController.getAllPrinters);
router.post('/', printerController.createPrinter);

// Test printer endpoints
router.post('/test', printerController.testPrinter);
router.post('/:id/test', printerController.testPrinter);

// Automatic bill receipt printing endpoint
router.post('/print-receipt', printerController.printOrderReceipt);

// Single printer operations
router.get('/:id', printerController.getPrinterById);
router.put('/:id', printerController.updatePrinter);
router.delete('/:id', printerController.deletePrinter);

module.exports = router;

