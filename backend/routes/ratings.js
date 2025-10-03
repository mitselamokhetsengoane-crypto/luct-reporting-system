const express = require('express');
const auth = require('../middleware/auth');
const ratingController = require('../controllers/ratingController');

const router = express.Router();

router.post('/', auth, ratingController.createRating);
router.get('/my-ratings', auth, ratingController.getUserRatings);
router.get('/report/:reportId', auth, ratingController.getReportRatings);
router.get('/lecturer/:lecturerId', auth, ratingController.getLecturerRatings);
router.patch('/:id', auth, ratingController.updateRating);
router.delete('/:id', auth, ratingController.deleteRating);

module.exports = router;