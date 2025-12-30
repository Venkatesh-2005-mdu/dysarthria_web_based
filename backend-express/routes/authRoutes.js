const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const router = express.Router();

/**
 * Register a new SLP user
 * POST /auth/register
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('first_name').trim().notEmpty().withMessage('First name is required'),
    body('last_name').trim().notEmpty().withMessage('Last name is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, first_name, last_name, license_number, specialization, organization, phone } = req.body;

      const userExists = await pool.query('SELECT * FROM slp_users WHERE email = $1', [email]);
      if (userExists.rows.length > 0) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const result = await pool.query(
        `INSERT INTO slp_users (email, password, first_name, last_name, license_number, specialization, organization, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, first_name, last_name, license_number, specialization, organization, phone, created_at`,
        [email, hashedPassword, first_name, last_name, license_number || null, specialization || null, organization || null, phone || null]
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        message: 'Registration successful',
        user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, license_number: user.license_number, specialization: user.specialization, organization: user.organization, phone: user.phone },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

/**
 * Login an SLP user
 * POST /auth/login
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const result = await pool.query('SELECT * FROM slp_users WHERE email = $1', [email]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.is_active) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          license_number: user.license_number,
          specialization: user.specialization,
          organization: user.organization,
          phone: user.phone,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

/**
 * Get current user profile
 * GET /auth/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, license_number, specialization, organization, phone, is_active, created_at FROM slp_users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
