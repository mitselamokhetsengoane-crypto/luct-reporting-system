const Rating = require('../models/Rating');

// Create a new rating
const createRating = async (req, res) => {
  try {
    const { report_id, rating_value, comment, rating_type, lecturer_id, course_id } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!report_id || !rating_value || !rating_type || !lecturer_id) {
      return res.status(400).json({
        error: 'Missing required fields: report_id, rating_value, rating_type, lecturer_id'
      });
    }

    // Check if user has already rated this report
    const hasRated = await Rating.hasUserRatedReport(user_id, report_id);
    if (hasRated) {
      return res.status(400).json({
        error: 'You have already rated this report'
      });
    }

    // Validate rating value
    if (rating_value < 1 || rating_value > 5) {
      return res.status(400).json({
        error: 'Rating value must be between 1 and 5'
      });
    }

    const ratingData = {
      user_id,
      report_id,
      lecturer_id,
      rating_value,
      comment: comment || '',
      rating_type
    };

    const rating = await Rating.create(ratingData);
    
    res.status(201).json({
      message: 'Rating submitted successfully',
      rating
    });
  } catch (error) {
    console.error('Error creating rating:', error);
    res.status(500).json({
      error: 'Failed to create rating',
      details: error.message
    });
  }
};

// Get ratings for a lecturer
const getLecturerRatings = async (req, res) => {
  try {
    const { lecturerId } = req.params;

    if (!lecturerId) {
      return res.status(400).json({
        error: 'Lecturer ID is required'
      });
    }

    const ratings = await Rating.findByLecturer(lecturerId);
    const averageRating = await Rating.getAverageRating(lecturerId);

    res.json({
      ratings,
      average_rating: parseFloat(averageRating.average_rating) || 0,
      total_ratings: parseInt(averageRating.total_ratings) || 0
    });
  } catch (error) {
    console.error('Error fetching lecturer ratings:', error);
    res.status(500).json({
      error: 'Failed to fetch lecturer ratings',
      details: error.message
    });
  }
};

// Get ratings by the current user
const getUserRatings = async (req, res) => {
  try {
    const user_id = req.user.id;

    const ratings = await Rating.findByUser(user_id);

    res.json({
      ratings,
      total_ratings: ratings.length
    });
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    res.status(500).json({
      error: 'Failed to fetch user ratings',
      details: error.message
    });
  }
};

// Get ratings for a specific report
const getReportRatings = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({
        error: 'Report ID is required'
      });
    }

    const ratings = await Rating.findByReport(reportId);

    res.json({
      ratings,
      total_ratings: ratings.length
    });
  } catch (error) {
    console.error('Error fetching report ratings:', error);
    res.status(500).json({
      error: 'Failed to fetch report ratings',
      details: error.message
    });
  }
};

// Update a rating
const updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { rating_value, comment, rating_type } = req.body;
    const user_id = req.user.id;

    // Check if rating exists and belongs to user
    const existingRating = await Rating.findById(ratingId);
    if (!existingRating) {
      return res.status(404).json({
        error: 'Rating not found'
      });
    }

    if (existingRating.user_id !== user_id) {
      return res.status(403).json({
        error: 'You can only update your own ratings'
      });
    }

    // Validate rating value
    if (rating_value && (rating_value < 1 || rating_value > 5)) {
      return res.status(400).json({
        error: 'Rating value must be between 1 and 5'
      });
    }

    const ratingData = {
      rating_value: rating_value || existingRating.rating_value,
      comment: comment !== undefined ? comment : existingRating.comment,
      rating_type: rating_type || existingRating.rating_type
    };

    const updatedRating = await Rating.update(ratingId, ratingData);

    res.json({
      message: 'Rating updated successfully',
      rating: updatedRating
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({
      error: 'Failed to update rating',
      details: error.message
    });
  }
};

// Delete a rating
const deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const user_id = req.user.id;

    // Check if rating exists and belongs to user
    const existingRating = await Rating.findById(ratingId);
    if (!existingRating) {
      return res.status(404).json({
        error: 'Rating not found'
      });
    }

    if (existingRating.user_id !== user_id) {
      return res.status(403).json({
        error: 'You can only delete your own ratings'
      });
    }

    await Rating.delete(ratingId);

    res.json({
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      error: 'Failed to delete rating',
      details: error.message
    });
  }
};

module.exports = {
  createRating,
  getLecturerRatings,
  getUserRatings,
  getReportRatings,
  updateRating,
  deleteRating
};