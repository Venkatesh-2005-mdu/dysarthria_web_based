const express = require('express');
const pool = require('../config/database');

const router = express.Router();

/**
 * Create a new assessment session
 * POST /api/assessments/session
 */
router.post('/session', async (req, res) => {
  try {
    const { patient_id, assessment_date, notes } = req.body;
    const slp_id = req.user.id;

    const result = await pool.query(
      `INSERT INTO assessment_sessions (slp_id, patient_id, assessment_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [slp_id, patient_id, assessment_date || new Date(), notes || null]
    );

    res.status(201).json({ message: 'Assessment session created', session: result.rows[0] });
  } catch (error) {
    console.error('Assessment session creation error:', error);
    res.status(500).json({ message: 'Error creating assessment session' });
  }
});

/**
 * Save respiratory assessment
 * POST /api/assessments/respiratory
 */
router.post('/respiratory', async (req, res) => {
  try {
    const { session_id, vital_capacity, inspiratory_capacity, expiratory_capacity, phonation_duration, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO respiratory_assessments (session_id, vital_capacity, inspiratory_capacity, expiratory_capacity, phonation_duration, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [session_id, vital_capacity || null, inspiratory_capacity || null, expiratory_capacity || null, phonation_duration || null, notes || null]
    );

    res.status(201).json({ message: 'Respiratory assessment saved', data: result.rows[0] });
  } catch (error) {
    console.error('Respiratory assessment error:', error);
    res.status(500).json({ message: 'Error saving respiratory assessment' });
  }
});

/**
 * Save phonation assessment
 * POST /api/assessments/phonation
 */
router.post('/phonation', async (req, res) => {
  try {
    const { session_id, phonation_type, frequency_hz, jitter_percent, shimmer_db, harmonics_noise_ratio, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO phonation_assessments (session_id, phonation_type, frequency_hz, jitter_percent, shimmer_db, harmonics_noise_ratio, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [session_id, phonation_type || null, frequency_hz || null, jitter_percent || null, shimmer_db || null, harmonics_noise_ratio || null, notes || null]
    );

    res.status(201).json({ message: 'Phonation assessment saved', data: result.rows[0] });
  } catch (error) {
    console.error('Phonation assessment error:', error);
    res.status(500).json({ message: 'Error saving phonation assessment' });
  }
});

/**
 * Get assessment session with all assessments
 * GET /api/assessments/session/:session_id
 */
router.get('/session/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const sessionResult = await pool.query(
      'SELECT * FROM assessment_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get all assessments for this session
    const assessments = {};

    ['respiratory_assessments', 'phonation_assessments', 'voice_test_assessments', 'sz_ratio_assessments', 'rate_of_speech_assessments', 'resonance_articulation_assessments', 'articulation_screener_assessments'].forEach(async (table) => {
      const result = await pool.query(`SELECT * FROM ${table} WHERE session_id = $1`, [session_id]);
      assessments[table] = result.rows;
    });

    res.json({ session, assessments });
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ message: 'Error fetching session' });
  }
});

module.exports = router;
