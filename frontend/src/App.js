import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PublicDashboard from './components/PublicDashboard';
import ReportForm from './components/ReportForm';
import ComplaintForm from './components/ComplaintForm';
import AssignmentForm from './components/AssignmentForm';
import RatingSystem from './components/RatingSystem';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/auth/me',
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-content">
            <h1 className="header-title">LUCT Reporting System</h1> 
          </div>
          {user && (
            <div className="user-info">
              <span>Welcome, {user.name} ({user.role.toUpperCase()})</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          )}
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<PublicDashboard />} />
            <Route 
              path="/login" 
              element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/report" 
              element={user ? <ReportForm user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/complaint" 
              element={user ? <ComplaintForm user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/assignments" 
              element={user && user.role === 'pl' ? <AssignmentForm user={user} /> : <Navigate to="/dashboard" />} 
            />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <p>&copy; 2025 Limkokwing University of Creative Technology - Lesotho. All rights reserved.</p>
            <p>LUCT Reporting System v1.0</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;