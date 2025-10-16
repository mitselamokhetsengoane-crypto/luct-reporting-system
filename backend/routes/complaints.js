const express = require('express');
const auth = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

// Complaint management
router.get('/available-users', auth, complaintController.getAvailableUsers);
router.post('/', auth, complaintController.createComplaint);
router.get('/my-complaints', auth, complaintController.getMyComplaints);
router.get('/complaints-for-me', auth, complaintController.getComplaintsForMe);

// Report generation for complaints
router.post('/generate/report', auth, complaintController.generateComplaintReport);
router.get('/generated/all', auth, complaintController.getGeneratedReports);

module.exports = router;