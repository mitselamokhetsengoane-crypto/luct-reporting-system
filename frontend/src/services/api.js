import axios from 'axios';

// Determine API URL based on environment - FIXED
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://luct-reporting-system-37q9.onrender.com/api'; // Your actual backend URL
  }
  return 'http://localhost:5000/api';
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Important for CORS with credentials
});

// Request interceptor with enhanced logging
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  
  // Enhanced logging for development only
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 API Request: ${req.method?.toUpperCase()} ${req.url}`, {
      headers: req.headers,
      data: req.data
    });
  }
  
  return req;
}, (error) => {
  console.error('❌ Request Interceptor Error:', error);
  return Promise.reject(error);
});

// Enhanced response interceptor for error handling
API.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`, {
        data: response.data
      });
    }
    return response;
  },
  (error) => {
    console.error('❌ API Error Details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      timeout: error.code === 'ECONNABORTED' ? 'Request timeout' : 'No timeout'
    });

    if (error.response?.status === 401) {
      console.warn('🚨 Unauthorized access - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Enhanced error message
    const enhancedError = new Error(
      error.response?.data?.message || 
      error.message || 
      'Network error occurred. Please check your connection.'
    );
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    
    return Promise.reject(enhancedError);
  }
);

// Enhanced API methods with better error handling
export const authAPI = {
  login: (credentials) => {
    console.log('🔐 Login attempt:', { email: credentials.email });
    return API.post('/auth/login', credentials);
  },
  register: (userData) => {
    console.log('👤 Registration attempt:', { email: userData.email, role: userData.role });
    return API.post('/auth/register', userData);
  },
  getMe: () => {
    console.log('📋 Fetching user profile');
    return API.get('/auth/me');
  },
  getClasses: () => {
    console.log('🏫 Fetching classes');
    return API.get('/auth/classes');
  },
};

export const reportAPI = {
  create: (reportData) => {
    console.log('📊 Creating report:', { 
      course: reportData.course_id, 
      week: reportData.week_number 
    });
    return API.post('/reports', reportData);
  },
  getMyReports: () => {
    console.log('📋 Fetching user reports');
    return API.get('/reports/my-reports');
  },
  getClassReports: (classId) => {
    console.log('🏫 Fetching class reports:', { classId });
    if (!classId) {
      console.error('❌ Class ID is required for getClassReports');
      return Promise.reject(new Error('Class ID is required'));
    }
    return API.get(`/reports/class/${classId}`);
  },
  signReport: (reportId, signature) => {
    console.log('✍️ Signing report:', { reportId });
    return API.patch(`/reports/${reportId}/sign`, { signature });
  },
  approveReport: (reportId) => {
    console.log('✅ Approving report:', { reportId });
    return API.patch(`/reports/${reportId}/approve`);
  },
  getReportById: (reportId) => {
    console.log('📄 Fetching report by ID:', { reportId });
    if (!reportId) {
      console.error('❌ Report ID is required for getReportById');
      return Promise.reject(new Error('Report ID is required'));
    }
    return API.get(`/reports/${reportId}`);
  },
  downloadMyReports: () => {
    console.log('💾 Downloading user reports');
    return API.get('/reports/download/my-reports', { responseType: 'blob' });
  },
  getPendingApprovalReports: () => {
    console.log('⏳ Fetching pending approval reports');
    return API.get('/reports/pending-approval');
  },
};

export const complaintAPI = {
  create: (complaintData) => {
    console.log('📝 Creating complaint:', { 
      title: complaintData.title,
      against: complaintData.complaint_against 
    });
    return API.post('/complaints', complaintData);
  },
  getMyComplaints: () => {
    console.log('📋 Fetching user complaints');
    return API.get('/complaints/my-complaints');
  },
  getComplaintsForMe: () => {
    console.log('📨 Fetching complaints for user');
    return API.get('/complaints/for-me');
  },
  respond: (complaintId, response) => {
    console.log('📤 Responding to complaint:', { complaintId });
    return API.patch(`/complaints/${complaintId}/respond`, { response });
  },
  downloadMyComplaints: () => {
    console.log('💾 Downloading user complaints');
    return API.get('/complaints/download/my-complaints', { responseType: 'blob' });
  },
};

