const pool = require('../config/database');

class User {
  static async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async create(userData) {
    const { name, email, password, role, faculty, class_id } = userData;
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, faculty, class_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, email, password, role, faculty, class_id]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async getStudents() {
    const result = await pool.query('SELECT * FROM users WHERE role = $1', ['student']);
    return result.rows;
  }

  static async getLecturers() {
    const result = await pool.query('SELECT * FROM users WHERE role IN ($1, $2)', ['lecturer', 'prl', 'pl']);
    return result.rows;
  }
}

module.exports = User;