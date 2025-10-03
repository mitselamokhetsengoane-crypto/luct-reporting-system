const pool = require('../config/database');

const assignmentController = {
  getCourses: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*, u.name as program_leader_name 
        FROM courses c 
        LEFT JOIN users u ON c.program_leader_id = u.id 
        ORDER BY c.course_name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getClasses: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM classes ORDER BY class_name');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching classes:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getLecturers: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, email, role, faculty 
        FROM users 
        WHERE role IN ('lecturer', 'prl', 'pl', 'fmg')
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  assignCourse: async (req, res) => {
    try {
      const { course_id, lecturer_id, class_id } = req.body;

      // Validate required fields
      if (!course_id || !lecturer_id || !class_id) {
        return res.status(400).json({ message: 'Course, lecturer, and class are required' });
      }

      // Check if assignment already exists
      const existingAssignment = await pool.query(
        'SELECT * FROM course_assignments WHERE course_id = $1 AND lecturer_id = $2 AND class_id = $3',
        [course_id, lecturer_id, class_id]
      );

      if (existingAssignment.rows.length > 0) {
        return res.status(400).json({ message: 'This course is already assigned to this lecturer for this class' });
      }

      const result = await pool.query(
        'INSERT INTO course_assignments (course_id, lecturer_id, class_id, assigned_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [course_id, lecturer_id, class_id, req.user.id]
      );

      res.status(201).json({ 
        message: 'Course assigned successfully', 
        assignment: result.rows[0] 
      });
    } catch (error) {
      console.error('Error assigning course:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  getMyAssignments: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ca.*, c.course_name, c.course_code, cl.class_name, u.name as assigned_by_name
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        JOIN classes cl ON ca.class_id = cl.id
        JOIN users u ON ca.assigned_by = u.id
        WHERE ca.lecturer_id = $1
        ORDER BY ca.assigned_at DESC
      `, [req.user.id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get all assignments (for PL)
  getAllAssignments: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ca.*, c.course_name, c.course_code, cl.class_name, 
               u1.name as lecturer_name, u2.name as assigned_by_name
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        JOIN classes cl ON ca.class_id = cl.id
        JOIN users u1 ON ca.lecturer_id = u1.id
        JOIN users u2 ON ca.assigned_by = u2.id
        ORDER BY ca.assigned_at DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching all assignments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Download assignments data
  downloadAssignments: async (req, res) => {
    try {
      let assignments;
      
      if (req.user.role === 'pl') {
        assignments = await pool.query(`
          SELECT c.course_name, c.course_code, cl.class_name, u.name as lecturer_name,
                 u2.name as assigned_by_name, ca.assigned_at
          FROM course_assignments ca
          JOIN courses c ON ca.course_id = c.id
          JOIN classes cl ON ca.class_id = cl.id
          JOIN users u ON ca.lecturer_id = u.id
          JOIN users u2 ON ca.assigned_by = u2.id
          ORDER BY ca.assigned_at DESC
        `);
        assignments = assignments.rows;
      } else {
        assignments = await pool.query(`
          SELECT c.course_name, c.course_code, cl.class_name, u.name as assigned_by_name, ca.assigned_at
          FROM course_assignments ca
          JOIN courses c ON ca.course_id = c.id
          JOIN classes cl ON ca.class_id = cl.id
          JOIN users u ON ca.assigned_by = u.id
          WHERE ca.lecturer_id = $1
          ORDER BY ca.assigned_at DESC
        `, [req.user.id]);
        assignments = assignments.rows;
      }

      const csvData = convertAssignmentsToCSV(assignments, req.user.role);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${req.user.role}-assignments.csv`);
      res.send(csvData);
    } catch (error) {
      console.error('Error downloading assignments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Helper function to convert assignments to CSV
function convertAssignmentsToCSV(assignments, userRole) {
  const headers = userRole === 'pl' 
    ? ['Course', 'Course Code', 'Class', 'Lecturer', 'Assigned By', 'Date Assigned']
    : ['Course', 'Course Code', 'Class', 'Assigned By', 'Date Assigned'];
  
  const csvRows = [headers.join(',')];
  
  for (const assignment of assignments) {
    const row = userRole === 'pl'
      ? [
          assignment.course_name,
          assignment.course_code,
          assignment.class_name,
          assignment.lecturer_name,
          assignment.assigned_by_name,
          new Date(assignment.assigned_at).toLocaleDateString()
        ]
      : [
          assignment.course_name,
          assignment.course_code,
          assignment.class_name,
          assignment.assigned_by_name,
          new Date(assignment.assigned_at).toLocaleDateString()
        ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = assignmentController;