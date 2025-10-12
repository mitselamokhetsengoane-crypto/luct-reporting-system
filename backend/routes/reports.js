const express = require('express');
const auth = require('../middleware/auth');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.post('/', auth, reportController.createReport);
router.get('/my-reports', auth, reportController.getMyReports);
router.get('/class/:classId', auth, reportController.getClassReports);
router.get('/pending-approval', auth, reportController.getPendingApprovalReports);
router.get('/download/my-reports', auth, reportController.downloadMyReports);
router.get('/:id', auth, reportController.getReportById);
router.patch('/:id/sign', auth, reportController.signReport);
router.patch('/:id/approve', auth, reportController.approveReport);

// ADD THESE MISSING REPORT GENERATION ENDPOINTS
router.post('/generate/performance', auth, reportController.generatePerformanceReport);
router.post('/generate/attendance', auth, reportController.generateAttendanceReport);
router.post('/generate/faculty', auth, reportController.generateFacultyReport);
router.get('/statistics/:userId', auth, reportController.getReportStatistics);

module.exports = router;