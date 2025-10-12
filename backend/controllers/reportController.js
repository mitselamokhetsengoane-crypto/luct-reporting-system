const pool = require('../config/database');
const Report = require('../models/Report');

const reportController = {
  // ... (keep all your existing functions: createReport, getMyReports, etc.)

  // FIXED: Generate performance report with real data
  generatePerformanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      // Only allow lecturers, PRL, PL to generate reports
      if (!['lecturer', 'principal_lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate reports' });
      }

      // Query real performance data from database
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

  // FIXED: Generate attendance report with real data
  generateAttendanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      // Only allow lecturers, PRL, PL to generate reports
      if (!['lecturer', 'principal_lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate reports' });
      }

      // Query real attendance data from database
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

  // FIXED: Generate faculty report with real data
  generateFacultyReport: async (req, res) => {
    try {
      const filters = req.body;
      
      // Only allow PRL, PL, FMG to generate faculty reports
      if (!['prl', 'pl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized to generate faculty reports' });
      }

      // Query real faculty data from database
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
      
      // Enhanced statistics with real data
      const statistics = await getReportStatisticsData(userId);
      res.json(statistics);
    } catch (error) {
      console.error('Error fetching report statistics:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// REAL DATABASE QUERIES - NO HARDCODED DATA

// Get performance report data from database
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
      COUNT(rt.id) as rating_count,
      COUNT(DISTINCT r.id) as total_reports
    FROM reports r
    JOIN courses c ON r.course_id = c.id
    JOIN classes cl ON r.class_id = cl.id
    JOIN users u ON r.lecturer_id = u.id
    LEFT JOIN ratings rt ON r.id = rt.report_id
    WHERE r.status = 'approved'
  `;
  
  const params = [];
  let paramCount = 0;

  // Apply filters
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

  // Apply user role-based filtering
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
    ORDER BY r.date_of_lecture DESC, r.week_number
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

// Get attendance report data from database
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
      u.name as lecturer_name,
      cl.total_students,
      ROUND((r.students_present::decimal / cl.total_students::decimal) * 100, 2) as attendance_percentage
    FROM reports r
    JOIN courses c ON r.course_id = c.id
    JOIN classes cl ON r.class_id = cl.id
    JOIN users u ON r.lecturer_id = u.id
    WHERE r.status = 'approved'
  `;
  
  const params = [];
  let paramCount = 0;

  // Apply filters
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

  // Apply user role-based filtering
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

// Get faculty report data from database
async function getFacultyReportData(filters, user) {
  const { startDate, endDate } = filters;
  
  let query = `
    SELECT 
      r.faculty,
      COUNT(r.id) as total_reports,
      COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_reports,
      COUNT(CASE WHEN r.status LIKE 'pending%' THEN 1 END) as pending_reports,
      ROUND(AVG(r.students_present), 2) as avg_attendance,
      COUNT(DISTINCT r.lecturer_id) as total_lecturers,
      COUNT(DISTINCT r.class_id) as total_classes
    FROM reports r
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;

  // Apply filters
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

  // Apply user faculty filtering for PRL/PL
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

// Get comprehensive report statistics
async function getReportStatisticsData(userId) {
  // Total reports
  const totalReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1', 
    [userId]
  );
  
  // Approved reports
  const approvedReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1 AND status = $2', 
    [userId, 'approved']
  );
  
  // Pending reports
  const pendingReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1 AND status LIKE $2', 
    [userId, 'pending%']
  );

  // Average attendance
  const avgAttendance = await pool.query(
    'SELECT ROUND(AVG(students_present), 2) as avg_attendance FROM reports WHERE lecturer_id = $1 AND status = $2',
    [userId, 'approved']
  );

  // Recent reports (last 30 days)
  const recentReports = await pool.query(
    'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1 AND created_at >= NOW() - INTERVAL \'30 days\'',
    [userId]
  );

  return {
    total: parseInt(totalReports.rows[0].count),
    approved: parseInt(approvedReports.rows[0].count),
    pending: parseInt(pendingReports.rows[0].count),
    avg_attendance: parseFloat(avgAttendance.rows[0].avg_attendance) || 0,
    recent: parseInt(recentReports.rows[0].count)
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
      Math.round(report.average_rating * 100) / 100, // Round to 2 decimal places
      report.rating_count,
      `"${report.faculty}"`
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

function convertAttendanceToCSV(attendanceData) {
  const headers = ['Week', 'Date', 'Course', 'Class', 'Lecturer', 'Students Present', 'Total Students', 'Attendance %', 'Faculty'];
  const csvRows = [headers.join(',')];
  
  for (const report of attendanceData) {
    const row = [
      report.week_number,
      report.date_of_lecture,
      `"${report.course_name}"`,
      `"${report.class_name}"`,
      `"${report.lecturer_name}"`,
      report.students_present,
      report.total_students || 'N/A',
      report.attendance_percentage || '0',
      `"${report.faculty}"`
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

function convertFacultyToCSV(facultyData) {
  const headers = ['Faculty', 'Total Reports', 'Approved Reports', 'Pending Reports', 'Average Attendance', 'Total Lecturers', 'Total Classes'];
  const csvRows = [headers.join(',')];
  
  for (const faculty of facultyData) {
    const row = [
      `"${faculty.faculty}"`,
      faculty.total_reports,
      faculty.approved_reports,
      faculty.pending_reports,
      faculty.avg_attendance || '0',
      faculty.total_lecturers,
      faculty.total_classes
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

// Keep your existing helper functions
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