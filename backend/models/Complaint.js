const pool = require('../config/database');

class Complaint {
  static async create(complaintData) {
    const { 
      title, 
      description, 
      complainant_id, 
      complaint_against_id, 
      complaint_type,
      priority,
      category,
      faculty 
    } = complaintData;
    
    const result = await pool.query(
      `INSERT INTO complaints 
        (title, description, complainant_id, complaint_against_id, 
         complaint_type, priority, category, faculty) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [title, description, complainant_id, complaint_against_id, 
       complaint_type, priority, category, faculty]
    );
    return result.rows[0];
  }

  static async findByComplainant(complainantId, filters = {}) {
    const { page = 1, limit = 10, status, type } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, u.name as complaint_against_name 
      FROM complaints c 
      JOIN users u ON c.complaint_against_id = u.id 
      WHERE c.complainant_id = $1 
    `;
    
    const queryParams = [complainantId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (type) {
      paramCount++;
      query += ` AND c.complaint_type = $${paramCount}`;
      queryParams.push(type);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async findByRespondent(respondentId, filters = {}) {
    const { page = 1, limit = 10, status } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, u.name as complainant_name 
      FROM complaints c 
      JOIN users u ON c.complainant_id = u.id 
      WHERE c.complaint_against_id = $1 
    `;
    
    const queryParams = [respondentId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      queryParams.push(status);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT 
        c.*,
        comp.name AS complainant_name,
        comp.role AS complainant_role,
        against.name AS complaint_against_name,
        against.role AS complaint_against_role
      FROM complaints c
      LEFT JOIN users comp ON c.complainant_id = comp.id
      LEFT JOIN users against ON c.complaint_against_id = against.id
      WHERE c.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    const { page = 1, limit = 10, status, type, faculty } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.*,
        comp.name AS complainant_name,
        against.name AS complaint_against_name
      FROM complaints c
      LEFT JOIN users comp ON c.complainant_id = comp.id
      LEFT JOIN users against ON c.complaint_against_id = against.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (type) {
      paramCount++;
      query += ` AND c.complaint_type = $${paramCount}`;
      queryParams.push(type);
    }

    if (faculty) {
      paramCount++;
      query += ` AND c.faculty = $${paramCount}`;
      queryParams.push(faculty);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async respond(complaintId, respondentId, response) {
    const result = await pool.query(
      `UPDATE complaints SET response = $1, responded_by = $2, 
       responded_at = CURRENT_TIMESTAMP, status = 'resolved' 
       WHERE id = $3 RETURNING *`,
      [response, respondentId, complaintId]
    );
    return result.rows[0];
  }

  static async updateStatus(complaintId, status) {
    const result = await pool.query(
      `UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [status, complaintId]
    );
    return result.rows[0];
  }

  static async getFeedback(complaintId) {
    const result = await pool.query(`
      SELECT f.*, u.name as responder_name
      FROM feedback f
      LEFT JOIN users u ON f.responded_by = u.id
      WHERE f.complaint_id = $1
      ORDER BY f.created_at ASC
    `, [complaintId]);
    return result.rows;
  }

  static async addFeedback(complaintId, respondentId, responseText) {
    const result = await pool.query(
      `INSERT INTO feedback (complaint_id, response_text, responded_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [complaintId, responseText, respondentId]
    );
    return result.rows[0];
  }
}

module.exports = Complaint;