import React, { useState, useEffect } from 'react';
import { assignmentAPI, reportAPI } from '../services/api';

const EnhancedAssignmentForm = ({ user }) => {
  const [formData, setFormData] = useState({
    course_id: '',
    lecturer_id: '',
    class_id: '',
    assignment_type: 'regular'
  });
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [principalLecturers, setPrincipalLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('assign');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [coursesResponse, lecturersResponse, classesResponse, assignmentsResponse] = await Promise.all([
        assignmentAPI.getCourses(),
        assignmentAPI.getLecturers(),
        assignmentAPI.getClasses(),
        assignmentAPI.getAllAssignments()
      ]);

      setCourses(coursesResponse.data);
      setLecturers(lecturersResponse.data.filter(l => l.role === 'lecturer'));
      setPrincipalLecturers(lecturersResponse.data.filter(l => l.role === 'prl'));
      setClasses(classesResponse.data);
      setAssignments(assignmentsResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data');
    }
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
      await assignmentAPI.assignCourse(formData);
      setMessage('Assignment created successfully!');
      setFormData({
        course_id: '',
        lecturer_id: '',
        class_id: '',
        assignment_type: 'regular'
      });
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error creating assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await assignmentAPI.deleteAssignment(assignmentId);
        setMessage('Assignment deleted successfully!');
        loadData();
      } catch (error) {
        setMessage('Error deleting assignment');
      }
    }
  };

  const generateAssignmentReport = async (type = 'all') => {
    try {
      const response = await assignmentAPI.generateAssignmentReport(type);
      
      // Create and download CSV file
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignments-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage(`${type} assignment report generated successfully!`);
    } catch (error) {
      setMessage('Error generating report');
    }
  };

  const getAssignmentStats = () => {
    return {
      total: assignments.length,
      lecturer: assignments.filter(a => a.assignment_type === 'regular').length,
      principal: assignments.filter(a => a.assignment_type === 'principal').length,
      uniqueCourses: new Set(assignments.map(a => a.course_id)).size,
      uniqueClasses: new Set(assignments.map(a => a.class_id)).size
    };
  };

  const stats = getAssignmentStats();

  return (
    <div className="form-container">
      <div className="form-card">
        <h2>Course and Class Management</h2>

        <div className="tab-navigation" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('assign')}
            className={`btn ${activeTab === 'assign' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Assign Courses
          </button>
          <button 
            onClick={() => setActiveTab('view')}
            className={`btn ${activeTab === 'view' ? 'btn-primary' : 'btn-secondary'}`}
          >
            View Assignments
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Generate Reports
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {activeTab === 'assign' && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Assignment Type</label>
                <select name="assignment_type" value={formData.assignment_type} onChange={handleChange} required>
                  <option value="regular">Regular Lecturer</option>
                  <option value="principal">Principal Lecturer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Course</label>
                <select name="course_id" value={formData.course_id} onChange={handleChange} required>
                  <option value="">Select Course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_name} ({course.course_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  {formData.assignment_type === 'regular' ? 'Lecturer' : 'Principal Lecturer'}
                </label>
                <select name="lecturer_id" value={formData.lecturer_id} onChange={handleChange} required>
                  <option value="">Select {formData.assignment_type === 'regular' ? 'Lecturer' : 'Principal Lecturer'}</option>
                  {(formData.assignment_type === 'regular' ? lecturers : principalLecturers).map(lecturer => (
                    <option key={lecturer.id} value={lecturer.id}>
                      {lecturer.name} ({lecturer.faculty})
                    </option>
                  ))}
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

              <div className="form-actions full-width">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Assigning...' : 'Assign Course'}
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'view' && (
          <div>
            <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Current Assignments</h3>
            <div className="data-table">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Lecturer</th>
                    <th>Class</th>
                    <th>Faculty</th>
                    <th>Assigned By</th>
                    <th>Date Assigned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(assignment => (
                    <tr key={assignment.id}>
                      <td>{assignment.course_name} ({assignment.course_code})</td>
                      <td>
                        <span className={`assignment-type ${assignment.assignment_type}`} style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          background: assignment.assignment_type === 'principal' ? '#e67e22' : '#3498db',
                          color: 'white'
                        }}>
                          {assignment.assignment_type === 'principal' ? 'Principal' : 'Regular'}
                        </span>
                      </td>
                      <td>{assignment.lecturer_name}</td>
                      <td>{assignment.class_name}</td>
                      <td>{assignment.faculty}</td>
                      <td>{assignment.assigned_by_name}</td>
                      <td>{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assignments.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
                  No assignments found
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-section">
            <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Generate Assignment Reports</h3>
            
            <div className="report-options" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '1rem', 
              marginBottom: '2rem' 
            }}>
              <div className="report-card" style={{ 
                background: '#2c3e50', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                border: '1px solid #34495e'
              }}>
                <h4>All Assignments</h4>
                <p style={{ color: '#bdc3c7', marginBottom: '1rem' }}>Complete assignment report</p>
                <button 
                  onClick={() => generateAssignmentReport('all')}
                  className="btn btn-primary"
                >
                  Generate Report
                </button>
              </div>
              
              <div className="report-card" style={{ 
                background: '#2c3e50', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                border: '1px solid #34495e'
              }}>
                <h4>Lecturer Assignments</h4>
                <p style={{ color: '#bdc3c7', marginBottom: '1rem' }}>Regular lecturer assignments only</p>
                <button 
                  onClick={() => generateAssignmentReport('lecturer')}
                  className="btn btn-primary"
                >
                  Generate Report
                </button>
              </div>
              
              <div className="report-card" style={{ 
                background: '#2c3e50', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                border: '1px solid #34495e'
              }}>
                <h4>Principal Lecturer</h4>
                <p style={{ color: '#bdc3c7', marginBottom: '1rem' }}>Principal lecturer assignments only</p>
                <button 
                  onClick={() => generateAssignmentReport('principal')}
                  className="btn btn-primary"
                >
                  Generate Report
                </button>
              </div>
            </div>

            <div className="report-stats" style={{ 
              background: '#34495e', 
              padding: '1.5rem', 
              borderRadius: '8px',
              border: '1px solid #4a5f7a'
            }}>
              <h4 style={{ marginBottom: '1rem', color: '#fff' }}>Assignment Statistics</h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                color: '#ecf0f1'
              }}>
                <div className="stat-item">
                  <strong>Total Assignments:</strong> {stats.total}
                </div>
                <div className="stat-item">
                  <strong>Lecturer Assignments:</strong> {stats.lecturer}
                </div>
                <div className="stat-item">
                  <strong>Principal Assignments:</strong> {stats.principal}
                </div>
                <div className="stat-item">
                  <strong>Unique Courses:</strong> {stats.uniqueCourses}
                </div>
                <div className="stat-item">
                  <strong>Unique Classes:</strong> {stats.uniqueClasses}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAssignmentForm;