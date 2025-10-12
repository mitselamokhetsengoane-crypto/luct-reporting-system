const pool = require('../config/database');

const assignmentController = {
  // ... (keep your existing functions: getCourses, getClasses, getLecturers, assignCourse, etc.)

  // FIXED: Generate assignment report with real data
  generateAssignmentReport: async (req, res) => {
    try {
      const { type } = req.params;
      
      // Only allow PL to generate assignment reports
      if (req.user.role !== 'pl') {
        return res.status(403).json({ message: 'Only Program Leaders can generate assignment reports' });
      }

      // Query real assignment data from database
      const assignmentData = await getAssignmentReportData(type, req.user);
      const csvData = convertAssignmentsToReportCSV(assignmentData, type);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=assignment-report-${type}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error generating assignment report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // FIXED: Get assignment statistics with real data
  getAssignmentStatistics: async (req, res) => {
    try {
      // Query real statistics from database
      const statistics = await getAssignmentStatisticsData(req.user);
      res.json(statistics);
    } catch (error) {
      console.error('Error fetching assignment statistics:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// REAL DATABASE QUERIES FOR ASSIGNMENT REPORTS

// Get assignment report data from database
async function getAssignmentReportData(type, user) {
  let query = `
    SELECT 
      ca.*,
      c.course_name,
      c.course_code,
      cl.class_name,
      u.name as lecturer_name,
      u.role as lecturer_role,
      u.faculty,
      u2.name as assigned_by_name,
      ca.assigned_at
    FROM course_assignments ca
    JOIN courses c ON ca.course_id = c.id
    JOIN classes cl ON ca.class_id = cl.id
    JOIN users u ON ca.lecturer_id = u.id
    JOIN users u2 ON ca.assigned_by = u2.id
    WHERE 1=1
  `;
  
  const params = [];

  // Filter by assignment type if specified
  if (type && type !== 'all') {
    if (type === 'lecturer') {
      query += ` AND u.role = 'lecturer'`;
    } else if (type === 'principal') {
      query += ` AND u.role = 'principal_lecturer'`;
    }
  }

  // Apply user faculty filtering if user has faculty
  if (user.faculty) {
    query += ` AND u.faculty = $1`;
    params.push(user.faculty);
  }

  query += ` ORDER BY ca.assigned_at DESC, u.faculty, c.course_name`;

  const result = await pool.query(query, params);
  return result.rows;
}

// Get assignment statistics from database
async function getAssignmentStatisticsData(user) {
  let query = `
    SELECT 
      u.faculty,
      u.role,
      COUNT(ca.id) as assignment_count,
      COUNT(DISTINCT ca.course_id) as unique_courses,
      COUNT(DISTINCT ca.class_id) as unique_classes,
      COUNT(DISTINCT ca.lecturer_id) as unique_lecturers
    FROM course_assignments ca
    JOIN users u ON ca.lecturer_id = u.id
    WHERE 1=1
  `;
  
  const params = [];

  // Apply user faculty filtering if user has faculty
  if (user.faculty) {
    query += ` AND u.faculty = $1`;
    params.push(user.faculty);
  }

  query += ` 
    GROUP BY u.faculty, u.role
    ORDER BY u.faculty, u.role
  `;

  const result = await pool.query(query, params);
  
  // Calculate totals
  const totalQuery = `
    SELECT 
      COUNT(*) as total_assignments,
      COUNT(DISTINCT course_id) as total_courses,
      COUNT(DISTINCT class_id) as total_classes,
      COUNT(DISTINCT lecturer_id) as total_lecturers
    FROM course_assignments ca
    JOIN users u ON ca.lecturer_id = u.id
    WHERE 1=1
    ${user.faculty ? 'AND u.faculty = $1' : ''}
  `;

  const totalResult = await pool.query(totalQuery, user.faculty ? [user.faculty] : []);

  return {
    breakdown: result.rows,
    totals: {
      total_assignments: parseInt(totalResult.rows[0].total_assignments),
      total_courses: parseInt(totalResult.rows[0].total_courses),
      total_classes: parseInt(totalResult.rows[0].total_classes),
      total_lecturers: parseInt(totalResult.rows[0].total_lecturers)
    }
  };
}

// Convert assignments to CSV for report
function convertAssignmentsToReportCSV(assignments, type) {
  const headers = ['Course Name', 'Course Code', 'Class', 'Lecturer', 'Lecturer Role', 'Faculty', 'Assigned By', 'Date Assigned'];
  const csvRows = [headers.join(',')];
  
  for (const assignment of assignments) {
    const row = [
      `"${assignment.course_name}"`,
      `"${assignment.course_code}"`,
      `"${assignment.class_name}"`,
      `"${assignment.lecturer_name}"`,
      `"${assignment.lecturer_role}"`,
      `"${assignment.faculty}"`,
      `"${assignment.assigned_by_name}"`,
      new Date(assignment.assigned_at).toLocaleDateString()
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

// Keep your existing helper functions
function convertAssignmentsToCSV(assignments, userRole) {
  const headers = userRole === 'pl' 
    ? ['Course', 'Course Code', 'Class', 'Lecturer', 'Assigned By', 'Date Assigned']
    : ['Course', 'Course Code', 'Class', 'Assigned By', 'Date Assigned'];
  
  const csvRows = [headers.join(',')];
  
  for (const assignment of assignments) {
    const row = userRole === 'pl'
      ? [
          assignment.course_name,
          assignment.course_code,
          assignment.class_name,
          assignment.lecturer_name,
          assignment.assigned_by_name,
          new Date(assignment.assigned_at).toLocaleDateString()
        ]
      : [
          assignment.course_name,
          assignment.course_code,
          assignment.class_name,
          assignment.assigned_by_name,
          new Date(assignment.assigned_at).toLocaleDateString()
        ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = assignmentController;