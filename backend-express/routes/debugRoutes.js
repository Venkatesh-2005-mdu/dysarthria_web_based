const express = require('express');
const pool = require('../config/database');

const router = express.Router();

/**
 * Verify database connectivity
 * GET /debug/db-check
 */
router.get('/db-check', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    res.json({
      message: 'Database connection successful',
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

/**
 * Check database tables
 * GET /debug/tables
 */
router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );

    res.json({
      message: 'Database tables',
      tables: result.rows.map(r => r.table_name),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching tables',
      error: error.message,
    });
  }
});

/**
 * Count records in key tables
 * GET /debug/status
 */
router.get('/status', async (req, res) => {
  try {
    const tables = ['slp_users', 'patients', 'assessment_sessions', 'phonation_assessments', 'comprehensive_reports'];
    const status = {};

    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      status[table] = parseInt(result.rows[0].count);
    }

    res.json({
      message: 'System status',
      database_status: 'Connected',
      records: status,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching status',
      error: error.message,
    });
  }
});

module.exports = router;
