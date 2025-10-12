const express = require('express');
const auth = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

// ✅ Every user can create a complaint
router.post('/', auth, complaintController.createComplaint);

// ✅ Complaint routes for individual users
router.get('/my-complaints', auth, complaintController.getMyComplaints);
router.get('/for-me', auth, complaintController.getComplaintsForMe);

// ✅ Admin roles can see all complaints
router.get('/all', auth, complaintController.getAllComplaints);

// ✅ Get available users for complaints
router.get('/available-users', auth, complaintController.getAvailableUsers);

// ✅ Get specific complaint by ID
router.get('/:id', auth, complaintController.getComplaintById);

// ✅ Respond or update complaint
router.patch('/:id/respond', auth, complaintController.respondToComplaint);

// ✅ Update complaint status (admin only)
router.patch('/:id/status', auth, complaintController.updateComplaintStatus);

// ✅ Add feedback to complaint
router.post('/:id/feedback', auth, complaintController.addFeedback);

module.exports = router;