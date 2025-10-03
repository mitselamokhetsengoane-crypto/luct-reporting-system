const Complaint = require('../models/Complaint');
const pool = require('../config/database');

const complaintController = {
  createComplaint: async (req, res) => {
    try {
      const { title, description, complaint_against_id, complaint_type } = req.body;

      // Validate required fields
      if (!title || !description || !complaint_against_id) {
        return res.status(400).json({ message: 'Title, description, and complaint target are required' });
      }

      // Check if user is complaining against themselves
      if (parseInt(complaint_against_id) === req.user.id) {
        return res.status(400).json({ message: 'You cannot file a complaint against yourself' });
      }

      // Determine complaint type based on user roles
      const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [complaint_against_id]);
      if (!targetUser.rows[0]) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const complaintData = {
        title,
        description,
        complainant_id: req.user.id,
        complaint_against_id,
        complaint_type: determineComplaintType(req.user.role, targetUser.rows[0].role)
      };

      const complaint = await Complaint.create(complaintData);
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
      const complaints = await Complaint.findByComplainant(req.user.id);
      res.json(complaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getComplaintsForMe: async (req, res) => {
    try {
      const complaints = await Complaint.findByRespondent(req.user.id);
      res.json(complaints);
    } catch (error) {
      console.error('Error fetching complaints for response:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  respondToComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (!response) {
        return res.status(400).json({ message: 'Response is required' });
      }

      const complaint = await Complaint.respond(id, req.user.id, response);
      
      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      res.json({ 
        message: 'Response submitted successfully. The complainant has been notified.', 
        complaint 
      });
    } catch (error) {
      console.error('Error responding to complaint:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Download complaints data
  downloadMyComplaints: async (req, res) => {
    try {
      const complaints = await Complaint.findByComplainant(req.user.id);
      
      const csvData = convertComplaintsToCSV(complaints);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=my-complaints.csv');
      res.send(csvData);
    } catch (error) {
      console.error('Error downloading complaints:', error);
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
  const headers = ['Title', 'Against', 'Date Filed', 'Status', 'Response', 'Response Date'];
  const csvRows = [headers.join(',')];
  
  for (const complaint of complaints) {
    const row = [
      `"${complaint.title.replace(/"/g, '""')}"`,
      complaint.complaint_against_name,
      new Date(complaint.created_at).toLocaleDateString(),
      complaint.status,
      complaint.response ? `"${complaint.response.replace(/"/g, '""')}"` : 'No response yet',
      complaint.responded_at ? new Date(complaint.responded_at).toLocaleDateString() : 'Not responded'
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = complaintController;