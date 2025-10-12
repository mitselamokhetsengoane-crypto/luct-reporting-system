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
router.delete('/:id', auth, assignmentController.deleteAssignment);
router.get('/download/assignments', auth, assignmentController.downloadAssignments);

// ADD THESE MISSING ASSIGNMENT ENDPOINTS
router.get('/reports/:type', auth, assignmentController.generateAssignmentReport);
router.get('/statistics', auth, assignmentController.getAssignmentStatistics);

module.exports = router;