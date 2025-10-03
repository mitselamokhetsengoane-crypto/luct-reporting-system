const express = require('express');
const auth = require('../middleware/auth');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

router.get('/courses', auth, assignmentController.getCourses);
router.get('/classes', auth, assignmentController.getClasses);
router.get('/lecturers', auth, assignmentController.getLecturers);
router.post('/assign', auth, assignmentController.assignCourse);
router.get('/my-assignments', auth, assignmentController.getMyAssignments);
router.get('/all-assignments', auth, assignmentController.getAllAssignments);
router.get('/download/assignments', auth, assignmentController.downloadAssignments);

module.exports = router;