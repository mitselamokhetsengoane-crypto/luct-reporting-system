const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const complaintRoutes = require('./routes/complaints');
const assignmentRoutes = require('./routes/assignments');
const ratingRoutes = require('./routes/ratings');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/ratings', ratingRoutes);
// Public Dashboard Route - Updated for your schema
app.get('/api/public/dashboard', async (req, res) => {
  try {
    const pool = require('./config/database');
    
    // Get total reports count
    const reportsResult = await pool.query('SELECT COUNT(*) FROM reports');
    const totalReports = parseInt(reportsResult.rows[0].count);
    
    // Get total students count
    const studentsResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const totalStudents = parseInt(studentsResult.rows[0].count);
    
    // Get total lecturers count (including PRL, PL, FMG)
    const lecturersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role IN ('lecturer', 'prl', 'pl', 'fmg')");
    const totalLecturers = parseInt(lecturersResult.rows[0].count);
    
    // Get total courses count
    const coursesResult = await pool.query('SELECT COUNT(*) FROM courses');
    const totalCourses = parseInt(coursesResult.rows[0].count);
    
    // Get recent activities (last 5 reports with course and lecturer info)
    // Updated query to get faculty from classes table instead of reports
    const activitiesResult = await pool.query(`
      SELECT r.*, c.course_name, u.name as lecturer_name, cl.faculty
      FROM reports r 
      LEFT JOIN courses c ON r.course_id = c.id 
      LEFT JOIN users u ON r.lecturer_id = u.id 
      LEFT JOIN classes cl ON r.class_id = cl.id
      ORDER BY r.created_at DESC 
      LIMIT 5
    `);
    
    const recentActivities = activitiesResult.rows.map(report => ({
      type: 'report',
      description: `${report.lecturer_name || 'Lecturer'} submitted report for ${report.course_name || 'Course'}`,
      time: formatTimeAgo(report.created_at)
    }));
    
    // Get faculty statistics - updated to use classes table for faculty info
    const facultyStats = [
      { 
        faculty: 'FICT', 
        reports: await getFacultyReportCount('FICT'),
        students: await getFacultyStudentCount('FICT')
      },
      { 
        faculty: 'FBMG', 
        reports: await getFacultyReportCount('FBMG'),
        students: await getFacultyStudentCount('FBMG')
      },
      { 
        faculty: 'FENG', 
        reports: await getFacultyReportCount('FENG'),
        students: await getFacultyStudentCount('FENG')
      }
    ];
    
    // Get popular courses (courses with most reports)
    const popularCoursesResult = await pool.query(`
      SELECT c.course_name, c.course_code, COUNT(r.id) as report_count
      FROM courses c 
      LEFT JOIN reports r ON c.id = r.course_id 
      GROUP BY c.id, c.course_name, c.course_code 
      ORDER BY report_count DESC 
      LIMIT 5
    `);
    
    const popularCourses = popularCoursesResult.rows.map(course => ({
      name: course.course_name,
      code: course.course_code,
      reports: parseInt(course.report_count)
    }));
    
    res.json({
      totalReports,
      totalStudents,
      totalLecturers,
      totalCourses,
      recentActivities,
      facultyStats,
      popularCourses
    });
    
  } catch (error) {
    console.error('Error generating public dashboard data:', error);
    res.status(500).json({ 
      message: 'Error loading dashboard data',
      error: error.message 
    });
  }
});

// Updated helper functions for your schema
async function getFacultyReportCount(faculty) {
  try {
    const pool = require('./config/database');
    // Updated to join with classes table to get faculty information
    const result = await pool.query(`
      SELECT COUNT(*) 
      FROM reports r 
      JOIN classes c ON r.class_id = c.id 
      WHERE c.faculty = $1
    `, [faculty]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error(`Error getting report count for ${faculty}:`, error);
    return 0;
  }
}

async function getFacultyStudentCount(faculty) {
  try {
    const pool = require('./config/database');
    const result = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student' AND faculty = $1", [faculty]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error(`Error getting student count for ${faculty}:`, error);
    return 0;
  }
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Recently';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  } catch (error) {
    return 'Recently';
  }
}

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'LUCT Reporting System API is running!' });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'LUCT Reporting System API'
  });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    const pool = require('./config/database');
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      time: result.rows[0].time,
      version: result.rows[0].version
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log('📊 Public dashboard endpoint: /api/public/dashboard');
  console.log('🔧 Health check: /api/health');
  console.log('🗄️  Database health: /api/health/db');
  console.log('📝 Test endpoint: /api/test');
});