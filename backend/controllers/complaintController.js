const pool = require('../config/database');

const complaintController = {
  // ✅ Allow ANY user to create a complaint with enhanced validation
  createComplaint: async (req, res) => {
    try {
      const { 
        title, 
        description, 
        complaint_against_id, 
        complaint_type 
      } = req.body;

      // Enhanced validation
      if (!title?.trim() || !description?.trim() || !complaint_against_id) {
        return res.status(400).json({ 
          message: 'Title, description, and complaint target are required'
        });
      }

      if (title.trim().length < 5) {
        return res.status(400).json({ 
          message: 'Title must be at least 5 characters long' 
        });
      }

      if (description.trim().length < 10) {
        return res.status(400).json({ 
          message: 'Description must be at least 10 characters long' 
        });
      }

      // Prevent self-complaints
      if (parseInt(complaint_against_id) === req.user.id) {
        return res.status(400).json({ 
          message: 'You cannot file a complaint against yourself' 
        });
      }

      // Ensure the target user exists
      const targetUser = await pool.query(
        'SELECT id, role, name FROM users WHERE id = $1', 
        [complaint_against_id]
      );
      
      if (!targetUser.rows.length) {
        return res.status(404).json({ 
          message: 'Target user not found' 
        });
      }

      // Determine complaint type based on roles if not provided
      let finalComplaintType = complaint_type;
      if (!finalComplaintType) {
        const userRole = req.user.role;
        const targetRole = targetUser.rows[0].role;
        
        // Generate complaint type based on user roles
        if (userRole === 'student' && targetRole === 'lecturer') {
          finalComplaintType = 'student_lecturer';
        } else if (userRole === 'lecturer' && targetRole === 'student') {
          finalComplaintType = 'student_lecturer';
        } else if (userRole === 'student' && ['prl', 'pl', 'fmg'].includes(targetRole)) {
          finalComplaintType = 'student_lecturer'; // Use existing type
        } else if (userRole === 'lecturer' && ['prl', 'pl', 'fmg'].includes(targetRole)) {
          finalComplaintType = 'lecturer_prl';
        } else if (userRole === 'prl' && targetRole === 'pl') {
          finalComplaintType = 'prl_pl';
        } else if (userRole === 'pl' && targetRole === 'fmg') {
          finalComplaintType = 'pl_fmg';
        } else {
          // Default fallback
          finalComplaintType = 'student_lecturer';
        }
      }

      // Validate complaint type against existing schema
      const validTypes = ['student_lecturer', 'lecturer_prl', 'prl_pl', 'pl_fmg'];
      if (!validTypes.includes(finalComplaintType)) {
        return res.status(400).json({ 
          message: 'Invalid complaint type'
        });
      }

      const result = await pool.query(`
        INSERT INTO complaints 
          (title, description, complainant_id, complaint_against_id, complaint_type, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `, [
        title.trim(), 
        description.trim(), 
        req.user.id, 
        complaint_against_id, 
        finalComplaintType
      ]);

      res.status(201).json({
        message: 'Complaint filed successfully.',
        complaint: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating complaint:', error);
      res.status(500).json({ 
        message: 'Server error while creating complaint', 
        error: error.message 
      });
    }
  },

  // ✅ Fetch all complaints created by this user with pagination
  getMyComplaints: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.*, 
          u.name AS complaint_against_name, 
          u.role AS complaint_against_role
        FROM complaints c
        LEFT JOIN users u ON c.complaint_against_id = u.id
        WHERE c.complainant_id = $1
      `;
      
      const queryParams = [req.user.id];

      if (status) {
        query += ` AND c.status = $2`;
        queryParams.push(status);
        query += ` ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`;
        queryParams.push(parseInt(limit), offset);
      } else {
        query += ` ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`;
        queryParams.push(parseInt(limit), offset);
      }

      const result = await pool.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) FROM complaints WHERE complainant_id = $1`;
      const countParams = [req.user.id];
      if (status) {
        countQuery += ` AND status = $2`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        complaints: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({ 
        message: 'Server error while fetching complaints', 
        error: error.message 
      });
    }
  },

  // ✅ Fetch complaints made *against* this user
  getComplaintsForMe: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.*, 
          u.name AS complainant_name, 
          u.role AS complainant_role
        FROM complaints c
        LEFT JOIN users u ON c.complainant_id = u.id
        WHERE c.complaint_against_id = $1
      `;
      
      const queryParams = [req.user.id];

      if (status) {
        query += ` AND c.status = $2`;
        queryParams.push(status);
        query += ` ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`;
        queryParams.push(parseInt(limit), offset);
      } else {
        query += ` ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`;
        queryParams.push(parseInt(limit), offset);
      }

      const result = await pool.query(query, queryParams);

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM complaints WHERE complaint_against_id = $1`;
      const countParams = [req.user.id];
      if (status) {
        countQuery += ` AND status = $2`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        complaints: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching complaints for me:', error);
      res.status(500).json({ 
        message: 'Server error while fetching complaints', 
        error: error.message 
      });
    }
  },

  // ✅ Only PL, PRL, FMG can see all complaints with filters
  getAllComplaints: async (req, res) => {
    try {
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          message: 'Access denied. Only PL, PRL, and FMG can view all complaints.' 
        });
      }

      const { page = 1, limit = 10, status, complaint_type } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.*, 
          comp.name AS complainant_name,
          comp.role AS complainant_role,
          against.name AS complaint_against_name,
          against.role AS complaint_against_role
        FROM complaints c
        LEFT JOIN users comp ON c.complainant_id = comp.id
        LEFT JOIN users against ON c.complaint_against_id = against.id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramCount = 0;

      // Add filters
      if (status) {
        paramCount++;
        query += ` AND c.status = $${paramCount}`;
        queryParams.push(status);
      }

      if (complaint_type) {
        paramCount++;
        query += ` AND c.complaint_type = $${paramCount}`;
        queryParams.push(complaint_type);
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      queryParams.push(parseInt(limit), offset);

      const result = await pool.query(query, queryParams);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM complaints WHERE 1=1`;
      const countParams = [];
      let countParamCount = 0;

      if (status) {
        countParamCount++;
        countQuery += ` AND status = $${countParamCount}`;
        countParams.push(status);
      }

      if (complaint_type) {
        countParamCount++;
        countQuery += ` AND complaint_type = $${countParamCount}`;
        countParams.push(complaint_type);
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        complaints: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching all complaints:', error);
      res.status(500).json({ 
        message: 'Server error while fetching complaints', 
        error: error.message 
      });
    }
  },

  // ✅ Get specific complaint by ID
  getComplaintById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT 
          c.*,
          comp.name AS complainant_name,
          comp.role AS complainant_role,
          against.name AS complaint_against_name,
          against.role AS complaint_against_role,
          responder.name AS responder_name
        FROM complaints c
        LEFT JOIN users comp ON c.complainant_id = comp.id
        LEFT JOIN users against ON c.complaint_against_id = against.id
        LEFT JOIN users responder ON c.responded_by = responder.id
        WHERE c.id = $1
      `, [id]);

      if (!result.rows.length) {
        return res.status(404).json({ 
          message: 'Complaint not found' 
        });
      }

      const complaint = result.rows[0];

      // Check if user has permission to view this complaint
      const canView = complaint.complainant_id === req.user.id || 
                     complaint.complaint_against_id === req.user.id || 
                     ['pl', 'prl', 'fmg'].includes(req.user.role);

      if (!canView) {
        return res.status(403).json({ 
          message: 'Access denied to this complaint' 
        });
      }

      // Get feedback for this complaint
      const feedbackResult = await pool.query(`
        SELECT f.*, u.name as responder_name
        FROM feedback f
        LEFT JOIN users u ON f.responded_by = u.id
        WHERE f.complaint_id = $1
        ORDER BY f.created_at ASC
      `, [id]);

      res.json({
        complaint: complaint,
        feedback: feedbackResult.rows
      });
    } catch (error) {
      console.error('Error fetching complaint:', error);
      res.status(500).json({ 
        message: 'Server error while fetching complaint', 
        error: error.message 
      });
    }
  },

  // ✅ Respond to a complaint (only if you're involved or have higher role)
  respondToComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (!response?.trim()) {
        return res.status(400).json({ 
          message: 'Response text is required' 
        });
      }

      const complaintCheck = await pool.query(
        'SELECT * FROM complaints WHERE id = $1', 
        [id]
      );
      
      if (!complaintCheck.rows.length) {
        return res.status(404).json({ 
          message: 'Complaint not found' 
        });
      }

      const complaint = complaintCheck.rows[0];

      // Check authorization: target user or admin roles can respond
      const canRespond = complaint.complaint_against_id === req.user.id || 
                        ['pl', 'prl', 'fmg'].includes(req.user.role);

      if (!canRespond) {
        return res.status(403).json({ 
          message: 'Not authorized to respond to this complaint' 
        });
      }

      const result = await pool.query(`
        UPDATE complaints
        SET response = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, status = 'resolved'
        WHERE id = $3
        RETURNING *
      `, [response.trim(), req.user.id, id]);

      res.json({ 
        message: 'Response submitted successfully.', 
        complaint: result.rows[0] 
      });
    } catch (error) {
      console.error('Error responding to complaint:', error);
      res.status(500).json({ 
        message: 'Server error while responding to complaint', 
        error: error.message 
      });
    }
  },

  // ✅ Update complaint status (admin only)
  updateComplaintStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'reviewed', 'resolved', 'rejected'].includes(status)) {
        return res.status(400).json({ 
          message: 'Invalid status value' 
        });
      }

      // Only admin roles can update status
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          message: 'Access denied. Only admin roles can update complaint status.' 
        });
      }

      const complaintCheck = await pool.query(
        'SELECT * FROM complaints WHERE id = $1', 
        [id]
      );
      
      if (!complaintCheck.rows.length) {
        return res.status(404).json({ 
          message: 'Complaint not found' 
        });
      }

      const result = await pool.query(`
        UPDATE complaints
        SET status = $1
        WHERE id = $2
        RETURNING *
      `, [status, id]);

      res.json({ 
        message: 'Complaint status updated successfully.', 
        complaint: result.rows[0] 
      });
    } catch (error) {
      console.error('Error updating complaint status:', error);
      res.status(500).json({ 
        message: 'Server error while updating complaint status', 
        error: error.message 
      });
    }
  },

  // ✅ Add feedback to complaint (for involved parties)
  addFeedback: async (req, res) => {
    try {
      const { id } = req.params;
      const { response_text } = req.body;

      if (!response_text?.trim()) {
        return res.status(400).json({ 
          message: 'Feedback text is required' 
        });
      }

      const complaintCheck = await pool.query(
        'SELECT * FROM complaints WHERE id = $1', 
        [id]
      );
      
      if (!complaintCheck.rows.length) {
        return res.status(404).json({ 
          message: 'Complaint not found' 
        });
      }

      const complaint = complaintCheck.rows[0];

      // Check if user is involved in the complaint
      const isInvolved = complaint.complainant_id === req.user.id || 
                        complaint.complaint_against_id === req.user.id ||
                        ['pl', 'prl', 'fmg'].includes(req.user.role);

      if (!isInvolved) {
        return res.status(403).json({ 
          message: 'Not authorized to add feedback to this complaint' 
        });
      }

      const result = await pool.query(`
        INSERT INTO feedback (complaint_id, response_text, responded_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [id, response_text.trim(), req.user.id]);

      res.status(201).json({ 
        message: 'Feedback added successfully.', 
        feedback: result.rows[0] 
      });
    } catch (error) {
      console.error('Error adding feedback:', error);
      res.status(500).json({ 
        message: 'Server error while adding feedback', 
        error: error.message 
      });
    }
  }
};

module.exports = complaintController;