const pool = require('../config/database');

class Complaint {
  static async create(complaintData) {
    const { title, description, complaint_against_id, complaint_type } = complaintData;
    
    const result = await pool.query(
      `INSERT INTO complaints (title, description, complainant_id, complaint_against_id, complaint_type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description, complaintData.complainant_id, complaint_against_id, complaint_type]
    );
    return result.rows[0];
  }

  static async findByComplainant(complainantId) {
    const result = await pool.query(`
      SELECT c.*, u.name as complaint_against_name 
      FROM complaints c 
      JOIN users u ON c.complaint_against_id = u.id 
      WHERE c.complainant_id = $1 
      ORDER BY c.created_at DESC
    `, [complainantId]);
    return result.rows;
  }

  static async findByRespondent(respondentId) {
    const result = await pool.query(`
      SELECT c.*, u.name as complainant_name 
      FROM complaints c 
      JOIN users u ON c.complainant_id = u.id 
      WHERE c.complaint_against_id = $1 
      ORDER BY c.created_at DESC
    `, [respondentId]);
    return result.rows;
  }

  static async respond(complaintId, respondentId, response) {
    const result = await pool.query(
      `UPDATE complaints SET response = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, status = 'resolved' 
       WHERE id = $3 RETURNING *`,
      [response, respondentId, complaintId]
    );
    return result.rows[0];
  }
}

module.exports = Complaint;