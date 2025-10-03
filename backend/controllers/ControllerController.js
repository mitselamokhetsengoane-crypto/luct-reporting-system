// controllers/ratingController.js
const Rating = require('../models/Rating');

const ratingController = {
  createRating: async (req, res) => {
    try {
      const { report_id, lecturer_id, rating_value, comment, rating_type } = req.body;

      // Validate required fields
      if (!rating_value || !rating_type) {
        return res.status(400).json({ message: 'Rating value and type are required' });
      }

      // Validate rating value (1-5)
      if (rating_value < 1 || rating_value > 5) {
        return res.status(400).json({ message: 'Rating value must be between 1 and 5' });
      }

      // Check if user has already rated this report
      if (report_id) {
        const existingRating = await Rating.hasUserRatedReport(req.user.id, report_id);
        if (existingRating) {
          return res.status(400).json({ message: 'You have already rated this report' });
        }
      }

      const ratingData = {
        user_id: req.user.id,
        report_id: report_id || null,
        lecturer_id: lecturer_id || null,
        rating_value,
        comment: comment || '',
        rating_type // 'lecture_quality', 'content_quality', 'overall_experience'
      };

      const rating = await Rating.create(ratingData);
      res.status(201).json({ 
        message: 'Rating submitted successfully', 
        rating 
      });
    } catch (error) {
      console.error('Error creating rating:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getReportRatings: async (req, res) => {
    try {
      const { reportId } = req.params;
      const ratings = await Rating.findByReport(reportId);
      res.json(ratings);
    } catch (error) {
      console.error('Error fetching report ratings:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getLecturerRatings: async (req, res) => {
    try {
      const { lecturerId } = req.params;
      const ratings = await Rating.findByLecturer(lecturerId);
      const averageRating = await Rating.getAverageRating(lecturerId);
      
      res.json({
        ratings,
        average_rating: parseFloat(averageRating.average_rating) || 0,
        total_ratings: parseInt(averageRating.total_ratings) || 0,
        rating_breakdown: {
          five_star: parseInt(averageRating.five_star) || 0,
          four_star: parseInt(averageRating.four_star) || 0,
          three_star: parseInt(averageRating.three_star) || 0,
          two_star: parseInt(averageRating.two_star) || 0,
          one_star: parseInt(averageRating.one_star) || 0
        }
      });
    } catch (error) {
      console.error('Error fetching lecturer ratings:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getUserRatings: async (req, res) => {
    try {
      const ratings = await Rating.findByUser(req.user.id);
      res.json(ratings);
    } catch (error) {
      console.error('Error fetching user ratings:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  updateRating: async (req, res) => {
    try {
      const { id } = req.params;
      const { rating_value, comment } = req.body;

      // Validate rating value
      if (rating_value && (rating_value < 1 || rating_value > 5)) {
        return res.status(400).json({ message: 'Rating value must be between 1 and 5' });
      }

      const updatedRating = await Rating.updateRating(id, { rating_value, comment });
      
      if (!updatedRating) {
        return res.status(404).json({ message: 'Rating not found' });
      }

      res.json({ 
        message: 'Rating updated successfully', 
        rating: updatedRating 
      });
    } catch (error) {
      console.error('Error updating rating:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  deleteRating: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedRating = await Rating.deleteRating(id);
      
      if (!deletedRating) {
        return res.status(404).json({ message: 'Rating not found' });
      }

      res.json({ 
        message: 'Rating deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting rating:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

module.exports = ratingController;