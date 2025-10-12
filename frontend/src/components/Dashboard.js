import React, { useState, useEffect } from 'react';
import { reportAPI, complaintAPI, assignmentAPI, ratingAPI, generateAndDownloadReport, authAPI } from '../services/api';

const EnhancedDashboard = ({ user, onLogout }) => {
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
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    complaint_against_id: '',
    complaint_type: 'student_lecturer',
    priority: 'medium'
  });
  const [reportGenerationLoading, setReportGenerationLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadAvailableUsers();
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
          }
          break;

        case 'lecturer':
        case 'principal_lecturer':
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
          }
          break;

        default:
          console.warn('Unknown user role:', user.role);
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
        averageRating: (user.role === 'lecturer' || user.role === 'principal_lecturer') ? 
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

  const loadAvailableUsers = async () => {
    try {
      console.log('Loading available users for complaints...');
      
      // TRY DIFFERENT API ENDPOINTS IN ORDER
      let response;
      
      try {
        // First try the new complaint-specific endpoint
        response = await complaintAPI.getAvailableUsers();
        console.log('Users loaded from complaint API:', response.data);
      } catch (error) {
        console.log('Complaint API failed, trying auth API...');
        try {
          // Fallback to auth API
          response = await authAPI.getAvailableUsers();
          console.log('Users loaded from auth API:', response.data);
        } catch (authError) {
          console.log('Auth API failed, trying assignment API...');
          // Final fallback to assignment API
          response = await assignmentAPI.getLecturers();
          console.log('Users loaded from assignment API:', response.data);
        }
      }
      
      setAvailableUsers(response.data || []);
      
      if (response.data && response.data.length === 0) {
        console.warn('No users available for complaints');
      } else {
        console.log(`Successfully loaded ${response.data.length} users for complaints`);
      }
    } catch (error) {
      console.error('Error loading users for complaints:', error);
      // Set empty array as fallback
      setAvailableUsers([]);
    }
  };

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

  // Complaint Functions - UPDATED FOR ALL USERS
  const openComplaintModal = () => {
    setComplaintForm({
      title: '',
      description: '',
      complaint_against_id: '',
      complaint_type: 'student_lecturer',
      priority: 'medium'
    });
    setShowComplaintModal(true);
  };

  const closeComplaintModal = () => {
    setShowComplaintModal(false);
    setComplaintForm({
      title: '',
      description: '',
      complaint_against_id: '',
      complaint_type: 'student_lecturer',
      priority: 'medium'
    });
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    try {
      // Enhanced validation
      if (!complaintForm.title?.trim()) {
        alert('Please enter a complaint title');
        return;
      }
      if (!complaintForm.description?.trim()) {
        alert('Please enter a complaint description');
        return;
      }
      if (!complaintForm.complaint_against_id) {
        alert('Please select who you are complaining against');
        return;
      }

      const complaintData = {
        title: complaintForm.title.trim(),
        description: complaintForm.description.trim(),
        complaint_against_id: complaintForm.complaint_against_id,
        complaint_type: complaintForm.complaint_type,
        priority: complaintForm.priority
      };

      console.log('Submitting complaint:', complaintData);
      await complaintAPI.create(complaintData);
      
      await loadDashboardData();
      closeComplaintModal();
      
      alert('Complaint submitted successfully!');
    } catch (error) {
      console.error('Error submitting complaint:', error);
      alert('Failed to submit complaint: ' + (error.message || 'Please check all fields'));
    }
  };

  const handleComplaintChange = (field, value) => {
    setComplaintForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Report Generation Functions
  const handleGenerateReport = async (reportType, filters = {}) => {
    setReportGenerationLoading(true);
    try {
      let generateFunction;
      let filename;

      switch (reportType) {
        case 'performance':
          generateFunction = reportAPI.generatePerformanceReport;
          filename = `performance-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'attendance':
          generateFunction = reportAPI.generateAttendanceReport;
          filename = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'faculty':
          generateFunction = reportAPI.generateFacultyReport;
          filename = `faculty-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'assignment':
          generateFunction = assignmentAPI.generateAssignmentReport;
          filename = `assignment-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'complaint':
          generateFunction = complaintAPI.generateComplaintReport;
          filename = `complaint-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        default:
          throw new Error('Invalid report type');
      }

      const reportData = {
        ...filters,
        user_id: user.id,
        user_role: user.role,
        faculty: user.faculty
      };

      await generateAndDownloadReport(generateFunction, reportData, filename);
      alert('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      // Enhanced error handling for 404
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        alert('Report generation feature is currently unavailable. Please try again later.');
      } else {
        alert('Failed to generate report: ' + error.message);
      }
    } finally {
      setReportGenerationLoading(false);
    }
  };

  // Check if user can rate a specific report
  const canRateReport = (report) => {
    if (!report) return false;
    
    if (user.faculty && report.faculty === user.faculty) {
      return true;
    }
    
    if (user.role === 'student' && user.class_id && report.class_id === user.class_id) {
      return true;
    }
    
    if ((user.role === 'lecturer' || user.role === 'principal_lecturer') && (
      report.lecturer_id === user.id || 
      (user.faculty && report.faculty === user.faculty)
    )) {
      return true;
    }
    
    if (['pl', 'prl', 'fmg'].includes(user.role) && user.faculty && report.faculty === user.faculty) {
      return true;
    }
    
    return false;
  };

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
      case 'principal_lecturer': return 'Principal Lecturer Dashboard';
      case 'student': return 'Student Dashboard';
      default: return 'Dashboard';
    }
  };

  // UPDATED: Enhanced available targets for ALL users
  const getAvailableTargets = () => {
    // Filter out current user (can't complain against yourself)
    const filteredUsers = availableUsers.filter(u => u.id !== user.id);
    
    // Students can complain against lecturers, PRL, PL, FMG
    if (user.role === 'student') {
      return filteredUsers.filter(u => 
        ['lecturer', 'principal_lecturer', 'prl', 'pl', 'fmg'].includes(u.role)
      );
    }
    
    // Lecturers can complain against PRL, PL, FMG, other lecturers
    if (user.role === 'lecturer' || user.role === 'principal_lecturer') {
      return filteredUsers.filter(u => 
        ['prl', 'pl', 'fmg', 'lecturer', 'principal_lecturer'].includes(u.role)
      );
    }
    
    // PRL can complain against PL, FMG, other PRL
    if (user.role === 'prl') {
      return filteredUsers.filter(u => 
        ['pl', 'fmg', 'prl'].includes(u.role)
      );
    }
    
    // PL can complain against FMG, other PL
    if (user.role === 'pl') {
      return filteredUsers.filter(u => 
        ['fmg', 'pl'].includes(u.role)
      );
    }
    
    // FMG can complain against other FMG
    if (user.role === 'fmg') {
      return filteredUsers.filter(u => u.role === 'fmg');
    }
    
    return filteredUsers;
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
                      {star}
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

      {/* Complaint Modal - UPDATED FOR ALL USERS */}
      {showComplaintModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>File a Complaint</h3>
              <button onClick={closeComplaintModal} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleComplaintSubmit} className="complaint-form">
              <div className="form-group">
                <label>Title: *</label>
                <input
                  type="text"
                  value={complaintForm.title}
                  onChange={(e) => handleComplaintChange('title', e.target.value)}
                  placeholder="Enter complaint title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description: *</label>
                <textarea
                  value={complaintForm.description}
                  onChange={(e) => handleComplaintChange('description', e.target.value)}
                  placeholder="Describe your complaint in detail..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Complaint Against: *</label>
                <select 
                  value={complaintForm.complaint_against_id}
                  onChange={(e) => handleComplaintChange('complaint_against_id', e.target.value)}
                  required
                >
                  <option value="">Select Person</option>
                  {getAvailableTargets().map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.role.toUpperCase()}) - {person.faculty}
                    </option>
                  ))}
                </select>
                {getAvailableTargets().length === 0 && (
                  <p className="error-text" style={{color: '#e74c3c', fontSize: '0.8rem', marginTop: '0.5rem'}}>
                    No users available for complaints. Please try refreshing the page.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Complaint Type:</label>
                <select 
                  value={complaintForm.complaint_type}
                  onChange={(e) => handleComplaintChange('complaint_type', e.target.value)}
                >
                  <option value="student_lecturer">Against Lecturer</option>
                  <option value="lecturer_prl">Against Program Review Leader</option>
                  <option value="prl_pl">Against Program Leader</option>
                  <option value="pl_fmg">Against Faculty Management</option>
                  <option value="general">General Issue</option>
                </select>
              </div>

              <div className="form-group">
                <label>Priority:</label>
                <select 
                  value={complaintForm.priority}
                  onChange={(e) => handleComplaintChange('priority', e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeComplaintModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={getAvailableTargets().length === 0}
                >
                  {getAvailableTargets().length === 0 ? 'No Users Available' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div className="header-content">
          <h1>{getRoleSpecificTitle()}</h1>
          <p>Welcome back, {user.name}</p>
        </div>
        <div className="header-actions">
          <button onClick={loadDashboardData} className="btn btn-outline">
            Refresh Data
          </button>
          {/* UPDATED: File Complaint button visible to ALL users */}
          <button onClick={openComplaintModal} className="btn btn-primary">
            File Complaint
          </button>
          <button onClick={onLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3498db' }}></div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalReports}</h3>
            <p>Total Reports</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e74c3c' }}></div>
          <div className="stat-content">
            <h3>{dashboardData.stats.pendingReports}</h3>
            <p>Pending Reports</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f39c12' }}></div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalComplaints}</h3>
            <p>Total Complaints</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#9b59b6' }}></div>
          <div className="stat-content">
            <h3>{dashboardData.stats.pendingComplaints}</h3>
            <p>Pending Complaints</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#27ae60' }}></div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalRatings}</h3>
            <p>My Ratings</p>
          </div>
        </div>

        {(user.role === 'lecturer' || user.role === 'principal_lecturer') && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e67e22' }}></div>
            <div className="stat-content">
              <h3>{dashboardData.stats.averageRating.toFixed(1)}</h3>
              <p>Average Rating</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs - UPDATED FOR ALL USERS */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        
        {user.role === 'student' && (
          <>
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

            <button 
              className={`tab-btn ${activeTab === 'class-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('class-reports')}
            >
              Class Reports
            </button>
          </>
        )}

        {(user.role === 'lecturer' || user.role === 'principal_lecturer') && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'my-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-reports')}
            >
              My Reports
            </button>
            <button 
              className={`tab-btn ${activeTab === 'report-generation' ? 'active' : ''}`}
              onClick={() => setActiveTab('report-generation')}
            >
              Generate Reports
            </button>
          </>
        )}

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
              All Complaints
            </button>
            {user.role === 'pl' && (
              <button 
                className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                Assignments
              </button>
            )}
            <button 
              className={`tab-btn ${activeTab === 'report-generation' ? 'active' : ''}`}
              onClick={() => setActiveTab('report-generation')}
            >
              Generate Reports
            </button>
          </>
        )}

        {/* UPDATED: My Complaints tab visible to ALL users */}
        <button 
          className={`tab-btn ${activeTab === 'my-complaints' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-complaints')}
        >
          My Complaints
        </button>
      </div>

      {/* Tab Content - UPDATED FOR ALL USERS */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <OverviewTab 
            user={user} 
            data={dashboardData} 
            onRefresh={loadDashboardData}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
            onFileComplaint={openComplaintModal}
          />
        )}

        {activeTab === 'rate-lectures' && user.role === 'student' && (
          <RateLecturesTab 
            user={user}
            reports={dashboardData.reports}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}

        {activeTab === 'my-ratings' && user.role === 'student' && (
          <MyRatingsTab 
            ratings={dashboardData.ratings}
            user={user}
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

        {activeTab === 'my-complaints' && (
          <MyComplaintsTab 
            complaints={dashboardData.complaints}
            user={user}
            onNewComplaint={openComplaintModal}
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

        {activeTab === 'report-generation' && (user.role === 'pl' || user.role === 'prl' || user.role === 'lecturer' || user.role === 'principal_lecturer') && (
          <ReportGenerationTab 
            user={user}
            reports={dashboardData.reports}
            assignments={dashboardData.assignments}
            onGenerateReport={handleGenerateReport}
            loading={reportGenerationLoading}
          />
        )}

        {activeTab === 'my-reports' && (user.role === 'lecturer' || user.role === 'principal_lecturer') && (
          <MyReportsTab 
            reports={dashboardData.reports}
            onRateReport={openRatingModal}
            canRateReport={canRateReport}
            hasRatedReport={hasRatedReport}
          />
        )}
      </div>
    </div>
  );
};

// Report Generation Component
const ReportGenerationTab = ({ user, reports, assignments, onGenerateReport, loading }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    course_id: '',
    class_id: '',
    status: '',
    reportType: 'performance'
  });

  const getReportStats = () => {
    const filteredReports = reports.filter(report => {
      const matchesDate = (!filters.startDate || new Date(report.date_of_lecture) >= new Date(filters.startDate)) &&
                         (!filters.endDate || new Date(report.date_of_lecture) <= new Date(filters.endDate));
      const matchesStatus = !filters.status || report.status === filters.status;
      return matchesDate && matchesStatus;
    });

    return {
      total: filteredReports.length,
      approved: filteredReports.filter(r => r.status === 'approved').length,
      pending: filteredReports.filter(r => r.status.includes('pending')).length,
      averageAttendance: filteredReports.length ? 
        (filteredReports.reduce((sum, r) => sum + (r.students_present || 0), 0) / filteredReports.length).toFixed(1) : 0
    };
  };

  const stats = getReportStats();

  const handleGenerate = () => {
    onGenerateReport(filters.reportType, filters);
  };

  const getAvailableReportTypes = () => {
    const baseTypes = [
      { value: 'performance', label: 'Performance Report' },
      { value: 'attendance', label: 'Attendance Report' }
    ];

    if (user.role === 'prl' || user.role === 'pl') {
      baseTypes.push({ value: 'faculty', label: 'Faculty Overview' });
    }

    if (user.role === 'pl') {
      baseTypes.push({ value: 'assignment', label: 'Assignment Report' });
    }

    if (user.role === 'prl' || user.role === 'pl' || user.role === 'fmg') {
      baseTypes.push({ value: 'complaint', label: 'Complaint Report' });
    }

    return baseTypes;
  };

  return (
    <div className="report-generation-tab">
      <h2>Report Generation</h2>
      
      <div className="filters-section" style={{ 
        background: '#2c3e50', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '1px solid #34495e'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Report Configuration</h3>
        <div className="filter-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem' 
        }}>
          <div className="form-group">
            <label style={{ color: '#fff' }}>Report Type</label>
            <select 
              value={filters.reportType} 
              onChange={(e) => setFilters({...filters, reportType: e.target.value})}
            >
              {getAvailableReportTypes().map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label style={{ color: '#fff' }}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#fff' }}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#fff' }}>Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending_student">Pending Student</option>
              <option value="pending_prl">Pending PRL</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stats-section" style={{ marginBottom: '2rem' }}>
        <div className="stats-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem' 
        }}>
          <div className="stat-card" style={{ 
            background: '#3498db', 
            padding: '1rem', 
            borderRadius: '8px', 
            textAlign: 'center',
            color: 'white'
          }}>
            <h3>{stats.total}</h3>
            <p>Total Reports</p>
          </div>
          <div className="stat-card" style={{ 
            background: '#27ae60', 
            padding: '1rem', 
            borderRadius: '8px', 
            textAlign: 'center',
            color: 'white'
          }}>
            <h3>{stats.approved}</h3>
            <p>Approved</p>
          </div>
          <div className="stat-card" style={{ 
            background: '#e74c3c', 
            padding: '1rem', 
            borderRadius: '8px', 
            textAlign: 'center',
            color: 'white'
          }}>
            <h3>{stats.pending}</h3>
            <p>Pending</p>
          </div>
          <div className="stat-card" style={{ 
            background: '#f39c12', 
            padding: '1rem', 
            borderRadius: '8px', 
            textAlign: 'center',
            color: 'white'
          }}>
            <h3>{stats.averageAttendance}</h3>
            <p>Avg Attendance</p>
          </div>
        </div>
      </div>

      <div className="report-actions" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        <div className="report-card" style={{ 
          background: '#34495e', 
          padding: '2rem', 
          borderRadius: '8px', 
          textAlign: 'center',
          border: '1px solid #4a5f7a'
        }}>
          <h4 style={{ color: '#fff' }}>Generate Report</h4>
          <p style={{ color: '#bdc3c7', marginBottom: '1.5rem' }}>
            {filters.reportType === 'performance' && 'Detailed performance analysis with ratings and feedback'}
            {filters.reportType === 'attendance' && 'Student attendance statistics and trends'}
            {filters.reportType === 'faculty' && 'Complete faculty performance overview'}
            {filters.reportType === 'assignment' && 'Course and lecturer assignment overview'}
            {filters.reportType === 'complaint' && 'Complaint analysis and resolution statistics'}
          </p>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? 'Generating...' : `Generate ${filters.reportType.charAt(0).toUpperCase() + filters.reportType.slice(1)} Report`}
          </button>
        </div>

        <div className="report-info" style={{ 
          background: '#34495e', 
          padding: '2rem', 
          borderRadius: '8px',
          border: '1px solid #4a5f7a'
        }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>Report Information</h4>
          <div style={{ color: '#bdc3c7' }}>
            <p><strong>Report Type:</strong> {filters.reportType}</p>
            <p><strong>Date Range:</strong> {filters.startDate || 'Any'} to {filters.endDate || 'Any'}</p>
            <p><strong>Status Filter:</strong> {filters.status || 'All'}</p>
            <p><strong>Total Records:</strong> {stats.total} reports</p>
            <p><strong>User Role:</strong> {user.role}</p>
            <p><strong>Faculty:</strong> {user.faculty || 'All'}</p>
          </div>
        </div>
      </div>

      {user.role === 'pl' && assignments && assignments.length > 0 && (
        <div className="assignment-stats" style={{ 
          marginTop: '2rem', 
          background: '#2c3e50', 
          padding: '1.5rem', 
          borderRadius: '8px' 
        }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>Assignment Statistics</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '1rem',
            color: '#ecf0f1'
          }}>
            <div>
              <strong>Total Assignments:</strong> {assignments.length}
            </div>
            <div>
              <strong>Lecturer Assignments:</strong> {assignments.filter(a => a.assignment_type === 'regular').length}
            </div>
            <div>
              <strong>Principal Assignments:</strong> {assignments.filter(a => a.assignment_type === 'principal').length}
            </div>
            <div>
              <strong>Unique Courses:</strong> {new Set(assignments.map(a => a.course_id)).size}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Student Dashboard Tabs
const RateLecturesTab = ({ user, reports, onRateReport, canRateReport, hasRatedReport }) => {
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  const rateableReports = Array.isArray(reports) ? reports.filter(report => 
    canRateReport(report) && !hasRatedReport(report.id)
  ) : [];

  const faculties = [...new Set(rateableReports.map(report => report.faculty))];
  const courses = [...new Set(rateableReports.map(report => report.course_name))];

  const filteredReports = rateableReports.filter(report => {
    const matchesFaculty = !filterFaculty || report.faculty === filterFaculty;
    const matchesCourse = !filterCourse || report.course_name === filterCourse;
    return matchesFaculty && matchesCourse;
  });

  return (
    <div className="rate-lectures-tab">
      <div className="tab-header">
        <h2>Rate Lectures</h2>
        <p>Provide feedback on lectures in your faculty</p>
      </div>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MyRatingsTab = ({ ratings, user }) => {
  const ratingsArray = Array.isArray(ratings) ? ratings : [];

  return (
    <div className="my-ratings-tab">
      <h2>My Ratings</h2>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Lecturer</th>
              <th>Course</th>
              <th>Rating</th>
              <th>Type</th>
              <th>Comment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {ratingsArray.map(rating => (
              <tr key={rating.id}>
                <td>{rating.lecturer_name || 'N/A'}</td>
                <td>{rating.course_name || 'N/A'} - Week {rating.week_number || 'N/A'}</td>
                <td>
                  <span className="rating-stars">
                    {rating.rating_value}/5
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
              <th>Students Present</th>
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
                <td>{report.students_present}</td>
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

// UPDATED: MyComplaintsTab now works for ALL users
const MyComplaintsTab = ({ complaints, user, onNewComplaint }) => {
  const complaintsArray = Array.isArray(complaints) ? complaints : [];
  
  return (
    <div className="my-complaints-tab">
      <div className="tab-header">
        <h2>My Complaints</h2>
        <button onClick={onNewComplaint} className="btn btn-primary">
          File New Complaint
        </button>
      </div>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Against</th>
              <th>Date</th>
              <th>Status</th>
              <th>Response</th>
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
                <td>{complaint.response || 'No response yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {complaintsArray.length === 0 && (
          <div className="no-data">
            <p>No complaints found</p>
            <p className="subtext">File a complaint to see it here!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Other Tab Components
const OverviewTab = ({ user, data, onRefresh, onRateReport, canRateReport, hasRatedReport, onFileComplaint }) => {
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
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* UPDATED: File Complaint button visible to ALL users */}
          <button onClick={onFileComplaint} className="btn btn-primary">
            File Complaint
          </button>
          <button onClick={onRefresh} className="btn btn-secondary">
            Refresh Data
          </button>
        </div>
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
              <div className="activity-content">
                <p><strong>New Rating</strong> - {rating.rating_value} stars</p>
                <small>{rating.comment ? rating.comment.substring(0, 50) + '...' : 'No comment'} • {new Date(rating.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
          
          {Array.isArray(data.complaints) && data.complaints.slice(0, 3).map(complaint => (
            <div key={complaint.id} className="activity-item">
              <div className="activity-content">
                <p><strong>Complaint Filed</strong> - {complaint.title}</p>
                <small>Status: {complaint.status} • {new Date(complaint.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
          
          {((!Array.isArray(data.reports) || data.reports.length === 0) && 
            (!Array.isArray(data.ratings) || data.ratings.length === 0) &&
            (!Array.isArray(data.complaints) || data.complaints.length === 0)) && (
            <p className="no-data">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

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

const ComplaintsTab = ({ complaints, user }) => {
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

export default EnhancedDashboard;