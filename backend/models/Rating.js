const db = require('../config/database');

class Rating {
  // Create a new rating
  static async create(ratingData) {
    const { user_id, report_id, lecturer_id, rating_value, comment, rating_type } = ratingData;
    
    const query = `
      INSERT INTO ratings (user_id, report_id, lecturer_id, rating_value, comment, rating_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [user_id, report_id, lecturer_id, rating_value, comment, rating_type];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Find ratings by lecturer with proper joins
  static async findByLecturer(lecturerId) {
    const query = `
      SELECT 
        r.*,
        u.name as user_name,
        rep.week_number,
        rep.date_of_lecture,
        c.course_name,
        c.course_code,
        rep.department_name
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN reports rep ON r.report_id = rep.id
      LEFT JOIN courses c ON rep.course_id = c.id
      WHERE r.lecturer_id = $1
      ORDER BY r.created_at DESC
    `;
    
    const result = await db.query(query, [lecturerId]);
    return result.rows;
  }

  // Find ratings by user with proper joins
  static async findByUser(userId) {
    const query = `
      SELECT 
        r.*,
        u.name as lecturer_name,
        rep.week_number,
        rep.date_of_lecture,
        c.course_name,
        c.course_code,
        rep.department_name
      FROM ratings r
      LEFT JOIN users u ON r.lecturer_id = u.id
      LEFT JOIN reports rep ON r.report_id = rep.id
      LEFT JOIN courses c ON rep.course_id = c.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // Find ratings for a specific report
  static async findByReport(reportId) {
    const query = `
      SELECT 
        r.*,
        u.name as user_name
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.report_id = $1
      ORDER BY r.created_at DESC
    `;
    
    const result = await db.query(query, [reportId]);
    return result.rows;
  }

  // Calculate average rating for a lecturer
  static async getAverageRating(lecturerId) {
    const query = `
      SELECT 
        AVG(rating_value) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings 
      WHERE lecturer_id = $1
    `;
    
    const result = await db.query(query, [lecturerId]);
    return result.rows[0];
  }

  // Check if user has already rated a report
  static async hasUserRatedReport(userId, reportId) {
    const query = `
      SELECT COUNT(*) as count 
      FROM ratings 
      WHERE user_id = $1 AND report_id = $2
    `;
    
    const result = await db.query(query, [userId, reportId]);
    return result.rows[0].count > 0;
  }

  // Update a rating
  static async update(ratingId, ratingData) {
    const { rating_value, comment, rating_type } = ratingData;
    
    const query = `
      UPDATE ratings 
      SET rating_value = $1, comment = $2, rating_type = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const values = [rating_value, comment, rating_type, ratingId];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Delete a rating
  static async delete(ratingId) {
    const query = 'DELETE FROM ratings WHERE id = $1 RETURNING *';
    const result = await db.query(query, [ratingId]);
    return result.rows[0];
  }

  // Get rating by ID
  static async findById(ratingId) {
    const query = `
      SELECT 
        r.*,
        u.name as user_name,
        rep.week_number,
        rep.date_of_lecture,
        c.course_name
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN reports rep ON r.report_id = rep.id
      LEFT JOIN courses c ON rep.course_id = c.id
      WHERE r.id = $1
    `;
    
    const result = await db.query(query, [ratingId]);
    return result.rows[0];
  }
}

module.exports = Rating;