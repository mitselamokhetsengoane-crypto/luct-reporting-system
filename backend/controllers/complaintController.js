const pool = require('../config/database');

const complaintController = {
  // ✅ Allow ANY user to create a complaint
  createComplaint: async (req, res) => {
    try {
      const { title, description, complaint_against_id, complaint_type, priority } = req.body;

      if (!title || !description || !complaint_against_id) {
        return res.status(400).json({ 
          message: 'Title, description, and complaint target are required'
        });
      }

      if (parseInt(complaint_against_id) === req.user.id) {
        return res.status(400).json({ message: 'You cannot file a complaint against yourself' });
      }

      // Ensure the target user exists
      const targetUser = await pool.query('SELECT id, role, name FROM users WHERE id = $1', [complaint_against_id]);
      if (!targetUser.rows.length) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const complaintType = complaint_type || 'student_lecturer';

      const result = await pool.query(`
        INSERT INTO complaints (title, description, complainant_id, complaint_against_id, complaint_type, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `, [title.trim(), description.trim(), req.user.id, complaint_against_id, complaintType]);

      res.status(201).json({
        message: 'Complaint filed successfully.',
        complaint: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating complaint:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // ✅ Fetch all complaints created by this user
  getMyComplaints: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*, u.name AS complaint_against_name, u.role AS complaint_against_role
        FROM complaints c
        LEFT JOIN users u ON c.complaint_against_id = u.id
        WHERE c.complainant_id = $1
        ORDER BY c.created_at DESC
      `, [req.user.id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // ✅ Fetch complaints made *against* this user
  getComplaintsForMe: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*, u.name AS complainant_name, u.role AS complainant_role
        FROM complaints c
        LEFT JOIN users u ON c.complainant_id = u.id
        WHERE c.complaint_against_id = $1
        ORDER BY c.created_at DESC
      `, [req.user.id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching complaints for me:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // ✅ Only PL, PRL, FMG can see all complaints
  getAllComplaints: async (req, res) => {
    try {
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const result = await pool.query(`
        SELECT 
          c.*, 
          comp.name AS complainant_name,
          against.name AS complaint_against_name
        FROM complaints c
        LEFT JOIN users comp ON c.complainant_id = comp.id
        LEFT JOIN users against ON c.complaint_against_id = against.id
        ORDER BY c.created_at DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching all complaints:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // ✅ Respond to a complaint (only if you’re involved or have higher role)
  respondToComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (!response?.trim()) {
        return res.status(400).json({ message: 'Response text is required' });
      }

      const complaintCheck = await pool.query('SELECT * FROM complaints WHERE id = $1', [id]);
      if (!complaintCheck.rows.length) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      const complaint = complaintCheck.rows[0];

      // Only target or PL/PRL/FMG can respond
      if (complaint.complaint_against_id !== req.user.id && !['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to respond to this complaint' });
      }

      const result = await pool.query(`
        UPDATE complaints
        SET response = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, status = 'resolved'
        WHERE id = $3
        RETURNING *
      `, [response.trim(), req.user.id, id]);

      res.json({ message: 'Response submitted successfully.', complaint: result.rows[0] });
    } catch (error) {
      console.error('Error responding to complaint:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
};

module.exports = complaintController;
