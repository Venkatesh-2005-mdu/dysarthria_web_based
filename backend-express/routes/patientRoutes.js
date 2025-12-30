const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const router = express.Router();

/**
 * Create a new patient
 * POST /api/patients
 */
router.post('/', [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('date_of_birth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['M', 'F', 'Other']).withMessage('Valid gender is required'),
], async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, date_of_birth, gender, contact_number, email, diagnosis, notes } = req.body;
    const slp_id = req.user.id; // From auth middleware

    await client.query('BEGIN');

    // Insert patient
    const patientResult = await client.query(
      `INSERT INTO patients (slp_id, first_name, last_name, date_of_birth, gender, contact_number, email, diagnosis, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [slp_id, first_name, last_name, date_of_birth, gender, contact_number || null, email || null, diagnosis || null, notes || null]
    );

    const patient = patientResult.rows[0];

    // Create associated records
    if (req.body.general_status) {
      await client.query(
        `INSERT INTO patient_general_status (patient_id, hearing_status, vision_status, cognitive_level, mobility_level, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [patient.id, req.body.general_status.hearing, req.body.general_status.vision, req.body.general_status.cognitive, req.body.general_status.mobility, req.body.general_status.notes || null]
      );
    }

    if (req.body.sensory_profile) {
      await client.query(
        `INSERT INTO patient_sensory_profile (patient_id, tactile_sensitivity, auditory_sensitivity, visual_sensitivity, proprioceptive_feedback, motor_planning, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [patient.id, req.body.sensory_profile.tactile || null, req.body.sensory_profile.auditory || null, req.body.sensory_profile.visual || null, req.body.sensory_profile.proprioceptive || null, req.body.sensory_profile.motor_planning || null, req.body.sensory_profile.notes || null]
      );
    }

    if (req.body.oral_cavity) {
      await client.query(
        `INSERT INTO patient_oral_cavity_examination (patient_id, lip_competence, tongue_mobility, hard_palate, soft_palate, gag_reflex, dentition, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [patient.id, req.body.oral_cavity.lip_competence || null, req.body.oral_cavity.tongue_mobility || null, req.body.oral_cavity.hard_palate || null, req.body.oral_cavity.soft_palate || null, req.body.oral_cavity.gag_reflex || null, req.body.oral_cavity.dentition || null, req.body.oral_cavity.notes || null]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Patient created successfully',
      patient: patient,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Patient creation error:', error);
    res.status(500).json({ message: 'Error creating patient' });
  } finally {
    client.release();
  }
});

/**
 * Get all patients for logged-in SLP
 * GET /api/patients
 */
router.get('/', async (req, res) => {
  try {
    const slp_id = req.user.id;
    const { search } = req.query;

    let query = 'SELECT * FROM patients WHERE slp_id = $1';
    const params = [slp_id];

    if (search) {
      query += ` AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ patients: result.rows });
  } catch (error) {
    console.error('Patient fetch error:', error);
    res.status(500).json({ message: 'Error fetching patients' });
  }
});

/**
 * Get patient by ID with all related data
 * GET /api/patients/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slp_id = req.user.id;

    const patientResult = await pool.query(
      'SELECT * FROM patients WHERE id = $1 AND slp_id = $2',
      [id, slp_id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Get related data
    const generalStatusResult = await pool.query(
      'SELECT * FROM patient_general_status WHERE patient_id = $1',
      [id]
    );

    const sensoryProfileResult = await pool.query(
      'SELECT * FROM patient_sensory_profile WHERE patient_id = $1',
      [id]
    );

    const oralCavityResult = await pool.query(
      'SELECT * FROM patient_oral_cavity_examination WHERE patient_id = $1',
      [id]
    );

    res.json({
      patient: patient,
      general_status: generalStatusResult.rows[0] || null,
      sensory_profile: sensoryProfileResult.rows[0] || null,
      oral_cavity: oralCavityResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Patient detail fetch error:', error);
    res.status(500).json({ message: 'Error fetching patient' });
  }
});

/**
 * Update patient
 * PUT /api/patients/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slp_id = req.user.id;
    const { first_name, last_name, date_of_birth, gender, contact_number, email, diagnosis, notes } = req.body;

    const result = await pool.query(
      `UPDATE patients 
       SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, contact_number = $5, email = $6, diagnosis = $7, notes = $8
       WHERE id = $9 AND slp_id = $10
       RETURNING *`,
      [first_name, last_name, date_of_birth, gender, contact_number || null, email || null, diagnosis || null, notes || null, id, slp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({ message: 'Patient updated successfully', patient: result.rows[0] });
  } catch (error) {
    console.error('Patient update error:', error);
    res.status(500).json({ message: 'Error updating patient' });
  }
});

/**
 * Delete patient
 * DELETE /api/patients/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slp_id = req.user.id;

    const result = await pool.query(
      'DELETE FROM patients WHERE id = $1 AND slp_id = $2 RETURNING id',
      [id, slp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Patient deletion error:', error);
    res.status(500).json({ message: 'Error deleting patient' });
  }
});

module.exports = router;
