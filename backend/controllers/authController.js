const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../config/database');

const authController = {
  register: async (req, res) => {
    try {
      const { name, email, password, role, faculty, class_id } = req.body;

      // Validate required fields
      if (!name || !email || !password || !role || !faculty) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Validate role
      const validRoles = ['student', 'lecturer', 'prl', 'pl', 'fmg'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
      }

      // Validate faculty
      const validFaculties = ['FICT', 'FBMG', 'FENG'];
      if (!validFaculties.includes(faculty)) {
        return res.status(400).json({ message: 'Invalid faculty specified' });
      }

      // For students, class_id is required
      if (role === 'student' && !class_id) {
        return res.status(400).json({ message: 'Class is required for students' });
      }

      // Check if class exists (for students)
      if (role === 'student' && class_id) {
        const classExists = await pool.query('SELECT * FROM classes WHERE id = $1', [class_id]);
        if (classExists.rows.length === 0) {
          return res.status(400).json({ message: 'Selected class does not exist' });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
        faculty,
        class_id: role === 'student' ? class_id : null
      });

      // Create token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'luct_secret',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          faculty: user.faculty,
          class_id: user.class_id
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration', error: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Check if user exists
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      // Create token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'luct_secret',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          faculty: user.faculty,
          class_id: user.class_id
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login', error: error.message });
    }
  },

  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          faculty: user.faculty,
          class_id: user.class_id
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get all classes for registration dropdown
  getClasses: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM classes ORDER BY class_name');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching classes:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

module.exports = authController;