const pool = require('../config/database');

const complaintController = {
  createComplaint: async (req, res) => {
    try {
      const { title, description, complaint_against_id, complaint_type, priority } = req.body;

      // Enhanced validation
      if (!title || !description || !complaint_against_id) {
        return res.status(400).json({ 
          message: 'Title, description, and complaint target are required',
          details: {
            title: !title ? 'Title is required' : null,
            description: !description ? 'Description is required' : null,
            complaint_against_id: !complaint_against_id ? 'Complaint target is required' : null
          }
        });
      }

      // Check if user is complaining against themselves
      if (parseInt(complaint_against_id) === req.user.id) {
        return res.status(400).json({ message: 'You cannot file a complaint against yourself' });
      }

      // Check if target user exists
      const targetUser = await pool.query('SELECT role, name FROM users WHERE id = $1', [complaint_against_id]);
      if (!targetUser.rows[0]) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const complaintData = {
        title: title.trim(),
        description: description.trim(),
        complainant_id: req.user.id,
        complaint_against_id,
        complaint_type: complaint_type || determineComplaintType(req.user.role, targetUser.rows[0].role),
        priority: priority || 'medium',
        status: 'pending'
      };

      // Insert complaint
      const result = await pool.query(`
        INSERT INTO complaints (title, description, complainant_id, complaint_against_id, complaint_type, priority, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        complaintData.title,
        complaintData.description,
        complaintData.complainant_id,
        complaintData.complaint_against_id,
        complaintData.complaint_type,
        complaintData.priority,
        complaintData.status
      ]);

      const complaint = result.rows[0];
      
      res.status(201).json({ 
        message: 'Complaint filed successfully. You will receive feedback soon.', 
        complaint 
      });
    } catch (error) {
      console.error('Error creating complaint:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getMyComplaints: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          c.*,
          u.name as complaint_against_name,
          u.role as complaint_against_role
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

  getComplaintsForMe: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          c.*,
          u.name as complainant_name,
          u.role as complainant_role
        FROM complaints c
        LEFT JOIN users u ON c.complainant_id = u.id
        WHERE c.complaint_against_id = $1
        ORDER BY c.created_at DESC
      `, [req.user.id]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching complaints for response:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getAllComplaints: async (req, res) => {
    try {
      // Only allow PL, PRL, and FMG to see all complaints
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const result = await pool.query(`
        SELECT 
          c.*,
          comp.name as complainant_name,
          comp.role as complainant_role,
          against.name as complaint_against_name,
          against.role as complaint_against_role
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

  respondToComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (!response || !response.trim()) {
        return res.status(400).json({ message: 'Response is required' });
      }

      // Check if complaint exists and user is authorized to respond
      const complaintCheck = await pool.query(`
        SELECT * FROM complaints WHERE id = $1
      `, [id]);

      if (complaintCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      const complaint = complaintCheck.rows[0];
      
      // Check if user is the one being complained against or has admin rights
      if (complaint.complaint_against_id !== req.user.id && !['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to respond to this complaint' });
      }

      const result = await pool.query(`
        UPDATE complaints 
        SET response = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP, status = 'resolved'
        WHERE id = $3
        RETURNING *
      `, [response.trim(), req.user.id, id]);

      const updatedComplaint = result.rows[0];
      
      res.json({ 
        message: 'Response submitted successfully.', 
        complaint: updatedComplaint 
      });
    } catch (error) {
      console.error('Error responding to complaint:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  updateComplaintStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      // Only allow PL, PRL, FMG to update status
      if (!['pl', 'prl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to update complaint status' });
      }

      const result = await pool.query(`
        UPDATE complaints 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      res.json({ 
        message: 'Complaint status updated successfully', 
        complaint: result.rows[0] 
      });
    } catch (error) {
      console.error('Error updating complaint status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  downloadMyComplaints: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          c.*,
          u.name as complaint_against_name
        FROM complaints c
        LEFT JOIN users u ON c.complaint_against_id = u.id
        WHERE c.complainant_id = $1
        ORDER BY c.created_at DESC
      `, [req.user.id]);
      
      const complaints = result.rows;
      const csvData = convertComplaintsToCSV(complaints);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=my-complaints.csv');
      res.send(csvData);
    } catch (error) {
      console.error('Error downloading complaints:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // NEW: Generate complaint report
  generateComplaintReport: async (req, res) => {
    try {
      const { report_type, startDate, endDate, status, priority } = req.body;

      let query = `
        SELECT 
          c.*,
          comp.name as complainant_name,
          against.name as complaint_against_name
        FROM complaints c
        LEFT JOIN users comp ON c.complainant_id = comp.id
        LEFT JOIN users against ON c.complaint_against_id = against.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND c.created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND c.created_at <= $${paramCount}`;
        params.push(endDate);
      }

      if (status) {
        paramCount++;
        query += ` AND c.status = $${paramCount}`;
        params.push(status);
      }

      if (priority) {
        paramCount++;
        query += ` AND c.priority = $${paramCount}`;
        params.push(priority);
      }

      query += ' ORDER BY c.created_at DESC';

      const result = await pool.query(query, params);
      const complaints = result.rows;

      const csvData = convertComplaintsToCSV(complaints);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=complaints-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating complaint report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // NEW: Get complaint statistics
  getComplaintStatistics: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          status,
          priority,
          COUNT(*) as count,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM complaints) as percentage
        FROM complaints 
        GROUP BY status, priority
        ORDER BY status, priority
      `);

      const total = await pool.query('SELECT COUNT(*) as total FROM complaints');
      const pending = await pool.query('SELECT COUNT(*) as pending FROM complaints WHERE status = $1', ['pending']);
      const resolved = await pool.query('SELECT COUNT(*) as resolved FROM complaints WHERE status = $1', ['resolved']);

      res.json({
        total: parseInt(total.rows[0].total),
        pending: parseInt(pending.rows[0].pending),
        resolved: parseInt(resolved.rows[0].resolved),
        breakdown: result.rows
      });
    } catch (error) {
      console.error('Error fetching complaint statistics:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Helper function to determine complaint type based on roles
function determineComplaintType(complainantRole, targetRole) {
  const complaintTypes = {
    'student_lecturer': ['student', 'lecturer'],
    'lecturer_prl': ['lecturer', 'prl'],
    'prl_pl': ['prl', 'pl'],
    'pl_fmg': ['pl', 'fmg']
  };

  for (const [type, roles] of Object.entries(complaintTypes)) {
    if (roles.includes(complainantRole) && roles.includes(targetRole)) {
      return type;
    }
  }

  return 'student_lecturer'; // default
}

// Helper function to convert complaints to CSV
function convertComplaintsToCSV(complaints) {
  const headers = ['Title', 'Against', 'Type', 'Priority', 'Status', 'Date Filed', 'Response', 'Response Date'];
  const csvRows = [headers.join(',')];
  
  for (const complaint of complaints) {
    const row = [
      `"${complaint.title.replace(/"/g, '""')}"`,
      complaint.complaint_against_name,
      complaint.complaint_type,
      complaint.priority,
      complaint.status,
      new Date(complaint.created_at).toLocaleDateString(),
      complaint.response ? `"${complaint.response.replace(/"/g, '""')}"` : 'No response yet',
      complaint.responded_at ? new Date(complaint.responded_at).toLocaleDateString() : 'Not responded'
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = complaintController;