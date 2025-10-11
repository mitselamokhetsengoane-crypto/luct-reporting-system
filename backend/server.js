const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const complaintRoutes = require('./routes/complaints');
const assignmentRoutes = require('./routes/assignments');
const ratingRoutes = require('./routes/ratings');
const monitoringRoutes = require('./routes/monitoring'); // ADDED: Monitoring routes

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://luct-reporting-system-3-tpuc.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle pre-flight requests
app.options('*', cors(corsOptions));

// Additional CORS headers
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://luct-reporting-system-3-tpuc.onrender.com',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/monitoring', monitoringRoutes); // ADDED: Monitoring routes

// Public Dashboard Route
app.get('/api/public/dashboard', async (req, res) => {
  try {
    const pool = require('./config/database');

    const reportsResult = await pool.query('SELECT COUNT(*) FROM reports');
    const totalReports = parseInt(reportsResult.rows[0].count);

    const studentsResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const totalStudents = parseInt(studentsResult.rows[0].count);

    const lecturersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role IN ('lecturer', 'prl', 'pl', 'fmg')");
    const totalLecturers = parseInt(lecturersResult.rows[0].count);

    const coursesResult = await pool.query('SELECT COUNT(*) FROM courses');
    const totalCourses = parseInt(coursesResult.rows[0].count);

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

    const facultyStats = [
      { faculty: 'FICT', reports: await getFacultyReportCount('FICT'), students: await getFacultyStudentCount('FICT') },
      { faculty: 'FBMG', reports: await getFacultyReportCount('FBMG'), students: await getFacultyStudentCount('FBMG') },
      { faculty: 'FENG', reports: await getFacultyReportCount('FENG'), students: await getFacultyStudentCount('FENG') }
    ];

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
    res.status(500).json({ message: 'Error loading dashboard data', error: error.message });
  }
});

// Helper functions
async function getFacultyReportCount(faculty) {
  try {
    const pool = require('./config/database');
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

// Test and health routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'LUCT Reporting System API is running!', 
    environment: process.env.NODE_ENV, 
    timestamp: new Date().toISOString(),
    cors: 'Enabled for frontend: https://luct-reporting-system-3-tpuc.onrender.com'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    service: 'LUCT Reporting System API', 
    environment: process.env.NODE_ENV, 
    version: process.env.APP_VERSION 
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const pool = require('./config/database');
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({ 
      status: 'OK', 
      database: 'Connected', 
      time: result.rows[0].time, 
      version: result.rows[0].version, 
      environment: process.env.NODE_ENV 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected', 
      error: error.message, 
      environment: process.env.NODE_ENV 
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to LUCT Reporting System API',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    cors: 'Enabled for: https://luct-reporting-system-3-tpuc.onrender.com',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      database: '/api/health/db',
      public: '/api/public/dashboard',
      monitoring: '/api/monitoring' // ADDED: Monitoring endpoint
    }
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl, 
    method: req.method 
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS Enabled for: https://luct-reporting-system-3-tpuc.onrender.com`);
  console.log(`📊 Public dashboard endpoint: /api/public/dashboard`);
  console.log(`🔧 Health check: /api/health`);
  console.log(`🗄️  Database health: /api/health/db`);
  console.log(`📝 Test endpoint: /api/test`);
  console.log(`📈 Monitoring endpoints: /api/monitoring/*`); // ADDED: Monitoring info
  console.log(`📍 Server URL: http://0.0.0.0:${PORT}`);
});