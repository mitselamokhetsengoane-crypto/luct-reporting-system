import React, { useState, useEffect } from 'react';
import { ratingAPI } from '../services/api';

const RatingSystem = ({ reportId, lecturerId, user, onRatingSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingType, setRatingType] = useState('overall_experience');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    checkIfUserHasRated();
  }, [reportId, user.id]);

  const checkIfUserHasRated = async () => {
    if (!reportId) return;
    
    try {
      const response = await ratingAPI.getReportRatings(reportId);
      const userRating = response.data.find(r => r.user_id === user.id);
      if (userRating) {
        setHasRated(true);
        setRating(userRating.rating_value);
        setComment(userRating.comment);
        setRatingType(userRating.rating_type);
      }
    } catch (error) {
      console.error('Error checking user rating:', error);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setMessage('Please select a rating');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const ratingData = {
        report_id: reportId,
        lecturer_id: lecturerId,
        rating_value: rating,
        comment: comment,
        rating_type: ratingType
      };

      await ratingAPI.create(ratingData);
      setMessage('Rating submitted successfully!');
      setHasRated(true);
      
      if (onRatingSubmitted) {
        onRatingSubmitted();
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error submitting rating');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={`star-btn ${star <= rating ? 'active' : ''}`}
        onClick={() => setRating(star)}
        disabled={hasRated}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: hasRated ? 'not-allowed' : 'pointer',
          opacity: hasRated ? 0.6 : 1,
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!hasRated) e.target.style.transform = 'scale(1.2)';
        }}
        onMouseLeave={(e) => {
          if (!hasRated) e.target.style.transform = 'scale(1)';
        }}
      >
        ⭐
      </button>
    ));
  };

  return (
    <div className="rating-system" style={{
      background: '#f8f9fa',
      padding: '1.5rem',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <h4>Rate this {reportId ? 'Report' : 'Lecturer'}</h4>
      
      {hasRated && (
        <div className="rating-notice" style={{
          background: '#e7f3ff',
          padding: '0.75rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          borderLeft: '4px solid #3498db'
        }}>
          <p>You have already rated this {reportId ? 'report' : 'lecturer'}</p>
        </div>
      )}

      <form onSubmit={handleSubmitRating}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Rating Type</label>
          <select 
            value={ratingType} 
            onChange={(e) => setRatingType(e.target.value)}
            disabled={hasRated}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: hasRated ? '#f5f5f5' : 'white'
            }}
          >
            <option value="overall_experience">Overall Experience</option>
            <option value="lecture_quality">Lecture Quality</option>
            <option value="content_quality">Content Quality</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Your Rating</label>
          <div className="stars-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {renderStars()}
            <span className="rating-text" style={{ marginLeft: '1rem', fontWeight: '500', color: '#333' }}>
              {rating === 0 ? 'Select rating' : `${rating} star${rating > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Comment (Optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your feedback..."
            rows="3"
            disabled={hasRated}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: hasRated ? '#f5f5f5' : 'white'
            }}
          />
        </div>

        {!hasRated && (
          <button type="submit" className="btn btn-primary" disabled={loading} style={{
            padding: '0.5rem 1rem',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}>
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        )}

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`} style={{
            marginTop: '1rem',
            padding: '0.75rem',
            borderRadius: '4px',
            background: message.includes('success') ? '#d4edda' : '#f8d7da',
            color: message.includes('success') ? '#155724' : '#721c24',
            border: `1px solid ${message.includes('success') ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
};

export default RatingSystem;