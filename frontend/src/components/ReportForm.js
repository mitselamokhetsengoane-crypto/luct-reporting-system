import React, { useState, useEffect } from 'react';
import { reportAPI, assignmentAPI, ratingAPI } from '../services/api';
import RatingSystem from './RatingSystem';

const ReportForm = ({ user, onLogout }) => {
  const [formData, setFormData] = useState({
    faculty: user.faculty,
    class_id: '',
    week_number: '',
    date_of_lecture: '',
    course_id: '',
    students_present: '',
    venue: '',
    scheduled_time: '',
    topic_taught: '',
    learning_outcomes: '',
    recommendations: ''
  });
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [ratings, setRatings] = useState([]);
  const [showRatingForm, setShowRatingForm] = useState(false);

  useEffect(() => {
    loadFormData();
    if (user.role === 'student') {
      loadClassReports();
    } else {
      loadMyReports();
    }
  }, [user]);

  useEffect(() => {
    if (selectedReport) {
      loadReportRatings(selectedReport.id);
    }
  }, [selectedReport]);

  const loadFormData = async () => {
    try {
      const [classesResponse, coursesResponse, assignmentsResponse] = await Promise.all([
        assignmentAPI.getClasses(),
        assignmentAPI.getCourses(),
        user.role !== 'student' ? assignmentAPI.getMyAssignments() : Promise.resolve({ data: [] })
      ]);

      setClasses(classesResponse.data);
      setCourses(coursesResponse.data);
      setMyAssignments(assignmentsResponse.data);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const loadMyReports = async () => {
    try {
      const response = await reportAPI.getMyReports();
      setReports(response.data);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const loadClassReports = async () => {
    try {
      const response = await reportAPI.getClassReports(user.class_id);
      setReports(response.data);
    } catch (error) {
      console.error('Error loading class reports:', error);
    }
  };

  const loadPendingApprovalReports = async () => {
    try {
      const response = await reportAPI.getPendingApprovalReports();
      setReports(response.data);
    } catch (error) {
      console.error('Error loading pending reports:', error);
    }
  };

  const loadReportRatings = async (reportId) => {
    try {
      const response = await ratingAPI.getReportRatings(reportId);
      setRatings(response.data);
    } catch (error) {
      console.error('Error loading ratings:', error);
    }
  };

  const handleViewReportDetails = async (reportId) => {
    try {
      const response = await reportAPI.getReportById(reportId);
      setSelectedReport(response.data);
      setViewMode('details');
    } catch (error) {
      setMessage('Error loading report details: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedReport(null);
    setShowRatingForm(false);
    setRatings([]);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await reportAPI.create(formData);
      setMessage('Report created successfully! Sent to students for signing.');
      setFormData({
        faculty: user.faculty,
        class_id: '',
        week_number: '',
        date_of_lecture: '',
        course_id: '',
        students_present: '',
        venue: '',
        scheduled_time: '',
        topic_taught: '',
        learning_outcomes: '',
        recommendations: ''
      });
      loadMyReports();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error creating report');
    } finally {
      setLoading(false);
    }
  };

  const handleSignReport = async (reportId) => {
    if (window.confirm('Are you sure you want to sign this report? This confirms the topics were taught and attendance is correct.')) {
      try {
        const signature = `Signed by ${user.name} (${user.email}) on ${new Date().toLocaleDateString()}`;
        await reportAPI.signReport(reportId, signature);
        setMessage('Report signed successfully! Sent to PRL for approval.');
        
        if (user.role === 'student') {
          loadClassReports();
        } else {
          loadMyReports();
        }
      } catch (error) {
        setMessage('Error signing report: ' + (error.response?.data?.message || 'Unknown error'));
      }
    }
  };

  const handleApproveReport = async (reportId) => {
    if (window.confirm('Are you sure you want to approve this report?')) {
      try {
        await reportAPI.approveReport(reportId);
        setMessage('Report approved successfully!');
        
        if (activeTab === 'pending-approval') {
          loadPendingApprovalReports();
        } else {
          loadMyReports();
        }
      } catch (error) {
        setMessage('Error approving report: ' + (error.response?.data?.message || 'Unknown error'));
      }
    }
  };

  const handleRatingSubmitted = () => {
    setShowRatingForm(false);
    if (selectedReport) {
      loadReportRatings(selectedReport.id);
    }
  };

  const availableCourses = user.role === 'student' 
    ? courses 
    : courses.filter(course => 
        myAssignments.some(assignment => assignment.course_id === course.id)
      );

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: '#95a5a6' },
      pending_student: { label: 'Pending Student Sign', color: '#f39c12' },
      pending_prl: { label: 'Pending PRL Approval', color: '#e67e22' },
      approved: { label: 'Approved', color: '#27ae60' }
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

  const renderReportDetails = () => {
    if (!selectedReport) return null;

    return (
      <div className="report-details">
        <div className="details-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3>Report Details</h3>
          <button onClick={handleBackToList} className="btn btn-secondary">
            Back to List
          </button>
        </div>

        <div className="details-card" style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '8px' }}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="detail-group">
              <label className="detail-label">Course</label>
              <p className="detail-value">{selectedReport.course_name} ({selectedReport.course_code})</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Class</label>
              <p className="detail-value">{selectedReport.class_name}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Faculty</label>
              <p className="detail-value">{selectedReport.faculty}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Week Number</label>
              <p className="detail-value">Week {selectedReport.week_number}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Date of Lecture</label>
              <p className="detail-value">{new Date(selectedReport.date_of_lecture).toLocaleDateString()}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Scheduled Time</label>
              <p className="detail-value">{selectedReport.scheduled_time}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Venue</label>
              <p className="detail-value">{selectedReport.venue}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Students Present</label>
              <p className="detail-value">{selectedReport.students_present}</p>
            </div>

            <div className="detail-group">
              <label className="detail-label">Status</label>
              <p className="detail-value">{getStatusBadge(selectedReport.status)}</p>
            </div>

            {selectedReport.lecturer_name && (
              <div className="detail-group">
                <label className="detail-label">Lecturer</label>
                <p className="detail-value">{selectedReport.lecturer_name}</p>
              </div>
            )}

            {selectedReport.student_signature && (
              <div className="detail-group">
                <label className="detail-label">Student Signature</label>
                <p className="detail-value" style={{ fontStyle: 'italic', color: '#27ae60' }}>
                  {selectedReport.student_signature}
                </p>
              </div>
            )}

            {selectedReport.signed_at && (
              <div className="detail-group">
                <label className="detail-label">Signed At</label>
                <p className="detail-value">{new Date(selectedReport.signed_at).toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="full-details" style={{ marginTop: '2rem' }}>
            <div className="detail-group full-width">
              <label className="detail-label">Topic Taught</label>
              <div className="detail-value" style={{ 
                background: 'white', 
                padding: '1rem', 
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                {selectedReport.topic_taught}
              </div>
            </div>

            <div className="detail-group full-width" style={{ marginTop: '1rem' }}>
              <label className="detail-label">Learning Outcomes</label>
              <div className="detail-value" style={{ 
                background: 'white', 
                padding: '1rem', 
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                {selectedReport.learning_outcomes}
              </div>
            </div>

            {selectedReport.recommendations && (
              <div className="detail-group full-width" style={{ marginTop: '1rem' }}>
                <label className="detail-label">Recommendations</label>
                <div className="detail-value" style={{ 
                  background: 'white', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}>
                  {selectedReport.recommendations}
                </div>
              </div>
            )}
          </div>

          {/* Ratings Section */}
          <div className="ratings-section" style={{ marginTop: '2rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4>Ratings & Feedback</h4>
              {user.role === 'student' && !showRatingForm && (
                <button 
                  onClick={() => setShowRatingForm(true)}
                  className="btn btn-primary"
                >
                  Add Rating
                </button>
              )}
            </div>

            {showRatingForm && (
              <RatingSystem 
                reportId={selectedReport.id}
                lecturerId={selectedReport.lecturer_id}
                user={user}
                onRatingSubmitted={handleRatingSubmitted}
              />
            )}

            <div className="ratings-list">
              {ratings.map(rating => (
                <div key={rating.id} className="rating-item">
                  <div className="rating-header">
                    <strong>{rating.user_name}</strong>
                    <span className="rating-stars">
                      {'⭐'.repeat(rating.rating_value)}
                    </span>
                    <small>{new Date(rating.created_at).toLocaleDateString()}</small>
                  </div>
                  <p className="rating-type">Type: {rating.rating_type.replace('_', ' ')}</p>
                  {rating.comment && (
                    <p className="rating-comment">"{rating.comment}"</p>
                  )}
                </div>
              ))}
              
              {ratings.length === 0 && (
                <p className="no-ratings">No ratings yet</p>
              )}
            </div>
          </div>

          {/* Action buttons based on user role and report status */}
          <div className="details-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            {user.role === 'student' && selectedReport.status === 'pending_student' && (
              <button 
                onClick={() => handleSignReport(selectedReport.id)}
                className="btn btn-primary"
              >
                Sign Report
              </button>
            )}
            {(user.role === 'prl' || user.role === 'pl') && selectedReport.status === 'pending_prl' && (
              <button 
                onClick={() => handleApproveReport(selectedReport.id)}
                className="btn btn-primary"
              >
                Approve Report
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Report Management</h2>
          <button 
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            Logout
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {viewMode === 'details' ? (
          renderReportDetails()
        ) : (
          <>
            <div className="tab-navigation" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setActiveTab('create')}
                className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {user.role === 'student' ? 'View Reports' : 'Create Report'}
              </button>
              <button 
                onClick={() => setActiveTab('my-reports')}
                className={`btn ${activeTab === 'my-reports' ? 'btn-primary' : 'btn-secondary'}`}
              >
                My Reports
              </button>
              {(user.role === 'prl' || user.role === 'pl') && (
                <button 
                  onClick={() => {
                    setActiveTab('pending-approval');
                    loadPendingApprovalReports();
                  }}
                  className={`btn ${activeTab === 'pending-approval' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Pending Approval
                </button>
              )}
            </div>

            {activeTab === 'create' && user.role !== 'student' && (
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Faculty</label>
                    <select name="faculty" value={formData.faculty} onChange={handleChange} required>
                      <option value="FICT">FICT</option>
                      <option value="FBMG">FBMG</option>
                      <option value="FENG">FENG</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Class</label>
                    <select name="class_id" value={formData.class_id} onChange={handleChange} required>
                      <option value="">Select Class</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Week Number</label>
                    <input
                      type="number"
                      name="week_number"
                      value={formData.week_number}
                      onChange={handleChange}
                      min="1"
                      max="52"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Date of Lecture</label>
                    <input
                      type="date"
                      name="date_of_lecture"
                      value={formData.date_of_lecture}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Course</label>
                    <select name="course_id" value={formData.course_id} onChange={handleChange} required>
                      <option value="">Select Course</option>
                      {availableCourses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.course_name} ({course.course_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Students Present</label>
                    <input
                      type="number"
                      name="students_present"
                      value={formData.students_present}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Venue</label>
                    <input
                      type="text"
                      name="venue"
                      value={formData.venue}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Scheduled Time</label>
                    <input
                      type="time"
                      name="scheduled_time"
                      value={formData.scheduled_time}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Topic Taught</label>
                    <textarea
                      name="topic_taught"
                      value={formData.topic_taught}
                      onChange={handleChange}
                      rows="3"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Learning Outcomes</label>
                    <textarea
                      name="learning_outcomes"
                      value={formData.learning_outcomes}
                      onChange={handleChange}
                      rows="3"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Recommendations</label>
                    <textarea
                      name="recommendations"
                      value={formData.recommendations}
                      onChange={handleChange}
                      rows="3"
                    />
                  </div>

                  <div className="form-actions full-width">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Creating Report...' : 'Create Report'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'create' && user.role === 'student' && (
              <ClassReportsView 
                user={user} 
                reports={reports} 
                onSignReport={handleSignReport}
                onViewDetails={handleViewReportDetails}
              />
            )}

            {activeTab === 'my-reports' && (
              <ReportsListView 
                reports={reports} 
                user={user}
                onSignReport={handleSignReport}
                onApproveReport={handleApproveReport}
                onViewDetails={handleViewReportDetails}
              />
            )}

            {activeTab === 'pending-approval' && (user.role === 'prl' || user.role === 'pl') && (
              <PendingApprovalView 
                user={user}
                reports={reports}
                onApproveReport={handleApproveReport}
                onViewDetails={handleViewReportDetails}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Component for students to view and sign reports
const ClassReportsView = ({ user, reports, onSignReport, onViewDetails }) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: '#95a5a6' },
      pending_student: { label: 'Pending Student Sign', color: '#f39c12' },
      pending_prl: { label: 'Pending PRL Approval', color: '#e67e22' },
      approved: { label: 'Approved', color: '#27ae60' }
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

  return (
    <div className="data-table">
      <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Class Reports - Signing Required</h3>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Course</th>
            <th>Week</th>
            <th>Date</th>
            <th>Students Present</th>
            <th>Topic</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.id}>
              <td>{report.course_name}</td>
              <td>Week {report.week_number}</td>
              <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
              <td>{report.students_present}</td>
              <td>{report.topic_taught.substring(0, 50)}...</td>
              <td>{getStatusBadge(report.status)}</td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => onViewDetails(report.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    View Details
                  </button>
                  {report.status === 'pending_student' && (
                    <button 
                      onClick={() => onSignReport(report.id)}
                      className="btn btn-primary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      Sign Report
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
          No reports found for your class
        </div>
      )}
    </div>
  );
};

// Component for viewing reports list
const ReportsListView = ({ reports, user, onSignReport, onApproveReport, onViewDetails }) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: '#95a5a6' },
      pending_student: { label: 'Pending Student Sign', color: '#f39c12' },
      pending_prl: { label: 'Pending PRL Approval', color: '#e67e22' },
      approved: { label: 'Approved', color: '#27ae60' }
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

  return (
    <div className="data-table">
      <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>
        {user.role === 'student' ? 'Class Reports' : 'My Reports'}
      </h3>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Course</th>
            <th>Class</th>
            <th>Week</th>
            <th>Date</th>
            <th>Students</th>
            <th>Status</th>
            <th>Next Step</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.id}>
              <td>{report.course_name}</td>
              <td>{report.class_name}</td>
              <td>Week {report.week_number}</td>
              <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
              <td>{report.students_present}</td>
              <td>{getStatusBadge(report.status)}</td>
              <td>
                {report.status === 'draft' && 'Submit for student signing'}
                {report.status === 'pending_student' && 'Waiting for student signature'}
                {report.status === 'pending_prl' && 'Waiting for PRL approval'}
                {report.status === 'approved' && 'Completed'}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => onViewDetails(report.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    View Details
                  </button>
                  {user.role === 'student' && report.status === 'pending_student' && (
                    <button 
                      onClick={() => onSignReport(report.id)}
                      className="btn btn-primary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      Sign
                    </button>
                  )}
                  {(user.role === 'prl' || user.role === 'pl') && report.status === 'pending_prl' && (
                    <button 
                      onClick={() => onApproveReport(report.id)}
                      className="btn btn-primary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      Approve
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
          No reports found
        </div>
      )}
    </div>
  );
};

// Component for PRL/PL to view pending approval reports
const PendingApprovalView = ({ user, reports, onApproveReport, onViewDetails }) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_prl: { label: 'Pending Your Approval', color: '#e67e22' }
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

  return (
    <div className="data-table">
      <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Reports Pending Your Approval</h3>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Course</th>
            <th>Class</th>
            <th>Lecturer</th>
            <th>Week</th>
            <th>Date</th>
            <th>Students</th>
            <th>Topic</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.id}>
              <td>{report.course_name}</td>
              <td>{report.class_name}</td>
              <td>{report.lecturer_name}</td>
              <td>Week {report.week_number}</td>
              <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
              <td>{report.students_present}</td>
              <td>{report.topic_taught.substring(0, 50)}...</td>
              <td>{getStatusBadge(report.status)}</td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => onViewDetails(report.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    View Details
                  </button>
                  <button 
                    onClick={() => onApproveReport(report.id)}
                    className="btn btn-primary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    Approve
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
          No reports pending your approval
        </div>
      )}
    </div>
  );
};

export default ReportForm;