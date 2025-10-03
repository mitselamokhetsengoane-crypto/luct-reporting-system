const pool = require('../config/database');

class Report {
  static async create(reportData) {
    const {
      faculty, class_id, week_number, date_of_lecture, course_id,
      lecturer_id, students_present, venue, scheduled_time,
      topic_taught, learning_outcomes, recommendations
    } = reportData;

    const result = await pool.query(
      `INSERT INTO reports (faculty, class_id, week_number, date_of_lecture, course_id, 
       lecturer_id, students_present, venue, scheduled_time, topic_taught, 
       learning_outcomes, recommendations, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending_student') RETURNING *`,
      [
        faculty, class_id, week_number, date_of_lecture, course_id,
        lecturer_id, students_present, venue, scheduled_time,
        topic_taught, learning_outcomes, recommendations
      ]
    );
    return result.rows[0];
  }

  static async findByLecturer(lecturerId) {
    const result = await pool.query(`
      SELECT r.*, c.class_name, co.course_name, co.course_code 
      FROM reports r 
      LEFT JOIN classes c ON r.class_id = c.id 
      LEFT JOIN courses co ON r.course_id = co.id 
      WHERE r.lecturer_id = $1 
      ORDER BY r.created_at DESC
    `, [lecturerId]);
    return result.rows;
  }

  static async findByClass(classId) {
    const result = await pool.query(`
      SELECT r.*, c.class_name, co.course_name, co.course_code, u.name as lecturer_name
      FROM reports r 
      LEFT JOIN classes c ON r.class_id = c.id 
      LEFT JOIN courses co ON r.course_id = co.id 
      LEFT JOIN users u ON r.lecturer_id = u.id 
      WHERE r.class_id = $1 
      ORDER BY r.created_at DESC
    `, [classId]);
    return result.rows;
  }

  static async updateStatus(reportId, status, signature = null) {
    if (signature) {
      const result = await pool.query(
        'UPDATE reports SET status = $1, student_signature = $2, signed_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [status, signature, reportId]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        'UPDATE reports SET status = $1 WHERE id = $2 RETURNING *',
        [status, reportId]
      );
      return result.rows[0];
    }
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT r.*, c.class_name, co.course_name, co.course_code, u.name as lecturer_name
      FROM reports r 
      LEFT JOIN classes c ON r.class_id = c.id 
      LEFT JOIN courses co ON r.course_id = co.id 
      LEFT JOIN users u ON r.lecturer_id = u.id 
      WHERE r.id = $1
    `, [id]);
    return result.rows[0];
  }

  // ADD THIS MISSING METHOD - This is what causes the issue
  static async findPendingApproval(faculty) {
    const result = await pool.query(`
      SELECT r.*, c.class_name, co.course_name, co.course_code, u.name as lecturer_name
      FROM reports r 
      LEFT JOIN classes c ON r.class_id = c.id 
      LEFT JOIN courses co ON r.course_id = co.id 
      LEFT JOIN users u ON r.lecturer_id = u.id 
      WHERE r.status = 'pending_prl' AND r.faculty = $1
      ORDER BY r.created_at DESC
    `, [faculty]);
    return result.rows;
  }
}

module.exports = Report;