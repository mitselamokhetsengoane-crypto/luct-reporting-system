import React, { useState, useEffect } from 'react';
import { reportAPI, complaintAPI, assignmentAPI, ratingAPI, monitoringAPI } from '../services/api';

const Dashboard = ({ user, onLogout }) => {
  const [dashboardData, setDashboardData] = useState({
    reports: [],
    complaints: [],
    assignments: [],
    ratings: [],
    stats: {
      totalReports: 0,
      pendingReports: 0,
      totalComplaints: 0,
      pendingComplaints: 0,
      totalAssignments: 0,
      totalRatings: 0,
      averageRating: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [ratingForm, setRatingForm] = useState({
    rating_value: 0,
    rating_type: 'lecture_quality',
    comment: ''
  });
  const [monitoringData, setMonitoringData] = useState({
    performanceMetrics: {},
    systemHealth: {},
    activityLogs: [],
    trendData: {},
    alerts: []
  });

  useEffect(() => {
    loadDashboardData();
    loadMonitoringData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dashboard data for user:', user);
      
      let reports = [];
      let complaints = [];
      let assignments = [];
      let ratings = [];

      // Validate user role
      if (!user || !user.role) {
        throw new Error('User role not defined');
      }

      // Load data based on user role
      switch (user.role) {
        case 'pl':
        case 'prl':
        case 'fmg':
          try {
            console.log('Loading management data...');
            const [reportsResponse, complaintsResponse, assignmentsResponse, ratingsResponse] = await Promise.allSettled([
              reportAPI.getPendingApprovalReports(),
              complaintAPI.getComplaintsForMe(),
              user.role === 'pl' ? assignmentAPI.getAllAssignments() : Promise.resolve({ data: [] }),
              ratingAPI.getMyRatings()
            ]);
            
            reports = handleAPIResponse(reportsResponse, 'reports') || [];
            complaints = handleAPIResponse(complaintsResponse, 'complaints') || [];
            assignments = handleAPIResponse(assignmentsResponse, 'assignments') || [];
            const ratingsData = handleAPIResponse(ratingsResponse, 'ratings');
            ratings = Array.isArray(ratingsData) ? ratingsData : (ratingsData?.ratings || []);
            
            console.log('Management data loaded:', { reports, complaints, assignments, ratings });
          } catch (error) {
            console.error('Error loading management data:', error);
            setError(`Failed to load management data: ${error.message}`);
          }
          break;

        case 'lecturer':
          try {
            console.log('Loading lecturer data for user ID:', user.id);
            if (!user.id) {
              throw new Error('Lecturer ID not found');
            }

            const [lecturerReports, lecturerComplaints, lecturerAssignments, lecturerRatings] = await Promise.allSettled([
              reportAPI.getMyReports(),
              complaintAPI.getMyComplaints(),
              assignmentAPI.getMyAssignments(),
              ratingAPI.getMyRatings()
            ]);
            
            reports = handleAPIResponse(lecturerReports, 'lecturer reports') || [];
            complaints = handleAPIResponse(lecturerComplaints, 'lecturer complaints') || [];
            assignments = handleAPIResponse(lecturerAssignments, 'lecturer assignments') || [];
            const ratingsData = handleAPIResponse(lecturerRatings, 'lecturer ratings');
            ratings = Array.isArray(ratingsData) ? ratingsData : (ratingsData?.ratings || []);
            
            console.log('Lecturer data loaded:', { reports, complaints, assignments, ratings });
          } catch (error) {
            console.error('Error loading lecturer data:', error);
            setError(`Failed to load lecturer data: ${error.message}`);
          }
          break;

        case 'student':
          try {
            console.log('Loading student data for class ID:', user.class_id);
            if (!user.class_id) {
              throw new Error('Student class ID not found');
            }

            const [studentReports, studentComplaints, studentRatings] = await Promise.allSettled([
              reportAPI.getClassReports(user.class_id),
              complaintAPI.getMyComplaints(),
              ratingAPI.getMyRatings()
            ]);
            
            reports = handleAPIResponse(studentReports, 'student reports') || [];
            complaints = handleAPIResponse(studentComplaints, 'student complaints') || [];
            const ratingsData = handleAPIResponse(studentRatings, 'student ratings');
            ratings = Array.isArray(ratingsData) ? ratingsData : (ratingsData?.ratings || []);
            
            console.log('Student data loaded:', { reports, complaints, ratings });
          } catch (error) {
            console.error('Error loading student data:', error);
            setError(`Failed to load student data: ${error.message}`);
          }
          break;

        default:
          console.warn('Unknown user role:', user.role);
          setError(`Unknown user role: ${user.role}`);
          break;
      }

      // Calculate statistics
      const stats = {
        totalReports: Array.isArray(reports) ? reports.length : 0,
        pendingReports: Array.isArray(reports) ? reports.filter(report => 
          report.status === 'pending_prl' || report.status === 'pending_student'
        ).length : 0,
        totalComplaints: Array.isArray(complaints) ? complaints.length : 0,
        pendingComplaints: Array.isArray(complaints) ? complaints.filter(complaint => 
          complaint.status === 'pending'
        ).length : 0,
        totalAssignments: Array.isArray(assignments) ? assignments.length : 0,
        totalRatings: Array.isArray(ratings) ? ratings.length : 0,
        averageRating: user.role === 'lecturer' ? 
          (await calculateLecturerAverageRating(user.id)) : 0
      };

      setDashboardData({
        reports: Array.isArray(reports) ? reports : [],
        complaints: Array.isArray(complaints) ? complaints : [],
        assignments: Array.isArray(assignments) ? assignments : [],
        ratings: Array.isArray(ratings) ? ratings : [],
        stats
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(`Failed to load dashboard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoringData = async () => {
    try {
      console.log('Loading monitoring data...');
      
      const [
        performanceResponse,
        healthResponse,
        activityResponse,
        trendsResponse,
        alertsResponse
      ] = await Promise.allSettled([
        monitoringAPI.getPerformanceMetrics(),
        monitoringAPI.getSystemHealth(),
        monitoringAPI.getActivityLogs('7d'),
        monitoringAPI.getTrendData(),
        monitoringAPI.getAlerts()
      ]);

      const performanceMetrics = handleAPIResponse(performanceResponse, 'performance metrics') || {};
      const systemHealth = handleAPIResponse(healthResponse, 'system health') || {};
      const activityLogs = handleAPIResponse(activityResponse, 'activity logs') || [];
      const trendData = handleAPIResponse(trendsResponse, 'trend data') || {};
      const alerts = handleAPIResponse(alertsResponse, 'alerts') || [];

      setMonitoringData({
        performanceMetrics,
        systemHealth,
        activityLogs: Array.isArray(activityLogs) ? activityLogs : [],
        trendData,
        alerts: Array.isArray(alerts) ? alerts : []
      });

    } catch (error) {
      console.error('Error loading monitoring data:', error);
      // Set default empty values if API fails
      setMonitoringData({
        performanceMetrics: {},
        systemHealth: { status: 'unknown' },
        activityLogs: [],
        trendData: {},
        alerts: []
      });
    }
  };

  // Helper function to handle API responses
  const handleAPIResponse = (promiseResult, dataType) => {
    if (promiseResult.status === 'fulfilled') {
      const response = promiseResult.value;
      if (response && response.data) {
        console.log(`${dataType} data:`, response.data);
        return response.data;
      } else {
        console.warn(`No data found in ${dataType} response:`, response);
        return null;
      }
    } else {
      console.error(`Error fetching ${dataType}:`, promiseResult.reason);
      return null;
    }
  };

  const calculateLecturerAverageRating = async (lecturerId) => {
    try {
      console.log('Calculating average rating for lecturer:', lecturerId);
      const response = await ratingAPI.getLecturerRatings(lecturerId);
      const average = response?.data?.average_rating || 0;
      console.log('Average rating calculated:', average);
      return average;
    } catch (error) {
      console.error('Error calculating average rating:', error);
      return 0;
    }
  };

  // Rating Functions
  const openRatingModal = (report) => {
    setSelectedReport(report);
    setRatingForm({
      rating_value: 0,
      rating_type: 'lecture_quality',
      comment: ''
    });
    setShowRatingModal(true);
  };

  const closeRatingModal = () => {
    setShowRatingModal(false);
    setSelectedReport(null);
    setRatingForm({
      rating_value: 0,
      rating_type: 'lecture_quality',
      comment: ''
    });
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedReport) return;

      const ratingData = {
        report_id: selectedReport.id,
        rating_value: ratingForm.rating_value,
        rating_type: ratingForm.rating_type,
        comment: ratingForm.comment,
        lecturer_id: selectedReport.lecturer_id || user.id
      };

      console.log('Submitting rating:', ratingData);
      await ratingAPI.create(ratingData);
      
      // Reload dashboard data to reflect new rating
      await loadDashboardData();
      closeRatingModal();
      
      alert('Rating submitted successfully!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    }
  };

  const handleRatingChange = (field, value) => {
    setRatingForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Check if user can rate a specific report
  const canRateReport = (report) => {
    if (!report) return false;
    
    // All users can rate reports from their faculty
    if (user.faculty && report.faculty === user.faculty) {
      return true;
    }
    
    // Students can rate reports from their class
    if (user.role === 'student' && user.class_id && report.class_id === user.class_id) {
      return true;
    }
    
    // Lecturers can rate reports they created or from their faculty
    if (user.role === 'lecturer' && (
      report.lecturer_id === user.id || 
      (user.faculty && report.faculty === user.faculty)
    )) {
      return true;
    }
    
    // Management can rate reports from their faculty
    if (['pl', 'prl', 'fmg'].includes(user.role) && user.faculty && report.faculty === user.faculty) {
      return true;
    }
    
    return false;
  };

  // Check if user has already rated a report
  const hasRatedReport = (reportId) => {
    if (!Array.isArray(dashboardData.ratings)) {
      console.warn('dashboardData.ratings is not an array:', dashboardData.ratings);
      return false;
    }
    return dashboardData.ratings.some(rating => rating && rating.report_id === reportId);
  };

  const getRoleSpecificTitle = () => {
    switch (user.role) {
      case 'pl': return 'Program Leader Dashboard';
      case 'prl': return 'Program Review Leader Dashboard';
      case 'fmg': return 'Faculty Management Dashboard';
      case 'lecturer': return 'Lecturer Dashboard';
      case 'student': return 'Student Dashboard';
      default: return 'Dashboard';
    }
  };

  const getRoleSpecificDescription = () => {
    switch (user.role) {
      case 'pl':
      case 'prl':
      case 'fmg':
        return 'Manage reports, complaints, assignments, and monitor system performance';
      case 'lecturer':
        return 'Manage your teaching reports, course assignments, view ratings and performance metrics';
      case 'student':
        return 'View class reports, manage your complaints, rate lectures and track your activity';
      default:
        return 'System Dashboard';
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          Loading dashboard data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-state">
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Rating Modal */}
      {showRatingModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Rate Lecture Report</h3>
              <button onClick={closeRatingModal} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleRatingSubmit} className="rating-form">
              <div className="form-group">
                <label>Course: {selectedReport.course_name || 'N/A'}</label>
              </div>
              <div className="form-group">
                <label>Lecturer: {selectedReport.lecturer_name || 'N/A'}</label>
              </div>
              <div className="form-group">
                <label>Week: {selectedReport.week_number}</label>
              </div>
              <div className="form-group">
                <label>Faculty: {selectedReport.faculty || 'N/A'}</label>
              </div>
              
              <div className="form-group">
                <label>Rating Type:</label>
                <select 
                  value={ratingForm.rating_type}
                  onChange={(e) => handleRatingChange('rating_type', e.target.value)}
                  required
                >
                  <option value="lecture_quality">Lecture Quality</option>
                  <option value="content_quality">Content Quality</option>
                  <option value="overall_experience">Overall Experience</option>
                </select>
              </div>

              <div className="form-group">
                <label>Rating:</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= ratingForm.rating_value ? 'active' : ''}`}
                      onClick={() => handleRatingChange('rating_value', star)}
                    >
                      ⭐
                    </button>
                  ))}
                  <span className="rating-value">({ratingForm.rating_value}/5)</span>
                </div>
              </div>

              <div className="form-group">
                <label>Comment (Optional):</label>
                <textarea
                  value={ratingForm.comment}
                  onChange={(e) => handleRatingChange('comment', e.target.value)}
                  placeholder="Share your feedback about this lecture..."
                  rows="4"
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeRatingModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={ratingForm.rating_value === 0}>
                  Submit Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div className="header-content">
          <h1>{getRoleSpecificTitle()}</h1>
          <p>{getRoleSpecificDescription()}</p>
        </div>
        <div className="header-actions">
          <button onClick={loadDashboardData} className="btn btn-outline">
            Refresh Data
          </button>
          <button onClick={onLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </div>

      {/* System Health Status */}
      <div className="system-health-banner">
        <div className="health-status">
          <span className={`status-indicator ${monitoringData.systemHealth?.status || 'unknown'}`}>
            ●
          </span>
          System Status: <strong>{monitoringData.systemHealth?.status || 'Unknown'}</strong>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3498db' }}>
            <i>📊</i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalReports}</h3>
            <p>Total Reports</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e74c3c' }}>
            <i>⏳</i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.pendingReports}</h3>
            <p>Pending Reports</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f39c12' }}>
            <i>📝</i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalComplaints}</h3>
            <p>Total Complaints</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#9b59b6' }}>
            <i>⚠️</i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.pendingComplaints}</h3>
            <p>Pending Complaints</p>
          </div>
        </div>

        {/* Ratings Statistics */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#27ae60' }}>
            <i>⭐</i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalRatings}</h3>
            <p>My Ratings</p>
          </div>
        </div>

        {user.role === 'lecturer' && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e67e22' }}>
              <i>📈</i>
            </div>
            <div className="stat-content">
              <h3>{dashboardData.stats.averageRating.toFixed(1)}</h3>
              <p>Average Rating</p>
            </div>
          </div>
        )}

        {(user.role === 'pl' || user.role === 'lecturer') && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#34495e' }}>
              <i>📚</i>
            </div>
            <div className="stat-content">
              <h3>{dashboardData.stats.totalAssignments}</h3>
              <p>Course Assignments</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          Monitoring
        </button>

        <button 
          className={`tab-btn ${activeTab === 'rate-lectures' ? 'active' : ''}`}
          onClick={() => setActiveTab('rate-lectures')}
        >
          Rate Lectures
        </button>

        <button 
          className={`tab-btn ${activeTab === 'my-ratings' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-ratings')}
        >
          My Ratings
        </button>

        {(user.role === 'pl' || user.role === 'prl' || user.role === 'fmg') && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'pending-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending-reports')}
            >
              Pending Reports
            </button>
            <button 
              className={`tab-btn ${activeTab === 'complaints' ? 'active' : ''}`}
              onClick={() => setActiveTab('complaints')}
            >
              Complaints
            </button>
            {user.role === 'pl' && (
              <button 
                className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                Assignments
              </button>
            )}
          </>
        )}

        {user.role === 'lecturer' && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'my-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-reports')}
            >
              My Reports
            </button>
            <button 
              className={`tab-btn ${activeTab === 'my-complaints' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-complaints')}
            >
              My Complaints
            </button>
          </>
        )}

        {user.role === 'student' && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'class-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('class-reports')}
            >
              Class Reports
            </button>
            <button 
              className={`tab-btn ${activeTab === 'my-complaints' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-complaints')}
            >
              My Complaints
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <OverviewTab 
            user={user} 
            data={dashboardData} 
            monitoringData={monitoringData}
            onRefresh={loadDashboardData}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'monitoring' && (
          <MonitoringTab 
            user={user}
            monitoringData={monitoringData}
            dashboardData={dashboardData}
          />
        )}

        {activeTab === 'rate-lectures' && (
          <RateLecturesTab 
            user={user}
            reports={dashboardData.reports}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'my-ratings' && (
          <MyRatingsTab 
            ratings={dashboardData.ratings}
            user={user}
          />
        )}

        {activeTab === 'pending-reports' && (user.role === 'pl' || user.role === 'prl' || user.role === 'fmg') && (
          <PendingReportsTab 
            reports={dashboardData.reports} 
            user={user}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'complaints' && (user.role === 'pl' || user.role === 'prl' || user.role === 'fmg') && (
          <ComplaintsTab 
            complaints={dashboardData.complaints}
            user={user}
          />
        )}

        {activeTab === 'assignments' && user.role === 'pl' && (
          <AssignmentsTab 
            assignments={dashboardData.assignments}
          />
        )}

        {activeTab === 'my-reports' && user.role === 'lecturer' && (
          <MyReportsTab 
            reports={dashboardData.reports}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'class-reports' && user.role === 'student' && (
          <ClassReportsTab 
            reports={dashboardData.reports}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'my-complaints' && (user.role === 'lecturer' || user.role === 'student') && (
          <MyComplaintsTab 
            complaints={dashboardData.complaints}
          />
        )}
      </div>
    </div>
  );
};

// Monitoring Tab Component
const MonitoringTab = ({ user, monitoringData, dashboardData }) => {
  return (
    <div className="monitoring-tab">
      <div className="tab-header">
        <h2>System Monitoring & Analytics</h2>
      </div>

      {/* Performance Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>System Performance</h3>
          <div className="metric-list">
            <div className="metric-item">
              <span className="metric-label">Response Time</span>
              <span className="metric-value">
                {monitoringData.performanceMetrics?.response_time || 'N/A'}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Uptime</span>
              <span className="metric-value">
                {monitoringData.performanceMetrics?.uptime ? `${monitoringData.performanceMetrics.uptime}s` : 'N/A'}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Recent Activities</span>
              <span className="metric-value">
                {monitoringData.performanceMetrics?.recent_activities || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <h3>System Health</h3>
          <div className="metric-list">
            <div className="metric-item">
              <span className="metric-label">Status</span>
              <span className={`metric-value ${monitoringData.systemHealth?.status || 'unknown'}`}>
                {monitoringData.systemHealth?.status || 'Unknown'}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Database</span>
              <span className="metric-value">
                {monitoringData.systemHealth?.database || 'Unknown'}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Environment</span>
              <span className="metric-value">
                {monitoringData.systemHealth?.environment || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <h3>Activity Trends</h3>
          <div className="trend-metrics">
            <div className="trend-item">
              <span className="trend-label">Total Reports</span>
              <span className="trend-value">
                {dashboardData.stats.totalReports}
              </span>
            </div>
            <div className="trend-item">
              <span className="trend-label">Total Ratings</span>
              <span className="trend-value">
                {dashboardData.stats.totalRatings}
              </span>
            </div>
            <div className="trend-item">
              <span className="trend-label">Total Complaints</span>
              <span className="trend-value">
                {dashboardData.stats.totalComplaints}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <h3>Recent Activity</h3>
          <div className="activity-feed">
            {monitoringData.activityLogs && monitoringData.activityLogs.length > 0 ? (
              monitoringData.activityLogs.slice(0, 5).map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">📊</div>
                  <div className="activity-content">
                    <p className="activity-text">
                      {activity.user_name} {activity.action} for {activity.course_name}
                    </p>
                    <small className="activity-time">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <p>No activity data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="alerts-section">
        <h3>System Alerts</h3>
        <div className="alerts-container">
          {monitoringData.alerts && monitoringData.alerts.length > 0 ? (
            monitoringData.alerts.map((alert, index) => (
              <div key={index} className={`alert-item ${alert.type}`}>
                <div className="alert-icon">⚠️</div>
                <div className="alert-content">
                  <p><strong>{alert.type.toUpperCase()} Alert</strong></p>
                  <p>{alert.message}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="no-alerts">
              <p>No active alerts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ user, data, monitoringData, onRefresh, onRateReport, canRateReport, hasRatedReport }) => {
  const getPendingActions = () => {
    const actions = [];
    
    if (data.stats.pendingReports > 0) {
      actions.push({
        type: 'report',
        count: data.stats.pendingReports,
        message: `${data.stats.pendingReports} reports pending your approval`,
        priority: 'high'
      });
    }
    
    if (data.stats.pendingComplaints > 0) {
      actions.push({
        type: 'complaint',
        count: data.stats.pendingComplaints,
        message: `${data.stats.pendingComplaints} complaints require your response`,
        priority: 'medium'
      });
    }

    // Add rating reminder
    const unratedReports = Array.isArray(data.reports) ? data.reports.filter(report => 
      canRateReport(report) && !hasRatedReport(report.id)
    ).length : 0;
    
    if (unratedReports > 0) {
      actions.push({
        type: 'rating',
        count: unratedReports,
        message: `${unratedReports} reports available for rating`,
        priority: 'low'
      });
    }

    return actions;
  };

  const pendingActions = getPendingActions();

  return (
    <div className="overview-tab">
      <div className="tab-header">
        <h2>Quick Overview</h2>
        <button onClick={onRefresh} className="btn btn-secondary">
          Refresh Data
        </button>
      </div>

      {pendingActions.length > 0 && (
        <div className="action-alerts">
          <h3>Action Required</h3>
          {pendingActions.map((action, index) => (
            <div key={index} className={`alert alert-${action.priority}`}>
              <span>{action.message}</span>
              {action.type === 'rating' && (
                <button 
                  onClick={() => {
                    const rateBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
                      btn.textContent === 'Rate Lectures'
                    );
                    if (rateBtn) rateBtn.click();
                  }}
                  className="btn btn-sm btn-primary"
                  style={{marginLeft: '1rem'}}
                >
                  Rate Now
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {Array.isArray(data.reports) && data.reports.slice(0, 5).map(report => (
            <div key={report.id} className="activity-item">
              <div className="activity-icon">📊</div>
              <div className="activity-content">
                <p>
                  <strong>{report.course_name || 'N/A'}</strong> - Week {report.week_number}
                  {canRateReport(report) && !hasRatedReport(report.id) && (
                    <button 
                      onClick={() => onRateReport(report)}
                      className="btn btn-sm btn-primary"
                      style={{marginLeft: '1rem'}}
                    >
                      Rate
                    </button>
                  )}
                </p>
                <small>Status: {report.status} • {new Date(report.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
          
          {Array.isArray(data.ratings) && data.ratings.slice(0, 3).map(rating => (
            <div key={rating.id} className="activity-item">
              <div className="activity-icon">⭐</div>
              <div className="activity-content">
                <p><strong>New Rating</strong> - {rating.rating_value} stars</p>
                <small>{rating.comment ? rating.comment.substring(0, 50) + '...' : 'No comment'} • {new Date(rating.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
          
          {((!Array.isArray(data.reports) || data.reports.length === 0) && (!Array.isArray(data.ratings) || data.ratings.length === 0)) && (
            <p className="no-data">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Rate Lectures Tab Component
const RateLecturesTab = ({ user, reports, onRateReport, canRateReport, hasRatedReport }) => {
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  // Filter reports that user can rate
  const rateableReports = Array.isArray(reports) ? reports.filter(report => 
    canRateReport(report) && !hasRatedReport(report.id)
  ) : [];

  // Get unique faculties and courses for filters
  const faculties = [...new Set(rateableReports.map(report => report.faculty))];
  const courses = [...new Set(rateableReports.map(report => report.course_name))];

  // Apply filters
  const filteredReports = rateableReports.filter(report => {
    const matchesFaculty = !filterFaculty || report.faculty === filterFaculty;
    const matchesCourse = !filterCourse || report.course_name === filterCourse;
    return matchesFaculty && matchesCourse;
  });

  return (
    <div className="rate-lectures-tab">
      <div className="tab-header">
        <h2>Rate Lectures in Your Faculty</h2>
        <p>Provide feedback on lectures and teaching quality</p>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Faculty:</label>
          <select 
            value={filterFaculty} 
            onChange={(e) => setFilterFaculty(e.target.value)}
          >
            <option value="">All Faculties</option>
            {faculties.map(faculty => (
              <option key={faculty} value={faculty}>{faculty}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Course:</label>
          <select 
            value={filterCourse} 
            onChange={(e) => setFilterCourse(e.target.value)}
          >
            <option value="">All Courses</option>
            {courses.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="reports-to-rate">
        <h3>Available Reports for Rating ({filteredReports.length})</h3>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Faculty</th>
                <th>Lecturer</th>
                <th>Week</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(report => (
                <tr key={report.id}>
                  <td>{report.course_name || 'N/A'}</td>
                  <td>{report.faculty || 'N/A'}</td>
                  <td>{report.lecturer_name || 'N/A'}</td>
                  <td>Week {report.week_number}</td>
                  <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-${report.status}`}>
                      {report.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => onRateReport(report)}
                      className="btn btn-primary btn-sm"
                    >
                      Rate Lecture
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <div className="no-data">
              <p>No reports available for rating</p>
              <p className="subtext">
                {rateableReports.length === 0 
                  ? "You have rated all available reports or no reports are available in your faculty."
                  : "No reports match your current filters."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// My Ratings Tab Component
const MyRatingsTab = ({ ratings, user }) => {
  const renderStars = (ratingValue) => {
    return '⭐'.repeat(ratingValue);
  };

  // Ensure ratings is an array
  const ratingsArray = Array.isArray(ratings) ? ratings : [];

  return (
    <div className="my-ratings-tab">
      <h2>My Ratings</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              {user.role === 'student' && <th>Lecturer</th>}
              {user.role === 'student' && <th>Course</th>}
              <th>Rating</th>
              <th>Type</th>
              <th>Comment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {ratingsArray.map(rating => (
              <tr key={rating.id}>
                {user.role === 'student' && (
                  <td>{rating.lecturer_name || 'N/A'}</td>
                )}
                {user.role === 'student' && (
                  <td>{rating.course_name || 'N/A'} - Week {rating.week_number || 'N/A'}</td>
                )}
                <td>
                  <span className="rating-stars">
                    {renderStars(rating.rating_value)}
                    <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                      ({rating.rating_value}/5)
                    </span>
                  </span>
                </td>
                <td>
                  <span className={`rating-type ${rating.rating_type}`}>
                    {rating.rating_type ? rating.rating_type.replace('_', ' ') : 'N/A'}
                  </span>
                </td>
                <td>{rating.comment || 'No comment'}</td>
                <td>{new Date(rating.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ratingsArray.length === 0 && (
          <div className="no-data">
            <p>No ratings found</p>
            <p className="subtext">Start rating lectures to see them here!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Pending Reports Tab Component
const PendingReportsTab = ({ reports, user, onRateReport, canRateReport, hasRatedReport }) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_prl: { label: 'Pending PRL Approval', color: '#e67e22' },
      pending_student: { label: 'Pending Student Sign', color: '#f39c12' }
    };
    
    const config = statusConfig[status] || { label: status, color: '#95a5a6' };
    return (
      <span style={{
        background: config.color,
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 'bold'
      }}>
        {config.label}
      </span>
    );
  };

  // Ensure reports is an array
  const reportsArray = Array.isArray(reports) ? reports : [];

  return (
    <div className="pending-reports-tab">
      <h2>Reports Pending Approval</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Class</th>
              <th>Lecturer</th>
              <th>Week</th>
              <th>Date</th>
              <th>Students</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reportsArray.map(report => (
              <tr key={report.id}>
                <td>{report.course_name || 'N/A'}</td>
                <td>{report.class_name || 'N/A'}</td>
                <td>{report.lecturer_name || 'N/A'}</td>
                <td>Week {report.week_number}</td>
                <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                <td>{report.students_present}</td>
                <td>{getStatusBadge(report.status)}</td>
                <td>
                  {canRateReport(report) && !hasRatedReport(report.id) && (
                    <button 
                      onClick={() => onRateReport(report)}
                      className="btn btn-primary btn-sm"
                    >
                      Rate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportsArray.length === 0 && (
          <div className="no-data">
            <p>No reports pending approval</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Complaints Tab Component
const ComplaintsTab = ({ complaints, user }) => {
  // Ensure complaints is an array
  const complaintsArray = Array.isArray(complaints) ? complaints : [];

  return (
    <div className="complaints-tab">
      <h2>Complaints Requiring Attention</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>From</th>
              <th>Date</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {complaintsArray.map(complaint => (
              <tr key={complaint.id}>
                <td>{complaint.title}</td>
                <td>{complaint.complainant_name}</td>
                <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                <td>
                  <span className={`status-${complaint.status}`}>
                    {complaint.status.toUpperCase()}
                  </span>
                </td>
                <td>{complaint.description.substring(0, 100)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
        {complaintsArray.length === 0 && (
          <div className="no-data">
            <p>No complaints requiring attention</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Assignments Tab Component
const AssignmentsTab = ({ assignments }) => {
  const assignmentsArray = Array.isArray(assignments) ? assignments : [];
  
  return (
    <div className="assignments-tab">
      <h2>Course Assignments</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Lecturer</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {assignmentsArray.map(assignment => (
              <tr key={assignment.id}>
                <td>{assignment.course_name}</td>
                <td>{assignment.lecturer_name}</td>
                <td>{assignment.class_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignmentsArray.length === 0 && (
          <div className="no-data">
            <p>No assignments found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// My Reports Tab Component
const MyReportsTab = ({ reports, onRateReport, canRateReport, hasRatedReport }) => {
  const reportsArray = Array.isArray(reports) ? reports : [];
  
  return (
    <div className="my-reports-tab">
      <h2>My Reports</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Class</th>
              <th>Week</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reportsArray.map(report => (
              <tr key={report.id}>
                <td>{report.course_name || 'N/A'}</td>
                <td>{report.class_name || 'N/A'}</td>
                <td>Week {report.week_number}</td>
                <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                <td>
                  <span className={`status-${report.status}`}>
                    {report.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {canRateReport(report) && !hasRatedReport(report.id) && (
                    <button 
                      onClick={() => onRateReport(report)}
                      className="btn btn-primary btn-sm"
                    >
                      Rate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportsArray.length === 0 && (
          <div className="no-data">
            <p>No reports found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Class Reports Tab Component
const ClassReportsTab = ({ reports, onRateReport, canRateReport, hasRatedReport }) => {
  const reportsArray = Array.isArray(reports) ? reports : [];
  
  return (
    <div className="class-reports-tab">
      <h2>Class Reports</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Week</th>
              <th>Date</th>
              <th>Lecturer</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reportsArray.map(report => (
              <tr key={report.id}>
                <td>{report.course_name || 'N/A'}</td>
                <td>Week {report.week_number}</td>
                <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                <td>{report.lecturer_name || 'N/A'}</td>
                <td>
                  <span className={`status-${report.status}`}>
                    {report.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {canRateReport(report) && !hasRatedReport(report.id) && (
                    <button 
                      onClick={() => onRateReport(report)}
                      className="btn btn-primary btn-sm"
                    >
                      Rate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportsArray.length === 0 && (
          <div className="no-data">
            <p>No class reports found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// My Complaints Tab Component
const MyComplaintsTab = ({ complaints }) => {
  const complaintsArray = Array.isArray(complaints) ? complaints : [];
  
  return (
    <div className="my-complaints-tab">
      <h2>My Complaints</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Against</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {complaintsArray.map(complaint => (
              <tr key={complaint.id}>
                <td>{complaint.title}</td>
                <td>{complaint.complaint_against_name}</td>
                <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                <td>
                  <span className={`status-${complaint.status}`}>
                    {complaint.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {complaintsArray.length === 0 && (
          <div className="no-data">
            <p>No complaints found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;