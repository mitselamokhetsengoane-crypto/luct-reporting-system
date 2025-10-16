const pool = require('../config/database');

const reportController = {
  createReport: async (req, res) => {
    try {
      const {
        faculty, class_id, week_number, date_of_lecture, course_id,
        students_present, venue, scheduled_time, topic_taught,
        learning_outcomes, recommendations
      } = req.body;

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

  getMyReports: async (req, res) => {
    try {
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
        WHERE r.lecturer_id = $1
        ORDER BY r.created_at DESC
      `, [req.user.id]);

      res.json({
        success: true,
        reports: result.rows
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

  getClassReports: async (req, res) => {
    try {
      const { classId } = req.params;

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
      `, [classId]);

      res.json({
        success: true,
        reports: result.rows
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

  getPendingApprovalReports: async (req, res) => {
    try {
      if (!['prl', 'pl', 'fmg'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Only PRL, PL, or FMG can view pending approval reports' 
        });
      }

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

      if (req.user.faculty && ['pl', 'prl'].includes(req.user.role)) {
        query += ` AND r.faculty = $1`;
        queryParams.push(req.user.faculty);
      }

      query += ` ORDER BY r.created_at DESC`;

      const result = await pool.query(query, queryParams);

      res.json({
        success: true,
        reports: result.rows
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

  // ✅ REPORT GENERATION ENDPOINTS
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

  // ✅ FIXED: Get generated reports - properly returns lecture reports
  getGeneratedReports: async (req, res) => {
    try {
      console.log('Fetching generated reports for user:', req.user.id, 'Role:', req.user.role);
      
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
          LIMIT 50
        `;
        queryParams = [req.user.id];
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
          LIMIT 50
        `;
        queryParams = [req.user.faculty];
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
          LIMIT 50
        `;
        queryParams = [];
      } else {
        return res.status(403).json({ 
          success: false,
          message: 'Not authorized to view reports' 
        });
      }

      const result = await pool.query(query, queryParams);
      console.log(`Found ${result.rows.length} generated reports`);

      res.json({
        success: true,
        reports: result.rows
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

// Database query functions
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