import React, { useState, useEffect } from 'react';
import { assignmentAPI } from '../services/api';

const AssignmentForm = ({ user }) => {
  const [formData, setFormData] = useState({
    course_id: '',
    lecturer_id: '',
    class_id: ''
  });
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [coursesResponse, lecturersResponse, classesResponse, assignmentsResponse] = await Promise.all([
        assignmentAPI.getCourses(),
        assignmentAPI.getLecturers(),
        assignmentAPI.getClasses(),
        assignmentAPI.getMyAssignments()
      ]);

      setCourses(coursesResponse.data);
      setLecturers(lecturersResponse.data);
      setClasses(classesResponse.data);
      setAssignments(assignmentsResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
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
      setMessage('Course assigned successfully!');
      setFormData({
        course_id: '',
        lecturer_id: '',
        class_id: ''
      });
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error assigning course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <h2>Course and Class Assignments</h2>

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <div className="form-grid">
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
              <label>Lecturer</label>
              <select name="lecturer_id" value={formData.lecturer_id} onChange={handleChange} required>
                <option value="">Select Lecturer</option>
                {lecturers.map(lecturer => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name} ({lecturer.role.toUpperCase()})
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

        <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Current Assignments</h3>
        <div className="data-table">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Course</th>
                <th>Lecturer</th>
                <th>Class</th>
                <th>Assigned By</th>
                <th>Date Assigned</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(assignment => (
                <tr key={assignment.id}>
                  <td>{assignment.course_name} ({assignment.course_code})</td>
                  <td>{assignment.lecturer_name}</td>
                  <td>{assignment.class_name}</td>
                  <td>{assignment.assigned_by_name}</td>
                  <td>{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && <div style={{ padding: '2rem', textAlign: 'center' }}>No assignments found</div>}
        </div>
      </div>
    </div>
  );
};

export default AssignmentForm;