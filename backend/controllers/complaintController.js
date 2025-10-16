const pool = require('../config/database');

const complaintController = {
  // ✅ FIXED: Get available users for complaints - aligned with your schema
  getAvailableUsers: async (req, res) => {
    try {
      console.log('Fetching available users for complaints for user:', req.user.id, 'Role:', req.user.role);
      
      // Get all users except the current user (no status column in your schema)
      const result = await pool.query(`
        SELECT id, name, role, faculty, email
        FROM users 
        WHERE id != $1 
        ORDER BY 
          CASE 
            WHEN role = 'fmg' THEN 1
            WHEN role = 'pl' THEN 2
            WHEN role = 'prl' THEN 3
            WHEN role = 'lecturer' THEN 4
            WHEN role = 'student' THEN 5
            ELSE 6
          END,
          name ASC
      `, [req.user.id]);

      console.log(`Found ${result.rows.length} users available for complaints`);
      
      res.json({
        success: true,
        users: result.rows
      });
    } catch (error) {
      console.error('Error fetching available users:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while fetching users', 
        error: error.message 
      });
    }
  },

  // ✅ Create complaint - aligned with your schema
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
          success: false,
          message: 'Title, description, and complaint target are required'
        });
      }

      if (title.trim().length < 5) {
        return res.status(400).json({ 
          success: false,
          message: 'Title must be at least 5 characters long' 
        });
      }

      if (description.trim().length < 10) {
        return res.status(400).json({ 
          success: false,
          message: 'Description must be at least 10 characters long' 
        });
      }

      // Prevent self-complaints
      if (parseInt(complaint_against_id) === req.user.id) {
        return res.status(400).json({ 
          success: false,
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
          success: false,
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
          finalComplaintType = 'student_lecturer';
        } else if (userRole === 'lecturer' && ['prl', 'pl', 'fmg'].includes(targetRole)) {
          finalComplaintType = 'lecturer_prl';
        } else if (userRole === 'prl' && targetRole === 'pl') {
          finalComplaintType = 'prl_pl';
        } else if (userRole === 'pl' && targetRole === 'fmg') {
          finalComplaintType = 'pl_fmg';
        } else {
          finalComplaintType = 'student_lecturer';
        }
      }

      // Validate complaint type against existing schema
      const validTypes = ['student_lecturer', 'lecturer_prl', 'prl_pl', 'pl_fmg'];
      if (!validTypes.includes(finalComplaintType)) {
        return res.status(400).json({ 
          success: false,
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
        success: true,
        message: 'Complaint filed successfully.',
        complaint: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating complaint:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while creating complaint', 
        error: error.message 
      });
    }
  },

  // ✅ Fetch all complaints created by this user
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
        query += ` AND c.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(parseInt(limit), offset);

      const result = await pool.query(query, queryParams);

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) FROM complaints WHERE complainant_id = $1`;
      const countParams = [req.user.id];
      if (status) {
        countQuery += ` AND status = $2`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
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
        success: false,
        message: 'Server error while fetching complaints', 
        error: error.message 
      });
    }
  },

  // ✅ Fetch complaints made against this user
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
        query += ` AND c.status = $${queryParams.length + 1}`;
        queryParams.push(status);
        query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(parseInt(limit), offset);
      } else {
        query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
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
        success: true,
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
        success: false,
        message: 'Server error while fetching complaints', 
        error: error.message 
      });
    }
  },

  // ✅ Generate complaint report - uses existing tables only
  generateComplaintReport: async (req, res) => {
    try {
      const { startDate, endDate, status, complaint_type } = req.body;
      
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied. Only PL, PRL, and FMG can generate complaint reports.' 
        });
      }

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
      if (startDate) {
        paramCount++;
        query += ` AND c.created_at >= $${paramCount}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND c.created_at <= $${paramCount}`;
        queryParams.push(endDate);
      }

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

      // Add faculty filter for PL and PRL
      if (req.user.faculty && ['pl', 'prl'].includes(req.user.role)) {
        paramCount++;
        query += ` AND comp.faculty = $${paramCount}`;
        queryParams.push(req.user.faculty);
      }

      query += ` ORDER BY c.created_at DESC`;

      const result = await pool.query(query, queryParams);

      // Convert to CSV
      const csvData = convertComplaintsToCSV(result.rows);
      
      const fileName = `complaint-report-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating complaint report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while generating complaint report', 
        error: error.message 
      });
    }
  },

  // ✅ Get user's generated reports from existing reports table
  getGeneratedReports: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      // Use existing reports table to track generated reports
      const result = await pool.query(`
        SELECT 
          r.*,
          c.course_name,
          cl.class_name,
          u.name as lecturer_name,
          'lecture_report' as report_type,
          'Lecture Report' as report_name
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN classes cl ON r.class_id = cl.id
        JOIN users u ON r.lecturer_id = u.id
        WHERE r.lecturer_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `, [req.user.id, parseInt(limit), offset]);

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1',
        [req.user.id]
      );
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        reports: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching generated reports:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while fetching generated reports', 
        error: error.message 
      });
    }
  }
};

// CSV Conversion Function for Complaints
function convertComplaintsToCSV(complaints) {
  const headers = ['ID', 'Title', 'Description', 'Complainant', 'Complaint Against', 'Type', 'Status', 'Created Date', 'Response'];
  const csvRows = [headers.join(',')];
  
  for (const complaint of complaints) {
    const row = [
      complaint.id,
      `"${complaint.title.replace(/"/g, '""')}"`,
      `"${complaint.description.replace(/"/g, '""')}"`,
      `"${complaint.complainant_name} (${complaint.complainant_role})"`,
      `"${complaint.complaint_against_name} (${complaint.complaint_against_role})"`,
      complaint.complaint_type,
      complaint.status,
      new Date(complaint.created_at).toISOString().split('T')[0],
      `"${(complaint.response || 'No response').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = complaintController;