import React, { useState, useEffect } from 'react';
import { complaintAPI, assignmentAPI } from '../services/api';

const ComplaintForm = ({ user, onLogout }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    complaint_against_id: '',
    complaint_type: 'student_lecturer'
  });
  const [users, setUsers] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [complaintsForMe, setComplaintsForMe] = useState([]);
  const [activeTab, setActiveTab] = useState('file');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [responseText, setResponseText] = useState(''); // Single response state
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [usersResponse, myComplaintsResponse, forMeResponse] = await Promise.all([
        assignmentAPI.getLecturers(),
        complaintAPI.getMyComplaints(),
        complaintAPI.getComplaintsForMe()
      ]);

      setUsers(usersResponse.data);
      setMyComplaints(myComplaintsResponse.data);
      setComplaintsForMe(forMeResponse.data);
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
        complaint_type: 'student_lecturer'
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
      setResponseText(''); // Clear response text
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

  const getAvailableTargets = () => {
    switch (user.role) {
      case 'student':
        return users.filter(u => u.role === 'lecturer');
      case 'lecturer':
        return users.filter(u => u.role === 'prl' && u.id !== user.id);
      case 'prl':
        return users.filter(u => u.role === 'pl' && u.id !== user.id);
      case 'pl':
        return users.filter(u => u.role === 'fmg' && u.id !== user.id);
      default:
        return [];
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Complaint Management</h2>
          <button 
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            Logout
          </button>
        </div>

        <div className="tab-navigation" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
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
                    <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-${complaint.status}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: complaint.status === 'resolved' ? '#27ae60' : 
                                   complaint.status === 'pending' ? '#f39c12' : '#e74c3c',
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
            
            {/* Global Response Input */}
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                </div>
              </div>
            )}

            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Title</th>
                  <th>From</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Current Status</th>
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
                    <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                    <td>{complaint.description}</td>
                    <td>
                      <span className={`status-${complaint.status}`} style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: complaint.status === 'resolved' ? '#27ae60' : '#f39c12',
                        color: 'white'
                      }}>
                        {complaint.status.toUpperCase()}
                      </span>
                    </td>
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
      </div>
    </div>
  );
};

export default ComplaintForm;