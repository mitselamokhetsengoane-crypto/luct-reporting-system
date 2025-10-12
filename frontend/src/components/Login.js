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
      setMessage('Failed to load classes. Please try again.');
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
        // Login logic - unchanged
        response = await authAPI.login({
          email: formData.email,
          password: formData.password
        });
      } else {
        // 🛠️ FIXED: Transform registration data to match backend expectations
        const registrationData = {
          // Try multiple field name combinations to find what backend expects
          name: formData.name,
          firstName: formData.name.split(' ')[0] || formData.name,
          lastName: formData.name.split(' ').slice(1).join(' ') || formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          faculty: formData.faculty,
          class_id: formData.class_id,
          classId: formData.class_id,
          studentId: formData.email.split('@')[0] // Optional: generate student ID from email
        };

        console.log('🔍 Sending registration data:', registrationData);
        response = await authAPI.register(registrationData);
      }

      // Store token and user data
      localStorage.setItem('token', response.data.token);
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      // Notify parent component
      onLogin(response.data.user);
      
      // Show success message
      setMessage(isLogin ? 'Login successful!' : 'Registration successful!');
      
      // Optional: Redirect after successful auth
      setTimeout(() => {
        setMessage('Redirecting...');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Authentication error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack
      });
      
      // Enhanced error handling with detailed messages
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle validation errors
        if (errorData.errors) {
          const errorMessages = Object.values(errorData.errors).flat();
          setMessage(`Validation errors: ${errorMessages.join(', ')}`);
        } 
        // Handle duplicate email/username
        else if (errorData.message?.includes('already exists') || errorData.message?.includes('duplicate')) {
          setMessage('Email already registered. Please use a different email or login.');
        }
        // Handle invalid class
        else if (errorData.message?.includes('class') || errorData.message?.includes('Class')) {
          setMessage('Invalid class selection. Please select a valid class.');
        }
        // Handle other backend errors
        else if (errorData.message) {
          setMessage(errorData.message);
        }
        // Generic backend error
        else {
          setMessage('Registration failed. Please check all fields and try again.');
        }
      } 
      // Handle network errors
      else if (error.message.includes('Network Error') || error.code === 'NETWORK_ERROR') {
        setMessage('Network error. Please check your connection and try again.');
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED') {
        setMessage('Request timeout. Please try again.');
      }
      // Generic error
      else {
        setMessage(error.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'student',
      faculty: 'FICT',
      class_id: ''
    });
    setMessage('');
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{isLogin ? 'Login' : 'Register'} - LUCT Reporting System</h2>
        
        {/* Message Display */}
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
            {message.includes('success') && (
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {isLogin ? 'Redirecting...' : 'You can now login with your credentials.'}
              </div>
            )}
          </div>
        )}

        {/* Name Field - Only for Registration */}
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
              disabled={loading}
            />
          </div>
        )}

        {/* Email Field */}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
            disabled={loading}
          />
        </div>

        {/* Password Field */}
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
            placeholder="Enter your password"
            disabled={loading}
          />
          {!isLogin && (
            <small style={{ color: '#ccc', fontSize: '0.8rem' }}>
              Password must be at least 6 characters long
            </small>
          )}
        </div>

        {/* Registration-Specific Fields */}
        {!isLogin && (
          <>
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select 
                id="role"
                name="role" 
                value={formData.role} 
                onChange={handleChange} 
                required
                disabled={loading}
              >
                <option value="student">Student (Class Rep)</option>
                <option value="lecturer">Lecturer</option>
                <option value="prl">Principal Lecturer (PRL)</option>
                <option value="pl">Program Leader (PL)</option>
                <option value="fmg">Faculty Management (FMG)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="faculty">Faculty</label>
              <select 
                id="faculty"
                name="faculty" 
                value={formData.faculty} 
                onChange={handleChange} 
                required
                disabled={loading}
              >
                <option value="FICT">FICT - Faculty of Information Communication Technology</option>
                <option value="FBMG">FBMG - Faculty of Business Management</option>
                <option value="FENG">FENG - Faculty of Engineering</option>
              </select>
            </div>

            {/* Class Selection - Only for Students */}
            {formData.role === 'student' && (
              <div className="form-group">
                <label htmlFor="class_id">Select Your Class</label>
                <select 
                  id="class_id"
                  name="class_id" 
                  value={formData.class_id} 
                  onChange={handleChange} 
                  required
                  disabled={loading || classes.length === 0}
                >
                  <option value="">{classes.length === 0 ? 'Loading classes...' : 'Select Class'}</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} - {cls.faculty}
                    </option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <small style={{ color: '#ffa500', fontSize: '0.8rem' }}>
                    Loading available classes...
                  </small>
                )}
              </div>
            )}
          </>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          className="login-btn" 
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <>
              <span style={{ marginRight: '0.5rem' }}>⏳</span>
              {isLogin ? 'Logging in...' : 'Registering...'}
            </>
          ) : (
            isLogin ? 'Login' : 'Register'
          )}
        </button>

        {/* Toggle between Login and Register */}
        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#ccc' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleAuthMode}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#fff', 
              textDecoration: 'underline', 
              cursor: 'pointer',
              fontSize: 'inherit'
            }}
            disabled={loading}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>

        {/* Additional Help Text */}
        {!isLogin && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.5rem', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '4px',
            fontSize: '0.8rem',
            textAlign: 'center'
          }}>
            <strong>Note:</strong> Make sure to select the correct class and faculty for your program.
          </div>
        )}
      </form>
    </div>
  );
};

export default Login;