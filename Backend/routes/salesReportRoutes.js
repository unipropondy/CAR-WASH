const express = require('express');
const router = express.Router();
const {
  getSalesSummary,
  getServiceWiseSales,
  getBayUtilization,
  getPaymentChannelMix,
  getDateWiseWashTrend,
  getRecentWashes,
  getRecentTransactions,
  getFullDashboard,
} = require('../controllers/salesReportController');

// 1. Full Dashboard Aggregation (High Performance)
router.get('/dashboard', getFullDashboard);

// 2. Individual Metric Endpoints
router.get('/summary', getSalesSummary);
router.get('/service-wise', getServiceWiseSales);
router.get('/bay-utilization', getBayUtilization);
router.get('/payment-mix', getPaymentChannelMix);
router.get('/wash-trend', getDateWiseWashTrend);
router.get('/recent-washes', getRecentWashes);
router.get('/recent-transactions', getRecentTransactions);

module.exports = router;

