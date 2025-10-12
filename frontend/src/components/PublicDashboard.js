import React, { useState, useEffect } from 'react';
import { publicAPI, retryRequest } from '../services/api';
import { Link } from 'react-router-dom';

const PublicDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalReports: 0,
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    recentActivities: [],
    facultyStats: [],
    popularCourses: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadPublicData = async (isRetry = false) => {
    try {
      if (!isRetry) setLoading(true);
      setError(null);

      // Use retry logic for public dashboard
      const response = await retryRequest(
        () => publicAPI.getDashboardData(),
        2, // max retries
        2000 // initial delay
      );

      if (response.data) {
        setDashboardData(response.data);
        setRetryCount(0);
      } else {
        throw new Error('No data received from server');
      }
    } catch (error) {
      console.error('Error loading public data:', error);
      
      // Set fallback data
      setDashboardData({
        totalReports: 0,
        totalStudents: 0,
        totalLecturers: 0,
        totalCourses: 0,
        recentActivities: [],
        facultyStats: [
          { faculty: 'FICT', reports: 0, students: 0 },
          { faculty: 'FBMG', reports: 0, students: 0 },
          { faculty: 'FENG', reports: 0, students: 0 }
        ],
        popularCourses: []
      });

      // Enhanced error messages
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        setError('Dashboard is taking longer than usual to load. Please try again in a moment.');
      } else if (error.response?.status === 500) {
        setError('Server is currently unavailable. Please try again later.');
      } else if (error.response?.status === 404) {
        setError('Dashboard endpoint not found. The system may be under maintenance.');
      } else {
        setError('Unable to load dashboard data. Please check your connection and try again.');
      }
      
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicData();
  }, []);

  // Auto-retry after delay if timeout occurs
  useEffect(() => {
    if (error && retryCount < 2) {
      const timer = setTimeout(() => {
        loadPublicData(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, retryCount]);

  if (loading) {
    return (
      <div className="public-dashboard">
        <div className="loading" style={{ 
          textAlign: 'center', 
          padding: '3rem',
          color: '#e67e22',
          fontSize: '1.2rem'
        }}>
          Loading public dashboard...
          <div style={{ 
            marginTop: '1rem',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            This may take a moment on first load
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-dashboard">
      {/* Public Header with Navigation */}
      <div className="public-header">
        <div>
          <h1>LUCT Reporting System</h1>
          <p>Limkokwing University of Creative Technology - Lesotho</p>
        </div>
        <div className="auth-buttons">
          <Link to="/login" className="auth-btn login">
            Login
          </Link>
          <Link to="/register" className="auth-btn register">
            Register
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message" style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          color: '#856404',
          padding: '1rem',
          margin: '1rem',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          <strong>Note:</strong> {error}
          <button 
            onClick={() => loadPublicData(true)}
            style={{
              marginLeft: '1rem',
              background: '#e67e22',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            disabled={retryCount >= 3}
          >
            {retryCount >= 3 ? 'Max Retries' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Welcome Section */}
      <div className="welcome-section">
        <h1>Welcome to LUCT Reporting System</h1>
        
        <div className="welcome-stats">
          <div className="welcome-stat">
            <h3>{dashboardData.totalReports}</h3>
            <p>Lecture Reports</p>
          </div>
          <div className="welcome-stat">
            <h3>{dashboardData.totalStudents}</h3>
            <p>Students</p>
          </div>
          <div className="welcome-stat">
            <h3>{dashboardData.totalLecturers}</h3>
            <p>Academic Staff</p>
          </div>
          <div className="welcome-stat">
            <h3>{dashboardData.totalCourses}</h3>
            <p>Courses</p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link to="/login" className="btn btn-primary" style={{ 
            textDecoration: 'none',
            padding: '0.75rem 2rem',
            fontSize: '1.1rem',
            background: '#e67e22',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}>
            Login to System
          </Link>
          <Link to="/register" className="btn btn-secondary" style={{ 
            textDecoration: 'none',
            padding: '0.75rem 2rem',
            fontSize: '1.1rem',
            background: 'transparent',
            color: '#e67e22',
            border: '2px solid #e67e22',
            borderRadius: '4px'
          }}>
            Create Account
          </Link>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-content">
        {/* Statistics Overview */}
        <div className="stats-section">
          <h2>System Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-info">
                <h3 className="number">{dashboardData.totalReports}</h3>
                <p>Total Reports</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h3 className="number">{dashboardData.totalStudents}</h3>
                <p>Registered Students</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h3 className="number">{dashboardData.totalLecturers}</h3>
                <p>Academic Staff</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h3 className="number">{dashboardData.totalCourses}</h3>
                <p>Courses Offered</p>
              </div>
            </div>
          </div>
        </div>

        {/* Faculty Performance */}
        <div className="faculty-stats">
          <h2>Faculty Performance</h2>
          <div className="faculty-cards">
            {dashboardData.facultyStats.map((faculty, index) => (
              <div key={index} className="faculty-card">
                <h3>{faculty.faculty}</h3>
                <div className="faculty-metrics">
                  <div className="metric">
                    <span className="metric-value">{faculty.reports}</span>
                    <span className="metric-label">Reports</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{faculty.students}</span>
                    <span className="metric-label">Students</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="recent-activities">
          <h2>Recent Activities</h2>
          <div className="activities-list">
            {dashboardData.recentActivities.length > 0 ? (
              dashboardData.recentActivities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-content">
                    <p>{activity.description}</p>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                No recent activities yet. Be the first to submit a report!
              </div>
            )}
          </div>
        </div>

        {/* Popular Courses */}
        <div className="popular-courses">
          <h2>Popular Courses</h2>
          <div className="courses-list">
            {dashboardData.popularCourses.length > 0 ? (
              dashboardData.popularCourses.map((course, index) => (
                <div key={index} className="course-item">
                  <div className="course-info">
                    <h4>{course.name}</h4>
                    <p>{course.code}</p>
                  </div>
                  <div className="course-stats">
                    <span className="report-count">{course.reports} reports</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                No course reports yet. Start reporting today!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Features */}
      <div className="system-info">
        <h2>System Features</h2>
        <div className="info-cards">
          <div className="info-card">
            <h3>Smart Reporting</h3>
            <p>Easily submit detailed lecture reports with attendance, topics covered, and learning outcomes.</p>
          </div>
          <div className="info-card">
            <h3>Student Verification</h3>
            <p>Class representatives verify reports to ensure accuracy and transparency.</p>
          </div>
          <div className="info-card">
            <h3>Progress Monitoring</h3>
            <p>Principal lecturers monitor academic progress and provide timely feedback.</p>
          </div>
          <div className="info-card">
            <h3>Instant Feedback</h3>
            <p>Streamlined communication between students, lecturers, and administrators.</p>
          </div>
        </div>
      </div>

      {/* Final Call to Action */}
      <div className="cta-section">
        <h2>Ready to Join Our Academic Community?</h2>
        <p>
          Experience the future of academic reporting and communication.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn btn-primary" style={{
            background: 'white',
            color: '#e67e22',
            textDecoration: 'none',
            padding: '0.75rem 2rem',
            border: 'none',
            borderRadius: '4px'
          }}>
            Login Now
          </Link>
          <Link to="/register" className="btn btn-secondary" style={{
            background: 'transparent',
            color: 'white',
            border: '2px solid white',
            textDecoration: 'none',
            padding: '0.75rem 2rem',
            borderRadius: '4px'
          }}>
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PublicDashboard;