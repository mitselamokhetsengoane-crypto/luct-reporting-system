const express = require('express');
const router = express.Router();
const {
  getPerformanceMetrics,
  getSystemHealth,
  getActivityLogs,
  getTrendData,
  getAlerts
} = require('../controllers/monitoringController');

// Apply authentication middleware if needed
// const auth = require('../middleware/auth');

// All monitoring routes
router.get('/performance', getPerformanceMetrics);
router.get('/health', getSystemHealth);
router.get('/activity', getActivityLogs);
router.get('/trends', getTrendData);
router.get('/alerts', getAlerts);

module.exports = router;