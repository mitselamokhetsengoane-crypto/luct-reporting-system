const pool = require('../config/database');
const Report = require('../models/Report');

const reportController = {
  // EXISTING FUNCTIONS - MAKE SURE THESE ARE INCLUDED
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

      const report = await Report.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can sign reports' });
      }

      if (report.class_id !== req.user.class_id) {
        return res.status(403).json({ message: 'You can only sign reports for your class' });
      }

      if (report.status !== 'pending_student') {
        return res.status(400).json({ message: 'Report is not available for signing' });
      }

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
      
      if (req.user.role !== 'prl' && req.user.role !== 'pl') {
        return res.status(403).json({ message: 'Only PRL or PL can approve reports' });
      }

      const report = await Report.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

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

  downloadMyReports: async (req, res) => {
    try {
      const reports = await Report.findByLecturer(req.user.id);
      const csvData = convertToCSV(reports);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=my-reports.csv');
      res.send(csvData);
    } catch (error) {
      console.error('Error downloading reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getPendingApprovalReports: async (req, res) => {
    try {
      if (req.user.role !== 'prl' && req.user.role !== 'pl') {
        return res.status(403).json({ message: 'Only PRL or PL can view pending approval reports' });
      }

      const reports = await Report.findPendingApproval(req.user.faculty);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching pending approval reports:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // NEW REPORT GENERATION FUNCTIONS
  generatePerformanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['lecturer', 'principal_lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate reports' });
      }

      const performanceData = await getPerformanceReportData(filters, req.user);
      const csvData = convertPerformanceToCSV(performanceData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=performance-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating performance report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  generateAttendanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['lecturer', 'principal_lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate reports' });
      }

      const attendanceData = await getAttendanceReportData(filters, req.user);
      const csvData = convertAttendanceToCSV(attendanceData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating attendance report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  generateFacultyReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['prl', 'pl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate faculty reports' });
      }

      const facultyData = await getFacultyReportData(filters, req.user);
      const csvData = convertFacultyToCSV(facultyData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=faculty-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating faculty report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getReportStatistics: async (req, res) => {
    try {
      const { userId } = req.params;
      const statistics = await getReportStatisticsData(userId);
      res.json(statistics);
    } catch (error) {
      console.error('Error fetching report statistics:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Database query functions (keep the ones you already have)
async function getPerformanceReportData(filters, user) {
  const { startDate, endDate, faculty, course_id, class_id } = filters;
  
  let query = `
    SELECT 
      r.id,
      r.week_number,
      r.date_of_lecture,
      r.students_present,
      r.faculty,
      c.course_name,
      cl.class_name,
      u.name as lecturer_name,
      COALESCE(AVG(rt.rating_value), 0) as average_rating,
      COUNT(rt.id) as rating_count
    FROM reports r
    JOIN courses c ON r.course_id = c.id
    JOIN classes cl ON r.class_id = cl.id
    JOIN users u ON r.lecturer_id = u.id
    LEFT JOIN ratings rt ON r.id = rt.report_id
    WHERE r.status = 'approved'
  `;
  
  const params = [];
  let paramCount = 0;

  if (startDate) {
    paramCount++;
    query += ` AND r.date_of_lecture >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND r.date_of_lecture <= $${paramCount}`;
    params.push(endDate);
  }

  if (faculty) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(faculty);
  }

  if (course_id) {
    paramCount++;
    query += ` AND r.course_id = $${paramCount}`;
    params.push(course_id);
  }

  if (class_id) {
    paramCount++;
    query += ` AND r.class_id = $${paramCount}`;
    params.push(class_id);
  }

  if (user.role === 'lecturer' || user.role === 'principal_lecturer') {
    paramCount++;
    query += ` AND r.lecturer_id = $${paramCount}`;
    params.push(user.id);
  } else if (user.faculty && ['prl', 'pl'].includes(user.role)) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(user.faculty);
  }

  query += ` 
    GROUP BY r.id, c.course_name, cl.class_name, u.name
    ORDER BY r.date_of_lecture DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getAttendanceReportData(filters, user) {
  const { startDate, endDate, faculty, course_id, class_id } = filters;
  
  let query = `
    SELECT 
      r.week_number,
      r.date_of_lecture,
      r.students_present,
      r.faculty,
      c.course_name,
      cl.class_name,
      u.name as lecturer_name
    FROM reports r
    JOIN courses c ON r.course_id = c.id
    JOIN classes cl ON r.class_id = cl.id
    JOIN users u ON r.lecturer_id = u.id
    WHERE r.status = 'approved'
  `;
  
  const params = [];
  let paramCount = 0;

  if (startDate) {
    paramCount++;
    query += ` AND r.date_of_lecture >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND r.date_of_lecture <= $${paramCount}`;
    params.push(endDate);
  }

  if (faculty) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(faculty);
  }

  if (course_id) {
    paramCount++;
    query += ` AND r.course_id = $${paramCount}`;
    params.push(course_id);
  }

  if (class_id) {
    paramCount++;
    query += ` AND r.class_id = $${paramCount}`;
    params.push(class_id);
  }

  if (user.role === 'lecturer' || user.role === 'principal_lecturer') {
    paramCount++;
    query += ` AND r.lecturer_id = $${paramCount}`;
    params.push(user.id);
  } else if (user.faculty && ['prl', 'pl'].includes(user.role)) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(user.faculty);
  }

  query += ` ORDER BY r.date_of_lecture, r.week_number`;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getFacultyReportData(filters, user) {
  const { startDate, endDate } = filters;
  
  let query = `
    SELECT 
      r.faculty,
      COUNT(r.id) as total_reports,
      COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_reports,
      COUNT(CASE WHEN r.status LIKE 'pending%' THEN 1 END) as pending_reports,
      ROUND(AVG(r.students_present), 2) as avg_attendance
    FROM reports r
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;

  if (startDate) {
    paramCount++;
    query += ` AND r.date_of_lecture >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND r.date_of_lecture <= $${paramCount}`;
    params.push(endDate);
  }

  if (user.faculty && ['prl', 'pl'].includes(user.role)) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(user.faculty);
  }

  query += ` 
    GROUP BY r.faculty
    ORDER BY r.faculty
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getReportStatisticsData(userId) {
  const totalReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1', 
    [userId]
  );
  
  const approvedReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1 AND status = $2', 
    [userId, 'approved']
  );
  
  const pendingReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1 AND status LIKE $2', 
    [userId, 'pending%']
  );

  return {
    total: parseInt(totalReports.rows[0].count),
    approved: parseInt(approvedReports.rows[0].count),
    pending: parseInt(pendingReports.rows[0].count)
  };
}

// CSV Conversion Functions
function convertPerformanceToCSV(performanceData) {
  const headers = ['Course', 'Class', 'Lecturer', 'Week', 'Date', 'Students Present', 'Average Rating', 'Rating Count', 'Faculty'];
  const csvRows = [headers.join(',')];
  
  for (const report of performanceData) {
    const row = [
      `"${report.course_name}"`,
      `"${report.class_name}"`,
      `"${report.lecturer_name}"`,
      report.week_number,
      report.date_of_lecture,
      report.students_present,
      Math.round(report.average_rating * 100) / 100,
      report.rating_count,
      `"${report.faculty}"`
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

function convertAttendanceToCSV(attendanceData) {
  const headers = ['Week', 'Date', 'Course', 'Class', 'Lecturer', 'Students Present', 'Faculty'];
  const csvRows = [headers.join(',')];
  
  for (const report of attendanceData) {
    const row = [
      report.week_number,
      report.date_of_lecture,
      `"${report.course_name}"`,
      `"${report.class_name}"`,
      `"${report.lecturer_name}"`,
      report.students_present,
      `"${report.faculty}"`
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

function convertFacultyToCSV(facultyData) {
  const headers = ['Faculty', 'Total Reports', 'Approved Reports', 'Pending Reports', 'Average Attendance'];
  const csvRows = [headers.join(',')];
  
  for (const faculty of facultyData) {
    const row = [
      `"${faculty.faculty}"`,
      faculty.total_reports,
      faculty.approved_reports,
      faculty.pending_reports,
      faculty.avg_attendance || '0'
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

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