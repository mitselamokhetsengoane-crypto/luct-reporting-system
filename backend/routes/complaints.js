const express = require('express');
const auth = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

router.post('/', auth, complaintController.createComplaint);
router.get('/my-complaints', auth, complaintController.getMyComplaints);
router.get('/for-me', auth, complaintController.getComplaintsForMe);
router.patch('/:id/respond', auth, complaintController.respondToComplaint);
router.get('/download/my-complaints', auth, complaintController.downloadMyComplaints);

module.exports = router;