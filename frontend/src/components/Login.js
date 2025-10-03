import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    faculty: 'FICT',
    class_id: ''
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isLogin) {
      loadClasses();
    }
  }, [isLogin]);

  const loadClasses = async () => {
    try {
      const response = await authAPI.getClasses();
      setClasses(response.data);
    } catch (error) {
      console.error('Error loading classes:', error);
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
      let response;
      if (isLogin) {
        response = await authAPI.login({
          email: formData.email,
          password: formData.password
        });
      } else {
        response = await authAPI.register(formData);
      }

      localStorage.setItem('token', response.data.token);
      onLogin(response.data.user);
      setMessage(isLogin ? 'Login successful!' : 'Registration successful!');
    } catch (error) {
      setMessage(error.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{isLogin ? 'Login' : 'Register'} - LUCT Reporting System</h2>
        
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {!isLogin && (
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
        )}

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>

        {!isLogin && (
          <>
            <div className="form-group">
              <label>Role</label>
              <select name="role" value={formData.role} onChange={handleChange} required>
                <option value="student">Student (Class Rep)</option>
                <option value="lecturer">Lecturer</option>
                <option value="prl">Principal Lecturer (PRL)</option>
                <option value="pl">Program Leader (PL)</option>
                <option value="fmg">Faculty Management (FMG)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Faculty</label>
              <select name="faculty" value={formData.faculty} onChange={handleChange} required>
                <option value="FICT">FICT - Faculty of Information Communication Technology</option>
                <option value="FBMG">FBMG - Faculty of Business Management</option>
                <option value="FENG">FENG - Faculty of Engineering</option>
              </select>
            </div>

            {formData.role === 'student' && (
              <div className="form-group">
                <label>Select Your Class</label>
                <select name="class_id" value={formData.class_id} onChange={handleChange} required>
                  <option value="">Select Class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} - {cls.faculty}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#ccc' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage('');
            }}
            style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </form>
    </div>
  );
};

export default Login;