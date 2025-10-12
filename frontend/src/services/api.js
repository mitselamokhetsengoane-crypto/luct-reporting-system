import axios from 'axios';

// Determine API URL based on environment - FIXED
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://luct-reporting-system-37q9.onrender.com/api';
  }
  return 'http://localhost:5000/api';
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Client-side cache for public data
const apiCache = new Map();

// Request interceptor
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`API Request: ${req.method?.toUpperCase()} ${req.url}`, {
      headers: req.headers,
      data: req.data
    });
  }
  
  return req;
}, (error) => {
  console.error('Request Interceptor Error:', error);
  return Promise.reject(error);
});

// Response interceptor
API.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Response: ${response.status} ${response.config.url}`, {
        data: response.data
      });
    }
    return response;
  },
  (error) => {
    console.error('API Error Details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      timeout: error.code === 'ECONNABORTED' ? 'Request timeout' : 'No timeout'
    });

    if (error.response?.status === 401) {
      console.warn('Unauthorized access - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
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

// Enhanced API methods with better error handling and validation
export const authAPI = {
  login: (credentials) => {
    console.log('Login attempt:', { email: credentials.email });
    return API.post('/auth/login', credentials);
  },
  register: (userData) => {
    console.log('Registration attempt:', { email: userData.email, role: userData.role });
    return API.post('/auth/register', userData);
  },
  getMe: () => {
    console.log('Fetching user profile');
    return API.get('/auth/me');
  },
  getClasses: () => {
    console.log('Fetching classes');
    return API.get('/auth/classes');
  },
};

export const reportAPI = {
  create: (reportData) => {
    console.log('Creating report:', { 
      course: reportData.course_id, 
      week: reportData.week_number 
    });
    return API.post('/reports', reportData);
  },
  getMyReports: () => {
    console.log('Fetching user reports');
    return API.get('/reports/my-reports');
  },
  getClassReports: (classId) => {
    console.log('Fetching class reports:', { classId });
    if (!classId) {
      console.error('Class ID is required for getClassReports');
      return Promise.reject(new Error('Class ID is required'));
    }
    return API.get(`/reports/class/${classId}`);
  },
  signReport: (reportId, signature) => {
    console.log('Signing report:', { reportId });
    return API.patch(`/reports/${reportId}/sign`, { signature });
  },
  approveReport: (reportId) => {
    console.log('Approving report:', { reportId });
    return API.patch(`/reports/${reportId}/approve`);
  },
  getReportById: (reportId) => {
    console.log('Fetching report by ID:', { reportId });
    if (!reportId) {
      console.error('Report ID is required for getReportById');
      return Promise.reject(new Error('Report ID is required'));
    }
    return API.get(`/reports/${reportId}`);
  },
  downloadMyReports: () => {
    console.log('Downloading user reports');
    return API.get('/reports/download/my-reports', { responseType: 'blob' });
  },
  getPendingApprovalReports: () => {
    console.log('Fetching pending approval reports');
    return API.get('/reports/pending-approval');
  },
  
  // FIXED: Enhanced report generation endpoints with proper validation
  generatePerformanceReport: (filters) => {
    console.log('Generating performance report:', filters);
    const validatedFilters = validateReportFilters(filters);
    return API.post('/reports/generate/performance', validatedFilters, { 
      responseType: 'blob',
      timeout: 60000
    });
  },
  generateAttendanceReport: (filters) => {
    console.log('Generating attendance report:', filters);
    const validatedFilters = validateReportFilters(filters);
    return API.post('/reports/generate/attendance', validatedFilters, { 
      responseType: 'blob',
      timeout: 60000
    });
  },
  generateFacultyReport: (filters) => {
    console.log('Generating faculty report:', filters);
    const validatedFilters = validateReportFilters(filters);
    return API.post('/reports/generate/faculty', validatedFilters, { 
      responseType: 'blob',
      timeout: 60000
    });
  },
  getReportStatistics: (userId) => {
    console.log('Fetching report statistics for user:', userId);
    return API.get(`/reports/statistics/${userId}`);
  }
};

export const complaintAPI = {
  create: (complaintData) => {
    console.log('Creating complaint:', { 
      title: complaintData.title,
      against: complaintData.complaint_against_id
    });
    
    // Validate required fields before sending
    if (!complaintData.title || !complaintData.description || !complaintData.complaint_against_id) {
      return Promise.reject(new Error('Title, description, and complaint target are required'));
    }
    
    return API.post('/complaints', complaintData);
  },
  getMyComplaints: () => {
    console.log('Fetching user complaints');
    return API.get('/complaints/my-complaints');
  },
  getComplaintsForMe: () => {
    console.log('Fetching complaints for user');
    return API.get('/complaints/for-me');
  },
  getAllComplaints: () => {
    console.log('Fetching all complaints');
    return API.get('/complaints/all');
  },
  respond: (complaintId, response) => {
    console.log('Responding to complaint:', { complaintId });
    return API.patch(`/complaints/${complaintId}/respond`, { response });
  },
  updateComplaintStatus: (complaintId, status) => {
    console.log('Updating complaint status:', { complaintId, status });
    return API.patch(`/complaints/${complaintId}/status`, { status });
  },
  downloadMyComplaints: () => {
    console.log('Downloading user complaints');
    return API.get('/complaints/download/my-complaints', { responseType: 'blob' });
  },
  
  // Enhanced complaint reporting
  generateComplaintReport: (filters) => {
    console.log('Generating complaint report:', filters);
    return API.post('/complaints/generate-report', filters, { 
      responseType: 'blob',
      timeout: 60000
    });
  },
  getComplaintStatistics: () => {
    console.log('Fetching complaint statistics');
    return API.get('/complaints/statistics');
  }
};

export const assignmentAPI = {
  getCourses: () => {
    console.log('Fetching courses');
    return API.get('/assignments/courses');
  },
  getClasses: () => {
    console.log('Fetching classes');
    return API.get('/assignments/classes');
  },
  getLecturers: () => {
    console.log('Fetching lecturers');
    return API.get('/assignments/lecturers');
  },
  assignCourse: (assignmentData) => {
    console.log('Assigning course:', {
      course: assignmentData.course_id,
      lecturer: assignmentData.lecturer_id,
      class: assignmentData.class_id,
      type: assignmentData.assignment_type
    });
    
    // Validate assignment data
    if (!assignmentData.course_id || !assignmentData.lecturer_id || !assignmentData.class_id) {
      return Promise.reject(new Error('Course, lecturer, and class are required'));
    }
    
    return API.post('/assignments/assign', assignmentData);
  },
  getMyAssignments: () => {
    console.log('Fetching user assignments');
    return API.get('/assignments/my-assignments');
  },
  getAllAssignments: () => {
    console.log('Fetching all assignments');
    return API.get('/assignments/all-assignments');
  },
  deleteAssignment: (assignmentId) => {
    console.log('Deleting assignment:', { assignmentId });
    return API.delete(`/assignments/${assignmentId}`);
  },
  downloadAssignments: () => {
    console.log('Downloading assignments');
    return API.get('/assignments/download/assignments', { responseType: 'blob' });
  },
  
  // Enhanced assignment reporting
  generateAssignmentReport: (type) => {
    console.log('Generating assignment report:', { type });
    return API.get(`/assignments/reports/${type}`, { 
      responseType: 'blob',
      timeout: 60000
    });
  },
  getAssignmentStatistics: () => {
    console.log('Fetching assignment statistics');
    return API.get('/assignments/statistics');
  }
};

export const ratingAPI = {
  create: (ratingData) => {
    console.log('Creating rating:', {
      report: ratingData.report_id,
      type: ratingData.rating_type,
      value: ratingData.rating_value
    });
    return API.post('/ratings', ratingData);
  },
  getMyRatings: () => {
    console.log('Fetching user ratings');
    return API.get('/ratings/my-ratings');
  },
  getReportRatings: (reportId) => {
    console.log('Fetching report ratings:', { reportId });
    if (!reportId) {
      console.error('Report ID is required for getReportRatings');
      return Promise.reject(new Error('Report ID is required'));
    }
    return API.get(`/ratings/report/${reportId}`);
  },
  getLecturerRatings: (lecturerId) => {
    console.log('Fetching lecturer ratings:', { lecturerId });
    if (!lecturerId) {
      console.error('Lecturer ID is required for getLecturerRatings');
      return Promise.reject(new Error('Lecturer ID is required'));
    }
    return API.get(`/ratings/lecturer/${lecturerId}`);
  },
  update: (ratingId, ratingData) => {
    console.log('Updating rating:', { ratingId });
    return API.patch(`/ratings/${ratingId}`, ratingData);
  },
  delete: (ratingId) => {
    console.log('Deleting rating:', { ratingId });
    return API.delete(`/ratings/${ratingId}`);
  },
  
  // Rating statistics
  getRatingStatistics: (lecturerId) => {
    console.log('Fetching rating statistics:', { lecturerId });
    return API.get(`/ratings/statistics/${lecturerId}`);
  }
};

// Public API endpoints with enhanced timeout handling
export const publicAPI = {
  getDashboardData: async () => {
    console.log('Fetching public dashboard data');
    
    const cacheKey = 'public-dashboard';
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
      console.log('Serving public dashboard from cache');
      return { data: cached.data };
    }

    try {
      const response = await API.get('/public/dashboard', {
        timeout: 15000,
      });

      apiCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response;
    } catch (error) {
      if (cached) {
        console.log('Using cached data due to API error');
        return { data: cached.data };
      }
      throw error;
    }
  },
};

// Validation helper functions
const validateReportFilters = (filters) => {
  const validated = { ...filters };
  
  // Ensure dates are properly formatted
  if (validated.startDate && !isValidDate(validated.startDate)) {
    delete validated.startDate;
  }
  if (validated.endDate && !isValidDate(validated.endDate)) {
    delete validated.endDate;
  }
  
  return validated;
};

const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Enhanced retry utility
export const retryRequest = async (requestFn, maxRetries = 2, delay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Request attempt ${attempt}/${maxRetries}`);
      const result = await requestFn();
      console.log(`Request succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.warn(`Request failed on attempt ${attempt}:`, error.message);
      
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts failed`);
        throw error;
      }
      
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Download helper function
export const downloadFile = (blob, filename) => {
  try {
    console.log('Downloading file:', { filename, blobSize: blob.size });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    console.log('File download initiated:', filename);
  } catch (error) {
    console.error('File download failed:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Report generation helper
export const generateAndDownloadReport = async (generateFunction, filters, filename) => {
  try {
    console.log('Starting report generation:', { filename, filters });
    const response = await generateFunction(filters);
    await downloadFile(response.data, filename);
    console.log('Report generated and downloaded successfully:', filename);
    return { success: true, filename };
  } catch (error) {
    console.error('Report generation failed:', error);
    throw new Error(`Failed to generate report: ${error.message}`);
  }
};

// API health check utility
export const checkAPIHealth = async () => {
  try {
    console.log('Checking API health...');
    const response = await API.get('/health', { timeout: 10000 });
    console.log('API Health:', response.data);
    return { healthy: true, data: response.data };
  } catch (error) {
    console.error('API Health Check Failed:', error);
    return { healthy: false, error: error.message };
  }
};

// Cache management utilities
export const clearApiCache = (key = null) => {
  if (key) {
    apiCache.delete(key);
    console.log(`Cleared cache for key: ${key}`);
  } else {
    apiCache.clear();
    console.log('Cleared all API cache');
  }
};

export const getCacheInfo = () => {
  return {
    size: apiCache.size,
    keys: Array.from(apiCache.keys()),
    entries: Array.from(apiCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp
    }))
  };
};

export const API_BASE_URL = getApiBaseUrl();
export default API;