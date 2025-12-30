const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/database');

const router = express.Router();

// Configure multer for audio uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

/**
 * Upload and analyze phonation audio
 * POST /api/analyze/phonation
 */
router.post('/phonation', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { session_id } = req.body;
    const audioPath = req.file.path;

    // Here you would process the audio with the Python backend
    // For now, return placeholder

    res.json({
      message: 'Phonation analysis queued',
      file: audioPath,
      session_id,
    });
  } catch (error) {
    console.error('Phonation analysis error:', error);
    res.status(500).json({ message: 'Error analyzing phonation' });
  }
});

/**
 * Upload and analyze S/Z ratio
 * POST /api/analyze/sz-ratio
 */
router.post('/sz-ratio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { session_id } = req.body;

    res.json({
      message: 'S/Z ratio analysis queued',
      file: req.file.path,
      session_id,
    });
  } catch (error) {
    console.error('S/Z ratio analysis error:', error);
    res.status(500).json({ message: 'Error analyzing S/Z ratio' });
  }
});

/**
 * Upload and analyze voice quality
 * POST /api/analyze/voice
 */
router.post('/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { session_id } = req.body;

    res.json({
      message: 'Voice quality analysis queued',
      file: req.file.path,
      session_id,
    });
  } catch (error) {
    console.error('Voice quality analysis error:', error);
    res.status(500).json({ message: 'Error analyzing voice' });
  }
});

/**
 * Upload and analyze rate of speech
 * POST /api/analyze/rate-of-speech
 */
router.post('/rate-of-speech', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { session_id, text } = req.body;

    res.json({
      message: 'Rate of speech analysis queued',
      file: req.file.path,
      session_id,
      text,
    });
  } catch (error) {
    console.error('Rate of speech analysis error:', error);
    res.status(500).json({ message: 'Error analyzing rate of speech' });
  }
});

/**
 * Upload and analyze resonance
 * POST /api/analyze/resonance
 */
router.post('/resonance', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { session_id } = req.body;

    res.json({
      message: 'Resonance analysis queued',
      file: req.file.path,
      session_id,
    });
  } catch (error) {
    console.error('Resonance analysis error:', error);
    res.status(500).json({ message: 'Error analyzing resonance' });
  }
});

module.exports = router;
