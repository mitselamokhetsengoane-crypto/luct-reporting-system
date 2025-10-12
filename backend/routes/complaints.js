const express = require('express');
const auth = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

router.post('/', auth, complaintController.createComplaint);
router.get('/my-complaints', auth, complaintController.getMyComplaints);
router.get('/for-me', auth, complaintController.getComplaintsForMe);
router.get('/all', auth, complaintController.getAllComplaints);
router.patch('/:id/respond', auth, complaintController.respondToComplaint);
router.patch('/:id/status', auth, complaintController.updateComplaintStatus);
router.get('/download/my-complaints', auth, complaintController.downloadMyComplaints);

// ADD THESE MISSING COMPLAINT ENDPOINTS
router.post('/generate-report', auth, complaintController.generateComplaintReport);
router.get('/statistics', auth, complaintController.getComplaintStatistics);

module.exports = router;