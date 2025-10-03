const Report = require('../models/Report');
const pool = require('../config/database');

const reportController = {
  createReport: async (req, res) => {
    try {
      const {
        faculty, class_id, week_number, date_of_lecture, course_id,
        students_present, venue, scheduled_time, topic_taught,
        learning_outcomes, recommendations
      } = req.body;

      // Validate required fields
      if (!faculty || !class_id || !week_number || !date_of_lecture || !course_id || 
          !students_present || !venue || !scheduled_time || !topic_taught || !learning_outcomes) {
        return res.status(400).json({ message: 'All required fields must be filled' });
      }

      const reportData = {
        faculty,
        class_id,
        week_number,
        date_of_lecture,
        course_id,
        lecturer_id: req.user.id,
        students_present,
        venue,
        scheduled_time,
        topic_taught,
        learning_outcomes,
        recommendations: recommendations || ''
      };

      const report = await Report.create(reportData);
      res.status(201).json({ 
        message: 'Report created successfully and sent to students for signing', 
        report 
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getMyReports: async (req, res) => {
    try {
      const reports = await Report.findByLecturer(req.user.id);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getClassReports: async (req, res) => {
    try {
      const { classId } = req.params;
      const reports = await Report.findByClass(classId);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching class reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  signReport: async (req, res) => {
    try {
      const { id } = req.params;
      const { signature } = req.body;

      if (!signature) {
        return res.status(400).json({ message: 'Signature is required' });
      }

      // First, get the report to check authorization
      const report = await Report.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      // Check if user is a student and belongs to the same class
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can sign reports' });
      }

      if (report.class_id !== req.user.class_id) {
        return res.status(403).json({ message: 'You can only sign reports for your class' });
      }

      // Check if report is in correct status for signing
      if (report.status !== 'pending_student') {
        return res.status(400).json({ message: 'Report is not available for signing' });
      }

      // Update report with signature and change status to pending_prl
      const updatedReport = await Report.updateStatus(id, 'pending_prl', signature);
      
      res.json({ 
        message: 'Report signed successfully and sent to PRL for approval', 
        report: updatedReport 
      });
    } catch (error) {
      console.error('Error signing report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  approveReport: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is PRL or PL
      if (req.user.role !== 'prl' && req.user.role !== 'pl') {
        return res.status(403).json({ message: 'Only PRL or PL can approve reports' });
      }

      // First, get the report to check status
      const report = await Report.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      // Check if report is in correct status for approval
      if (report.status !== 'pending_prl') {
        return res.status(400).json({ message: 'Report is not available for approval' });
      }

      const updatedReport = await Report.updateStatus(id, 'approved');
      
      res.json({ 
        message: 'Report approved successfully', 
        report: updatedReport 
      });
    } catch (error) {
      console.error('Error approving report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getReportById: async (req, res) => {
    try {
      const { id } = req.params;
      const report = await Report.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      res.json(report);
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Download report data
  downloadMyReports: async (req, res) => {
    try {
      const reports = await Report.findByLecturer(req.user.id);
      
      // Convert to CSV format for download
      const csvData = convertToCSV(reports);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=my-reports.csv');
      res.send(csvData);
    } catch (error) {
      console.error('Error downloading reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Add the missing method for pending approval reports
  getPendingApprovalReports: async (req, res) => {
    try {
      // Check if user is PRL or PL
      if (req.user.role !== 'prl' && req.user.role !== 'pl') {
        return res.status(403).json({ message: 'Only PRL or PL can view pending approval reports' });
      }

      const reports = await Report.findPendingApproval(req.user.faculty);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching pending approval reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Helper function to convert data to CSV
function convertToCSV(reports) {
  const headers = ['Course', 'Week', 'Date', 'Students Present', 'Topic', 'Status', 'Signed At'];
  const csvRows = [headers.join(',')];
  
  for (const report of reports) {
    const row = [
      report.course_name,
      report.week_number,
      report.date_of_lecture,
      report.students_present,
      `"${report.topic_taught.replace(/"/g, '""')}"`,
      report.status,
      report.signed_at || 'Not signed'
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = reportController;