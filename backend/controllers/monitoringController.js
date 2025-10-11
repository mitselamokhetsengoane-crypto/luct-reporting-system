const db = require('../config/database');

class MonitoringService {
  // Get performance metrics
  static async getPerformanceMetrics() {
    try {
      // Get report statistics
      const reportsStats = await db.query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reports,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed_reports
        FROM reports
      `);

      // Get user statistics
      const userStats = await db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
          COUNT(CASE WHEN role IN ('lecturer', 'prl', 'pl', 'fmg') THEN 1 END) as lecturers,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
        FROM users
      `);

      // Get recent activity count
      const recentActivity = await db.query(`
        SELECT COUNT(*) as recent_activities
        FROM reports 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      return {
        reports: reportsStats.rows[0],
        users: userStats.rows[0],
        recent_activities: parseInt(recentActivity.rows[0].recent_activities),
        response_time: 'fast',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Get system health status
  static async getSystemHealth() {
    try {
      // Test database connection
      const dbTest = await db.query('SELECT NOW() as current_time');
      
      // Check important tables
      const tablesCheck = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM reports) as reports_count,
          (SELECT COUNT(*) FROM courses) as courses_count
      `);

      return {
        status: 'healthy',
        database: 'connected',
        last_check: dbTest.rows[0].current_time,
        tables: tablesCheck.rows[0],
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get activity logs
  static async getActivityLogs(range = '7d') {
    try {
      let interval;
      switch (range) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const activities = await db.query(`
        SELECT 
          'report' as type,
          'Report submitted' as action,
          u.name as user_name,
          c.course_name,
          r.created_at,
          r.status
        FROM reports r
        LEFT JOIN users u ON r.lecturer_id = u.id
        LEFT JOIN courses c ON r.course_id = c.id
        WHERE r.created_at >= NOW() - INTERVAL '${interval}'
        
        UNION ALL
        
        SELECT 
          'complaint' as type,
          'Complaint filed' as action,
          u.name as user_name,
          c.title as course_name,
          c.created_at,
          c.status
        FROM complaints c
        LEFT JOIN users u ON c.complaint_by = u.id
        WHERE c.created_at >= NOW() - INTERVAL '${interval}'
        
        ORDER BY created_at DESC
        LIMIT 50
      `);

      return {
        activities: activities.rows,
        range: range,
        total: activities.rows.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Get trend data
  static async getTrendData() {
    try {
      // Weekly report trends
      const weeklyTrends = await db.query(`
        SELECT 
          DATE_TRUNC('week', created_at) as week,
          COUNT(*) as report_count
        FROM reports 
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY week
        ORDER BY week
      `);

      // User registration trends
      const userTrends = await db.query(`
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as user_count
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY day
        ORDER BY day
      `);

      return {
        weekly_trends: weeklyTrends.rows,
        user_trends: userTrends.rows,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Get system alerts
  static async getAlerts() {
    try {
      // Check for pending reports that are overdue
      const overdueReports = await db.query(`
        SELECT COUNT(*) as count
        FROM reports 
        WHERE status = 'pending' 
        AND created_at <= NOW() - INTERVAL '7 days'
      `);

      // Check for unresolved complaints
      const unresolvedComplaints = await db.query(`
        SELECT COUNT(*) as count
        FROM complaints 
        WHERE status = 'pending'
      `);

      const alerts = [];

      if (parseInt(overdueReports.rows[0].count) > 0) {
        alerts.push({
          type: 'warning',
          message: `${overdueReports.rows[0].count} reports are pending for more than 7 days`,
          priority: 'medium'
        });
      }

      if (parseInt(unresolvedComplaints.rows[0].count) > 0) {
        alerts.push({
          type: 'info',
          message: `${unresolvedComplaints.rows[0].count} complaints need attention`,
          priority: 'low'
        });
      }

      return {
        alerts: alerts,
        total_alerts: alerts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }
}

// Controller functions
const getPerformanceMetrics = async (req, res) => {
  try {
    const performanceData = await MonitoringService.getPerformanceMetrics();
    res.json(performanceData);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
};

const getSystemHealth = async (req, res) => {
  try {
    const healthData = await MonitoringService.getSystemHealth();
    res.json(healthData);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
};

const getActivityLogs = async (req, res) => {
  try {
    const { range } = req.query;
    const activityData = await MonitoringService.getActivityLogs(range);
    res.json(activityData);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

const getTrendData = async (req, res) => {
  try {
    const trendData = await MonitoringService.getTrendData();
    res.json(trendData);
  } catch (error) {
    console.error('Error fetching trend data:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
};

const getAlerts = async (req, res) => {
  try {
    const alerts = await MonitoringService.getAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

module.exports = {
  getPerformanceMetrics,
  getSystemHealth,
  getActivityLogs,
  getTrendData,
  getAlerts
};