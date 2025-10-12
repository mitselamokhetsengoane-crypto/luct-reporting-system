const pool = require('../config/database');

// ================================
// 🔹 GET COURSES
// ================================
exports.getCourses = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY course_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
};

// ================================
// 🔹 GET CLASSES
// ================================
exports.getClasses = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM classes ORDER BY class_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
};

// ================================
// 🔹 GET LECTURERS
// ================================
exports.getLecturers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name AS full_name, email FROM users WHERE role = $1', ['lecturer']);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching lecturers:', error);
    res.status(500).json({ message: 'Failed to fetch lecturers' });
  }
};

// ================================
// 🔹 ASSIGN COURSE TO LECTURER
// ================================
exports.assignCourse = async (req, res) => {
  try {
    const { course_id, lecturer_id, class_id } = req.body;
    const assigned_by = req.user.id;

    if (!course_id || !lecturer_id || !class_id) {
      return res.status(400).json({ message: 'course_id, lecturer_id, and class_id are required' });
    }

    const insertQuery = `
      INSERT INTO course_assignments (course_id, lecturer_id, class_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(insertQuery, [course_id, lecturer_id, class_id, assigned_by]);

    res.status(201).json({
      message: 'Lecturer successfully assigned to class',
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error('Error assigning lecturer:', error);
    res.status(500).json({ message: 'Failed to assign lecturer to class' });
  }
};

// ================================
// 🔹 GET MY ASSIGNMENTS (for Lecturer)
// ================================
exports.getMyAssignments = async (req, res) => {
  try {
    const lecturerId = req.user.id;

    const result = await pool.query(
      `SELECT a.id, c.course_name, cl.class_name, a.assigned_at
       FROM course_assignments a
       JOIN courses c ON a.course_id = c.id
       JOIN classes cl ON a.class_id = cl.id
       WHERE a.lecturer_id = $1
       ORDER BY a.assigned_at DESC`,
      [lecturerId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching lecturer assignments:', error);
    res.status(500).json({ message: 'Failed to fetch your assignments' });
  }
};

// ================================
// 🔹 GET ALL ASSIGNMENTS (for Admin / PL / FMG)
// ================================
exports.getAllAssignments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, 
        c.course_name, 
        cl.class_name, 
        u.name AS lecturer, 
        a.assigned_at
      FROM course_assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN classes cl ON a.class_id = cl.id
      JOIN users u ON a.lecturer_id = u.id
      ORDER BY a.id DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching all assignments:', error);
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
};

// ================================
// 🔹 DELETE ASSIGNMENT
// ================================
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM course_assignments WHERE id = $1', [id]);
    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ message: 'Failed to delete assignment' });
  }
};

// ================================
// 🔹 DOWNLOAD ASSIGNMENTS (CSV format)
// ================================
exports.downloadAssignments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.course_name, 
        cl.class_name, 
        u.name AS lecturer, 
        a.assigned_at
      FROM course_assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN classes cl ON a.class_id = cl.id
      JOIN users u ON a.lecturer_id = u.id
    `);

    // Convert to CSV
    const header = 'Course,Class,Lecturer,Assigned At\n';
    const rows = result.rows
      .map(r => `${r.course_name},${r.class_name},${r.lecturer},${r.assigned_at}`)
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=assignments.csv');
    res.status(200).send(header + rows);
  } catch (error) {
    console.error('Error downloading assignments:', error);
    res.status(500).json({ message: 'Failed to download assignments' });
  }
};

// ================================
// 🔹 GENERATE ASSIGNMENT REPORT
// ================================
exports.generateAssignmentReport = async (req, res) => {
  try {
    const { type } = req.params;
    let query = '';

    if (type === 'lecturer') {
      query = `
        SELECT u.name AS lecturer, COUNT(a.id) AS total_assigned
        FROM course_assignments a
        JOIN users u ON a.lecturer_id = u.id
        GROUP BY u.name
        ORDER BY total_assigned DESC;
      `;
    } else if (type === 'class') {
      query = `
        SELECT cl.class_name, COUNT(a.id) AS total_assigned
        FROM course_assignments a
        JOIN classes cl ON a.class_id = cl.id
        GROUP BY cl.class_name
        ORDER BY total_assigned DESC;
      `;
    } else if (type === 'course') {
      query = `
        SELECT c.course_name, COUNT(a.id) AS total_assigned
        FROM course_assignments a
        JOIN courses c ON a.course_id = c.id
        GROUP BY c.course_name
        ORDER BY total_assigned DESC;
      `;
    } else {
      return res.status(400).json({ message: 'Invalid report type' });
    }

    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error generating assignment report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
};

// ================================
// 🔹 ASSIGNMENT STATISTICS
// ================================
exports.getAssignmentStatistics = async (req, res) => {
  try {
    const totalAssignments = await pool.query('SELECT COUNT(*) FROM course_assignments');
    const totalLecturers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'lecturer'");
    const totalCourses = await pool.query('SELECT COUNT(*) FROM courses');
    const totalClasses = await pool.query('SELECT COUNT(*) FROM classes');

    res.status(200).json({
      total_assignments: totalAssignments.rows[0].count,
      total_lecturers: totalLecturers.rows[0].count,
      total_courses: totalCourses.rows[0].count,
      total_classes: totalClasses.rows[0].count,
    });
  } catch (error) {
    console.error('Error fetching assignment statistics:', error);
    res.status(500).json({ message: 'Failed to fetch assignment statistics' });
  }
};
