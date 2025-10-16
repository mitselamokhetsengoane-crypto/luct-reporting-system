const pool = require('../config/database');

const reportController = {
  // ✅ Create a new report - aligned with your schema
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
        return res.status(400).json({ 
          success: false,
          message: 'All required fields must be filled' 
        });
      }

      const result = await pool.query(`
        INSERT INTO reports 
          (faculty, class_id, week_number, date_of_lecture, course_id, lecturer_id, 
           students_present, venue, scheduled_time, topic_taught, learning_outcomes, recommendations, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
        RETURNING *
      `, [
        faculty, class_id, week_number, date_of_lecture, course_id, req.user.id,
        students_present, venue, scheduled_time, topic_taught, learning_outcomes, recommendations || ''
      ]);

      res.status(201).json({ 
        success: true,
        message: 'Report created successfully', 
        report: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Get reports created by the current lecturer
  getMyReports: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          r.*,
          c.course_name,
          cl.class_name,
          u.name as lecturer_name
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN classes cl ON r.class_id = cl.id
        JOIN users u ON r.lecturer_id = u.id
        WHERE r.lecturer_id = $1
      `;
      
      const queryParams = [req.user.id];

      if (status) {
        query += ` AND r.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      query += ` ORDER BY r.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(parseInt(limit), offset);

      const result = await pool.query(query, queryParams);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM reports WHERE lecturer_id = $1`;
      const countParams = [req.user.id];
      if (status) {
        countQuery += ` AND status = $2`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
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
      console.error('Error fetching reports:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Get reports for a specific class
  getClassReports: async (req, res) => {
    try {
      const { classId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const result = await pool.query(`
        SELECT 
          r.*,
          c.course_name,
          u.name as lecturer_name
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN users u ON r.lecturer_id = u.id
        WHERE r.class_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `, [classId, parseInt(limit), offset]);

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM reports WHERE class_id = $1',
        [classId]
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
      console.error('Error fetching class reports:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Get reports pending approval
  getPendingApprovalReports: async (req, res) => {
    try {
      if (!['prl', 'pl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Only PRL, PL, or FMG can view pending approval reports' 
        });
      }

      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          r.*,
          c.course_name,
          cl.class_name,
          u.name as lecturer_name
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN classes cl ON r.class_id = cl.id
        JOIN users u ON r.lecturer_id = u.id
        WHERE r.status LIKE 'pending%'
      `;
      
      const queryParams = [];

      // Add faculty filter for PL and PRL
      if (req.user.faculty && ['pl', 'prl'].includes(req.user.role)) {
        query += ` AND r.faculty = $1`;
        queryParams.push(req.user.faculty);
      }

      query += ` ORDER BY r.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(parseInt(limit), offset);

      const result = await pool.query(query, queryParams);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM reports WHERE status LIKE 'pending%'`;
      const countParams = [];
      if (req.user.faculty && ['pl', 'prl'].includes(req.user.role)) {
        countQuery += ` AND faculty = $1`;
        countParams.push(req.user.faculty);
      }
      
      const countResult = await pool.query(countQuery, countParams);
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
      console.error('Error fetching pending approval reports:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Sign report (student)
  signReport: async (req, res) => {
    try {
      const { id } = req.params;
      const { signature } = req.body;

      if (!signature) {
        return res.status(400).json({ 
          success: false,
          message: 'Signature is required' 
        });
      }

      const report = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
      
      if (!report.rows.length) {
        return res.status(404).json({ 
          success: false,
          message: 'Report not found' 
        });
      }

      if (req.user.role !== 'student') {
        return res.status(403).json({ 
          success: false,
          message: 'Only students can sign reports' 
        });
      }

      if (report.rows[0].class_id !== req.user.class_id) {
        return res.status(403).json({ 
          success: false,
          message: 'You can only sign reports for your class' 
        });
      }

      if (report.rows[0].status !== 'pending_student') {
        return res.status(400).json({ 
          success: false,
          message: 'Report is not available for signing' 
        });
      }

      const result = await pool.query(`
        UPDATE reports
        SET status = 'pending_prl', student_signature = $1, signed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [signature, id]);

      res.json({ 
        success: true,
        message: 'Report signed successfully and sent to PRL for approval', 
        report: result.rows[0] 
      });
    } catch (error) {
      console.error('Error signing report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Approve report (PRL/PL)
  approveReport: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (req.user.role !== 'prl' && req.user.role !== 'pl') {
        return res.status(403).json({ 
          success: false,
          message: 'Only PRL or PL can approve reports' 
        });
      }

      const report = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
      
      if (!report.rows.length) {
        return res.status(404).json({ 
          success: false,
          message: 'Report not found' 
        });
      }

      if (report.rows[0].status !== 'pending_prl') {
        return res.status(400).json({ 
          success: false,
          message: 'Report is not available for approval' 
        });
      }

      const result = await pool.query(`
        UPDATE reports
        SET status = 'approved'
        WHERE id = $1
        RETURNING *
      `, [id]);

      res.json({ 
        success: true,
        message: 'Report approved successfully', 
        report: result.rows[0] 
      });
    } catch (error) {
      console.error('Error approving report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Get specific report by ID
  getReportById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT 
          r.*,
          c.course_name,
          cl.class_name,
          u.name as lecturer_name
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN classes cl ON r.class_id = cl.id
        JOIN users u ON r.lecturer_id = u.id
        WHERE r.id = $1
      `, [id]);

      if (!result.rows.length) {
        return res.status(404).json({ 
          success: false,
          message: 'Report not found' 
        });
      }

      res.json({
        success: true,
        report: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  },

  // ✅ Generate performance report - uses existing tables only
  generatePerformanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Not authorized to generate reports' 
        });
      }

      const performanceData = await getPerformanceReportData(filters, req.user);
      const csvData = convertPerformanceToCSV(performanceData);
      
      const fileName = `performance-report-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating performance report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while generating performance report', 
        error: error.message 
      });
    }
  },

  // ✅ Generate attendance report - uses existing tables only
  generateAttendanceReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['lecturer', 'prl', 'pl'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Not authorized to generate reports' 
        });
      }

      const attendanceData = await getAttendanceReportData(filters, req.user);
      const csvData = convertAttendanceToCSV(attendanceData);
      
      const fileName = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating attendance report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while generating attendance report', 
        error: error.message 
      });
    }
  },

  // ✅ Generate faculty report - uses existing tables only
  generateFacultyReport: async (req, res) => {
    try {
      const filters = req.body;
      
      if (!['prl', 'pl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Not authorized to generate faculty reports' 
        });
      }

      const facultyData = await getFacultyReportData(filters, req.user);
      const csvData = convertFacultyToCSV(facultyData);
      
      const fileName = `faculty-report-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating faculty report:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error while generating faculty report', 
        error: error.message 
      });
    }
  },

  // ✅ Get all generated reports (lecture reports) for user
  getGeneratedReports: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      // For lecturers: show their lecture reports
      // For PRL/PL/FMG: show reports from their faculty
      let query, queryParams;

      if (req.user.role === 'lecturer') {
        query = `
          SELECT 
            r.*,
            c.course_name,
            cl.class_name,
            u.name as lecturer_name,
            'lecture_report' as report_type,
            CONCAT('Lecture Report - ', c.course_name, ' - Week ', r.week_number) as report_name,
            r.created_at as generated_at
          FROM reports r
          JOIN courses c ON r.course_id = c.id
          JOIN classes cl ON r.class_id = cl.id
          JOIN users u ON r.lecturer_id = u.id
          WHERE r.lecturer_id = $1
          ORDER BY r.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [req.user.id, parseInt(limit), offset];
      } else if (['prl', 'pl'].includes(req.user.role)) {
        query = `
          SELECT 
            r.*,
            c.course_name,
            cl.class_name,
            u.name as lecturer_name,
            'lecture_report' as report_type,
            CONCAT('Lecture Report - ', c.course_name, ' - Week ', r.week_number) as report_name,
            r.created_at as generated_at
          FROM reports r
          JOIN courses c ON r.course_id = c.id
          JOIN classes cl ON r.class_id = cl.id
          JOIN users u ON r.lecturer_id = u.id
          WHERE r.faculty = $1
          ORDER BY r.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [req.user.faculty, parseInt(limit), offset];
      } else if (req.user.role === 'fmg') {
        query = `
          SELECT 
            r.*,
            c.course_name,
            cl.class_name,
            u.name as lecturer_name,
            'lecture_report' as report_type,
            CONCAT('Lecture Report - ', c.course_name, ' - Week ', r.week_number) as report_name,
            r.created_at as generated_at
          FROM reports r
          JOIN courses c ON r.course_id = c.id
          JOIN classes cl ON r.class_id = cl.id
          JOIN users u ON r.lecturer_id = u.id
          ORDER BY r.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        queryParams = [parseInt(limit), offset];
      } else {
        return res.status(403).json({ 
          success: false,
          message: 'Not authorized to view reports' 
        });
      }

      const result = await pool.query(query, queryParams);

      // Get total count
      let countQuery;
      if (req.user.role === 'lecturer') {
        countQuery = 'SELECT COUNT(*) FROM reports WHERE lecturer_id = $1';
        queryParams = [req.user.id];
      } else if (['prl', 'pl'].includes(req.user.role)) {
        countQuery = 'SELECT COUNT(*) FROM reports WHERE faculty = $1';
        queryParams = [req.user.faculty];
      } else {
        countQuery = 'SELECT COUNT(*) FROM reports';
        queryParams = [];
      }

      const countResult = await pool.query(countQuery, queryParams);
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

// Database query functions - using only existing tables
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

  if (user.role === 'lecturer') {
    paramCount++;
    query += ` AND r.lecturer_id = $${paramCount}`;
    params.push(user.id);
  } else if (user.faculty && ['prl', 'pl'].includes(user.role)) {
    paramCount++;
    query += ` AND r.faculty = $${paramCount}`;
    params.push(user.faculty);
  }

  query += ` ORDER BY r.date_of_lecture DESC`;

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

  if (user.role === 'lecturer') {
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

// CSV Conversion Functions
function convertPerformanceToCSV(performanceData) {
  const headers = ['Course', 'Class', 'Lecturer', 'Week', 'Date', 'Students Present', 'Faculty'];
  const csvRows = [headers.join(',')];
  
  for (const report of performanceData) {
    const row = [
      `"${report.course_name}"`,
      `"${report.class_name}"`,
      `"${report.lecturer_name}"`,
      report.week_number,
      report.date_of_lecture,
      report.students_present,
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

module.exports = reportController;