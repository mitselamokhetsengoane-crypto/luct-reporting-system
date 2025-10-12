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

// ✅ Respond or update
router.patch('/:id/respond', auth, complaintController.respondToComplaint);

module.exports = router;
