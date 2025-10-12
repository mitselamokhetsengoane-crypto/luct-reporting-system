const pool = require('../config/database');

class Report {
  static async create(reportData) {
    const {
      faculty, class_id, week_number, date_of_lecture, course_id,
      lecturer_id, students_present, venue, scheduled_time, topic_taught,
      learning_outcomes, recommendations
    } = reportData;

    const result = await pool.query(
      `INSERT INTO reports (
        faculty, class_id, week_number, date_of_lecture, course_id,
        lecturer_id, students_present, venue, scheduled_time, topic_taught,
        learning_outcomes, recommendations, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending_student')
      RETURNING *`,
      [
        faculty, class_id, week_number, date_of_lecture, course_id,
        lecturer_id, students_present, venue, scheduled_time, topic_taught,
        learning_outcomes, recommendations
      ]
    );
    return result.rows[0];
  }

  static async findByLecturer(lecturerId) {
    const result = await pool.query(`
      SELECT r.*, c.course_name, cl.class_name, u.name as lecturer_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN classes cl ON r.class_id = cl.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.lecturer_id = $1
      ORDER BY r.created_at DESC
    `, [lecturerId]);
    return result.rows;
  }

  static async findByClass(classId) {
    const result = await pool.query(`
      SELECT r.*, c.course_name, u.name as lecturer_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.class_id = $1
      ORDER BY r.created_at DESC
    `, [classId]);
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT r.*, c.course_name, cl.class_name, u.name as lecturer_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN classes cl ON r.class_id = cl.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async updateStatus(id, status, signature = null) {
    let query, params;
    
    if (signature) {
      query = `
        UPDATE reports 
        SET status = $1, signed_at = CURRENT_TIMESTAMP, student_signature = $2
        WHERE id = $3
        RETURNING *
      `;
      params = [status, signature, id];
    } else {
      query = `
        UPDATE reports 
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      params = [status, id];
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async findPendingApproval(faculty = null) {
    let query = `
      SELECT r.*, c.course_name, cl.class_name, u.name as lecturer_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN classes cl ON r.class_id = cl.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.status IN ('pending_prl', 'pending_student')
    `;
    const params = [];

    if (faculty) {
      query += ' AND r.faculty = $1';
      params.push(faculty);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // NEW: Generate performance report
  static async generatePerformanceReport(filters) {
    const { startDate, endDate, faculty, course_id } = filters;
    
    let query = `
      SELECT 
        r.*,
        c.course_name,
        cl.class_name,
        u.name as lecturer_name,
        AVG(rt.rating_value) as average_rating,
        COUNT(rt.id) as rating_count
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN classes cl ON r.class_id = cl.id
      JOIN users u ON r.lecturer_id = u.id
      LEFT JOIN ratings rt ON r.id = rt.report_id
      WHERE r.status = 'approved'
    `;
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      query += ` AND r.date_of_lecture >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND r.date_of_lecture <= $${paramCount}`;
      params.push(endDate);
    }

    if (faculty) {
      paramCount++;
      query += ` AND r.faculty = $${paramCount}`;
      params.push(faculty);
    }

    if (course_id) {
      paramCount++;
      query += ` AND r.course_id = $${paramCount}`;
      params.push(course_id);
    }

    query += ' GROUP BY r.id, c.course_name, cl.class_name, u.name ORDER BY r.date_of_lecture DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // NEW: Generate attendance report
  static async generateAttendanceReport(filters) {
    const { startDate, endDate, faculty, class_id } = filters;
    
    let query = `
      SELECT 
        r.week_number,
        r.date_of_lecture,
        c.course_name,
        cl.class_name,
        u.name as lecturer_name,
        r.students_present,
        r.faculty
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN classes cl ON r.class_id = cl.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.status = 'approved'
    `;
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      query += ` AND r.date_of_lecture >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND r.date_of_lecture <= $${paramCount}`;
      params.push(endDate);
    }

    if (faculty) {
      paramCount++;
      query += ` AND r.faculty = $${paramCount}`;
      params.push(faculty);
    }

    if (class_id) {
      paramCount++;
      query += ` AND r.class_id = $${paramCount}`;
      params.push(class_id);
    }

    query += ' ORDER BY r.date_of_lecture, r.week_number';

    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = Report;