export const assignmentAPI = {
  getCourses: () => {
    console.log('📚 Fetching courses');
    return API.get('/assignments/courses');
  },
  getClasses: () => {
    console.log('🏫 Fetching classes');
    return API.get('/assignments/classes');
  },
  getLecturers: () => {
    console.log('👨‍🏫 Fetching lecturers');
    return API.get('/assignments/lecturers');
  },
  assignCourse: (assignmentData) => {
    console.log('🔗 Assigning course:', {
      course: assignmentData.course_id,
      lecturer: assignmentData.lecturer_id,
      class: assignmentData.class_id
    });
    return API.post('/assignments/assign', assignmentData);
  },
  getMyAssignments: () => {
    console.log('📋 Fetching user assignments');
    return API.get('/assignments/my-assignments');
  },
  getAllAssignments: () => {
    console.log('📊 Fetching all assignments');
    return API.get('/assignments/all-assignments');
  },
  downloadAssignments: () => {
    console.log('💾 Downloading assignments');
    return API.get('/assignments/download/assignments', { responseType: 'blob' });
  },
};

// Enhanced Rating API endpoints
export const ratingAPI = {
  create: (ratingData) => {
    console.log('⭐ Creating rating:', {
      report: ratingData.report_id,
      type: ratingData.rating_type,
      value: ratingData.rating_value
    });
    return API.post('/ratings', ratingData);
  },
  getMyRatings: () => {
    console.log('📋 Fetching user ratings');
    return API.get('/ratings/my-ratings');
  },
  getReportRatings: (reportId) => {
    console.log('📄 Fetching report ratings:', { reportId });
    if (!reportId) {
      console.error('❌ Report ID is required for getReportRatings');
      return Promise.reject(new Error('Report ID is required'));
    }
    return API.get(`/ratings/report/${reportId}`);
  },
  getLecturerRatings: (lecturerId) => {
    console.log('👨‍🏫 Fetching lecturer ratings:', { lecturerId });
    if (!lecturerId) {
      console.error('❌ Lecturer ID is required for getLecturerRatings');
      return Promise.reject(new Error('Lecturer ID is required'));
    }
    return API.get(`/ratings/lecturer/${lecturerId}`);
  },
  update: (ratingId, ratingData) => {
    console.log('✏️ Updating rating:', { ratingId });
    return API.patch(`/ratings/${ratingId}`, ratingData);
  },
  delete: (ratingId) => {
    console.log('🗑️ Deleting rating:', { ratingId });
    return API.delete(`/ratings/${ratingId}`);
  },
};

// Monitoring API endpoints
export const monitoringAPI = {
  // Get system performance metrics
  getPerformanceMetrics: async () => {
    console.log('📊 Fetching performance metrics');
    return API.get('/monitoring/performance');
  },

  // Get system health status
  getSystemHealth: async () => {
    console.log('🏥 Fetching system health');
    return API.get('/monitoring/health');
  },

  // Get activity logs
  getActivityLogs: async (timeRange = '7d') => {
    console.log('📈 Fetching activity logs for range:', timeRange);
    return API.get(`/monitoring/activity?range=${timeRange}`);
  },

  // Get trend data
  getTrendData: async () => {
    console.log('📊 Fetching trend data');
    return API.get('/monitoring/trends');
  },

  // Get real-time alerts
  getAlerts: async () => {
    console.log('⚠️ Fetching system alerts');
    return API.get('/monitoring/alerts');
  }
};

// Public API endpoints (no authentication required)
export const publicAPI = {
  getDashboardData: () => {
    console.log('📈 Fetching public dashboard data');
    return API.get('/public/dashboard');
  },
};

// Enhanced download helper function
export const downloadFile = (blob, filename) => {
  try {
    console.log('💾 Downloading file:', { filename, blobSize: blob.size });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    console.log('✅ File download initiated:', filename);
  } catch (error) {
    console.error('❌ File download failed:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Add API health check utility
export const checkAPIHealth = async () => {
  try {
    console.log('🏥 Checking API health...');
    const response = await API.get('/health');
    console.log('✅ API Health:', response.data);
    return { healthy: true, data: response.data };
  } catch (error) {
    console.error('❌ API Health Check Failed:', error);
    return { healthy: false, error: error.message };
  }
};

// Add request retry utility
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Request attempt ${attempt}/${maxRetries}`);
      const result = await requestFn();
      console.log(`✅ Request succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.warn(`⚠️ Request failed on attempt ${attempt}:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed`);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Export the base URL for use in other parts of the app
export const API_BASE_URL = getApiBaseUrl();

export default API;