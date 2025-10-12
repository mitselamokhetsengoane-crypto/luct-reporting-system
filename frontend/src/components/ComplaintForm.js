import React, { useState, useEffect } from 'react';
import { complaintAPI, assignmentAPI } from '../services/api';

const EnhancedComplaintForm = ({ user, onLogout }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    complaint_against_id: '',
    complaint_type: 'student_lecturer',
    priority: 'medium'
  });
  const [users, setUsers] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [complaintsForMe, setComplaintsForMe] = useState([]);
  const [allComplaints, setAllComplaints] = useState([]);
  const [activeTab, setActiveTab] = useState('file');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [responseText, setResponseText] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    type: '',
    dateRange: ''
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [usersResponse, myComplaintsResponse, forMeResponse, allComplaintsResponse] = await Promise.all([
        assignmentAPI.getLecturers(),
        complaintAPI.getMyComplaints(),
        complaintAPI.getComplaintsForMe(),
        complaintAPI.getAllComplaints()
      ]);

      setUsers(usersResponse.data);
      setMyComplaints(myComplaintsResponse.data);
      setComplaintsForMe(forMeResponse.data);
      setAllComplaints(allComplaintsResponse.data);
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

    // Validate not complaining against self
    if (formData.complaint_against_id === user.id) {
      setMessage('Cannot file complaint against yourself');
      setLoading(false);
      return;
    }

    try {
      await complaintAPI.create(formData);
      setMessage('Complaint filed successfully!');
      setFormData({
        title: '',
        description: '',
        complaint_against_id: '',
        complaint_type: 'student_lecturer',
        priority: 'medium'
      });
      loadData();
      setActiveTab('my-complaints');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error filing complaint');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (complaintId) => {
    if (!responseText.trim()) {
      alert('Please enter a response');
      return;
    }

    try {
      await complaintAPI.respond(complaintId, responseText);
      alert('Response submitted successfully!');
      setResponseText('');
      setSelectedComplaint(null);
      loadData();
    } catch (error) {
      alert('Error submitting response: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const handleSelectComplaint = (complaint) => {
    setSelectedComplaint(complaint);
    setResponseText(complaint.response || '');
  };

  const handleUpdateStatus = async (complaintId, status) => {
    try {
      await complaintAPI.updateComplaintStatus(complaintId, status);
      alert(`Complaint status updated to ${status}`);
      loadData();
    } catch (error) {
      alert('Error updating status');
    }
  };

  const generateComplaintReport = async (type = 'all') => {
    try {
      const response = await complaintAPI.generateComplaintReport({
        ...filters,
        report_type: type
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `complaints-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setMessage('Complaint report generated successfully!');
    } catch (error) {
      setMessage('Error generating complaint report');
    }
  };

  const getAvailableTargets = () => {
    switch (user.role) {
      case 'student':
        return users.filter(u => u.role === 'lecturer' || u.role === 'principal_lecturer');
      case 'lecturer':
      case 'principal_lecturer':
        return users.filter(u => u.role === 'prl' && u.id !== user.id);
      case 'prl':
        return users.filter(u => u.role === 'pl' && u.id !== user.id);
      case 'pl':
        return users.filter(u => u.role === 'fmg' && u.id !== user.id);
      default:
        return [];
    }
  };

  const getComplaintStats = () => {
    const filteredComplaints = allComplaints.filter(complaint => {
      const matchesStatus = !filters.status || complaint.status === filters.status;
      const matchesPriority = !filters.priority || complaint.priority === filters.priority;
      const matchesType = !filters.type || complaint.complaint_type === filters.type;
      return matchesStatus && matchesPriority && matchesType;
    });

    return {
      total: filteredComplaints.length,
      pending: filteredComplaints.filter(c => c.status === 'pending').length,
      inProgress: filteredComplaints.filter(c => c.status === 'in_progress').length,
      resolved: filteredComplaints.filter(c => c.status === 'resolved').length,
      highPriority: filteredComplaints.filter(c => c.priority === 'high' || c.priority === 'urgent').length
    };
  };

  const stats = getComplaintStats();

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { color: '#27ae60', label: 'Low' },
      medium: { color: '#f39c12', label: 'Medium' },
      high: { color: '#e74c3c', label: 'High' },
      urgent: { color: '#c0392b', label: 'Urgent' }
    };
    
    const config = priorityConfig[priority] || { color: '#95a5a6', label: priority };
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
    <div className="form-container">
      <div className="form-card">
        <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Enhanced Complaint Management</h2>
          <button 
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            Logout
          </button>
        </div>

        <div className="tab-navigation" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('file')}
            className={`btn ${activeTab === 'file' ? 'btn-primary' : 'btn-secondary'}`}
          >
            File Complaint
          </button>
          <button 
            onClick={() => setActiveTab('my-complaints')}
            className={`btn ${activeTab === 'my-complaints' ? 'btn-primary' : 'btn-secondary'}`}
          >
            My Complaints
          </button>
          <button 
            onClick={() => setActiveTab('for-me')}
            className={`btn ${activeTab === 'for-me' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Complaints For Me
          </button>
          {(user.role === 'pl' || user.role === 'prl' || user.role === 'fmg') && (
            <button 
              onClick={() => setActiveTab('manage')}
              className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Manage All
            </button>
          )}
          <button 
            onClick={() => setActiveTab('reports')}
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Reports
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {activeTab === 'file' && (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Complaint Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Brief description of the complaint"
                  required
                />
              </div>

              <div className="form-group">
                <label>Complaint Type</label>
                <select 
                  name="complaint_type" 
                  value={formData.complaint_type} 
                  onChange={handleChange}
                >
                  <option value="student_lecturer">Against Lecturer</option>
                  <option value="lecturer_prl">Against PRL</option>
                  <option value="prl_pl">Against Program Leader</option>
                  <option value="faculty_issue">Faculty Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select 
                  name="priority" 
                  value={formData.priority} 
                  onChange={handleChange}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Complaint Against</label>
                <select 
                  name="complaint_against_id" 
                  value={formData.complaint_against_id} 
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Person</option>
                  {getAvailableTargets().map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.role.toUpperCase()} - {person.faculty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Complaint Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="6"
                  placeholder="Provide detailed description of your complaint..."
                  required
                />
              </div>

              <div className="form-actions full-width">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Filing Complaint...' : 'File Complaint'}
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'my-complaints' && (
          <div className="data-table">
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>My Filed Complaints</h3>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Against</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {myComplaints.map(complaint => (
                  <tr key={complaint.id}>
                    <td>{complaint.title}</td>
                    <td>{complaint.complaint_against_name}</td>
                    <td>
                      <span className={`complaint-type ${complaint.complaint_type}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        background: '#3498db',
                        color: 'white'
                      }}>
                        {complaint.complaint_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{getPriorityBadge(complaint.priority)}</td>
                    <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-${complaint.status}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: complaint.status === 'resolved' ? '#27ae60' : 
                                   complaint.status === 'in_progress' ? '#f39c12' : '#e74c3c',
                        color: 'white'
                      }}>
                        {complaint.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {complaint.response ? (
                        <div>
                          <strong>Response:</strong> {complaint.response}
                          <br />
                          <small>on {new Date(complaint.responded_at).toLocaleDateString()}</small>
                        </div>
                      ) : (
                        <span style={{ color: '#f39c12', fontSize: '0.8rem' }}>Waiting for response</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myComplaints.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
                No complaints filed
              </div>
            )}
          </div>
        )}

        {activeTab === 'for-me' && (
          <div className="data-table">
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Complaints Requiring Your Response</h3>
            
            {selectedComplaint && (
              <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Response to: {selectedComplaint.title}</h4>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter your response to the selected complaint..."
                  rows="4"
                  style={{ 
                    width: '100%', 
                    marginBottom: '0.5rem', 
                    background: 'white', 
                    color: '#333', 
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '0.5rem'
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleRespond(selectedComplaint.id)}
                    className="btn btn-primary"
                    disabled={!responseText.trim()}
                  >
                    {selectedComplaint.status === 'resolved' ? 'Update Response' : 'Submit Response'}
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedComplaint(null);
                      setResponseText('');
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  {selectedComplaint.status !== 'resolved' && (
                    <button 
                      onClick={() => handleUpdateStatus(selectedComplaint.id, 'resolved')}
                      className="btn btn-success"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              </div>
            )}

            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Title</th>
                  <th>From</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {complaintsForMe.map(complaint => (
                  <tr key={complaint.id} style={{
                    background: selectedComplaint?.id === complaint.id ? '#f0f8ff' : 'transparent'
                  }}>
                    <td>
                      <input 
                        type="radio" 
                        name="selectedComplaint" 
                        checked={selectedComplaint?.id === complaint.id}
                        onChange={() => handleSelectComplaint(complaint)}
                      />
                    </td>
                    <td>{complaint.title}</td>
                    <td>{complaint.complainant_name}</td>
                    <td>
                      <span className={`complaint-type ${complaint.complaint_type}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        background: '#3498db',
                        color: 'white'
                      }}>
                        {complaint.complaint_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{getPriorityBadge(complaint.priority)}</td>
                    <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-${complaint.status}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: complaint.status === 'resolved' ? '#27ae60' : 
                                   complaint.status === 'in_progress' ? '#f39c12' : '#e74c3c',
                        color: 'white'
                      }}>
                        {complaint.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{complaint.description.substring(0, 100)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {complaintsForMe.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
                No complaints to respond to
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && (user.role === 'pl' || user.role === 'prl' || user.role === 'fmg') && (
          <div className="complaints-management">
            <div className="filters" style={{ marginBottom: '2rem' }}>
              <h3>Filter Complaints</h3>
              <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select value={filters.priority} onChange={(e) => setFilters({...filters, priority: e.target.value})}>
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}>
                  <option value="">All Types</option>
                  <option value="student_lecturer">Student vs Lecturer</option>
                  <option value="lecturer_prl">Lecturer vs PRL</option>
                  <option value="prl_pl">PRL vs PL</option>
                  <option value="faculty_issue">Faculty Issue</option>
                </select>
              </div>
            </div>

            <div className="data-table">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>From</th>
                    <th>Against</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allComplaints.filter(complaint => {
                    const matchesStatus = !filters.status || complaint.status === filters.status;
                    const matchesPriority = !filters.priority || complaint.priority === filters.priority;
                    const matchesType = !filters.type || complaint.complaint_type === filters.type;
                    return matchesStatus && matchesPriority && matchesType;
                  }).map(complaint => (
                    <tr key={complaint.id}>
                      <td>{complaint.title}</td>
                      <td>{complaint.complainant_name}</td>
                      <td>{complaint.complaint_against_name}</td>
                      <td>
                        <span className={`complaint-type ${complaint.complaint_type}`} style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          background: '#3498db',
                          color: 'white'
                        }}>
                          {complaint.complaint_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{getPriorityBadge(complaint.priority)}</td>
                      <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-${complaint.status}`} style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          background: complaint.status === 'resolved' ? '#27ae60' : 
                                     complaint.status === 'in_progress' ? '#f39c12' : '#e74c3c',
                          color: 'white'
                        }}>
                          {complaint.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleSelectComplaint(complaint)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            Respond
                          </button>
                          {complaint.status !== 'resolved' && (
                            <button 
                              onClick={() => handleUpdateStatus(complaint.id, 'resolved')}
                              className="btn btn-success btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="complaint-reports">
            <h3>Complaint Reports & Analytics</h3>
            
            <div className="stats-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem', 
              marginBottom: '2rem' 
            }}>
              <div className="stat-card" style={{ 
                background: '#e74c3c', 
                padding: '1rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: 'white'
              }}>
                <h3>{stats.total}</h3>
                <p>Total Complaints</p>
              </div>
              <div className="stat-card" style={{ 
                background: '#f39c12', 
                padding: '1rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: 'white'
              }}>
                <h3>{stats.pending}</h3>
                <p>Pending</p>
              </div>
              <div className="stat-card" style={{ 
                background: '#3498db', 
                padding: '1rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: 'white'
              }}>
                <h3>{stats.inProgress}</h3>
                <p>In Progress</p>
              </div>
              <div className="stat-card" style={{ 
                background: '#27ae60', 
                padding: '1rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: 'white'
              }}>
                <h3>{stats.resolved}</h3>
                <p>Resolved</p>
              </div>
              <div className="stat-card" style={{ 
                background: '#c0392b', 
                padding: '1rem', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: 'white'
              }}>
                <h3>{stats.highPriority}</h3>
                <p>High Priority</p>
              </div>
            </div>

            <div className="report-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => generateComplaintReport('all')} className="btn btn-primary">
                Generate Comprehensive Report
              </button>
              <button onClick={() => generateComplaintReport('monthly')} className="btn btn-secondary">
                Monthly Summary
              </button>
              <button onClick={() => generateComplaintReport('priority')} className="btn btn-secondary">
                Priority Analysis
              </button>
            </div>

            <div className="report-info" style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              background: '#f8f9fa', 
              borderRadius: '8px' 
            }}>
              <h4>Report Information</h4>
              <p><strong>Current Filters:</strong></p>
              <ul>
                <li>Status: {filters.status || 'All'}</li>
                <li>Priority: {filters.priority || 'All'}</li>
                <li>Type: {filters.type || 'All'}</li>
              </ul>
              <p><strong>Total Records:</strong> {stats.total} complaints</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedComplaintForm;