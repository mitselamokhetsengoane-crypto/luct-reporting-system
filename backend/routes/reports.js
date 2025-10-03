const express = require('express');
const auth = require('../middleware/auth');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.post('/', auth, reportController.createReport);
router.get('/my-reports', auth, reportController.getMyReports);
router.get('/class/:classId', auth, reportController.getClassReports);
router.get('/pending-approval', auth, reportController.getPendingApprovalReports); // MOVED UP - before /:id
router.get('/download/my-reports', auth, reportController.downloadMyReports);
router.get('/:id', auth, reportController.getReportById); // This should be AFTER specific routes
router.patch('/:id/sign', auth, reportController.signReport);
router.patch('/:id/approve', auth, reportController.approveReport);

module.exports = router;