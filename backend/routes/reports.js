const express = require('express');
const auth = require('../middleware/auth');
const reportController = require('../controllers/reportController');

const router = express.Router();

// Report creation and management
router.post('/', auth, reportController.createReport);
router.get('/my-reports', auth, reportController.getMyReports);
router.get('/class/:classId', auth, reportController.getClassReports);
router.get('/pending-approval', auth, reportController.getPendingApprovalReports);
router.get('/:id', auth, reportController.getReportById);
router.patch('/:id/sign', auth, reportController.signReport);
router.patch('/:id/approve', auth, reportController.approveReport);

// Report generation endpoints
router.post('/generate/performance', auth, reportController.generatePerformanceReport);
router.post('/generate/attendance', auth, reportController.generateAttendanceReport);
router.post('/generate/faculty', auth, reportController.generateFacultyReport);

// Generated reports management
router.get('/generated/all', auth, reportController.getGeneratedReports);

module.exports = router;