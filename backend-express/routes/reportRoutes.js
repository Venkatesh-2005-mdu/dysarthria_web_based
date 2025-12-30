const express = require('express');
const pool = require('../config/database');

const router = express.Router();

/**
 * Generate comprehensive report from assessment session
 * POST /api/reports/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { session_id, title, summary } = req.body;
    const slp_id = req.user.id;

    // Get session data
    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Generate report data
    const reportData = {
      session_id,
      assessments: {},
    };

    // Create HTML report content
    const htmlContent = `
      <html>
        <head><title>${title || 'Assessment Report'}</title></head>
        <body>
          <h1>${title || 'SLP Assessment Report'}</h1>
          <p>${summary || 'Assessment summary'}</p>
        </body>
      </html>
    `;

    // Save report
    const result = await pool.query(
      `INSERT INTO comprehensive_reports (session_id, slp_id, title, summary, html_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session_id, slp_id, title || 'Assessment Report', summary || null, htmlContent]
    );

    res.status(201).json({ message: 'Report generated', report: result.rows[0] });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

/**
 * Get report by ID
 * GET /api/reports/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slp_id = req.user.id;

    const result = await pool.query(
      'SELECT * FROM comprehensive_reports WHERE id = $1 AND slp_id = $2',
      [id, slp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ report: result.rows[0] });
  } catch (error) {
    console.error('Report fetch error:', error);
    res.status(500).json({ message: 'Error fetching report' });
  }
});

/**
 * List all reports for patient
 * GET /api/reports/patient/:patient_id
 */
router.get('/patient/:patient_id', async (req, res) => {
  try {
    const { patient_id } = req.params;
    const slp_id = req.user.id;

    const result = await pool.query(
      `SELECT r.* FROM comprehensive_reports r
       JOIN assessment_sessions s ON r.session_id = s.id
       WHERE s.patient_id = $1 AND s.slp_id = $2
       ORDER BY r.created_at DESC`,
      [patient_id, slp_id]
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Reports list error:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

module.exports = router;
