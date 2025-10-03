const pool = require('../config/database');

class Course {
  static async findAll() {
    const result = await pool.query('SELECT * FROM courses ORDER BY course_name');
    return result.rows;
  }

  static async create(courseData) {
    const { course_name, course_code, faculty, program_leader_id } = courseData;
    const result = await pool.query(
      'INSERT INTO courses (course_name, course_code, faculty, program_leader_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [course_name, course_code, faculty, program_leader_id]
    );
    return result.rows[0];
  }
}

module.exports = Course;