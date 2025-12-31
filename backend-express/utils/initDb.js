const pool = require('../config/database');

const initializeDatabase = async () => {
  try {
    console.log('Initializing database tables...');

    // Create SLP Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS slp_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        license_number VARCHAR(255),
        specialization VARCHAR(255),
        organization VARCHAR(255),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ SLP Users table created/verified');

    // Create Patients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(50),
        diagnosis VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Patients table created/verified');

    // Create Assessment Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id SERIAL PRIMARY KEY,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Assessment Sessions table created/verified');

    // Create Respiratory Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS respiratory_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        vital_capacity DECIMAL(10, 2),
        vital_capacity_unit VARCHAR(20),
        phonation_duration DECIMAL(10, 2),
        phonation_duration_unit VARCHAR(20),
        pressure_support DECIMAL(10, 2),
        pressure_support_unit VARCHAR(20),
        breathing_pattern VARCHAR(50),
        breathing_rate INTEGER,
        impressions TEXT,
        recommendations TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Respiratory Assessments table created/verified');

    // Create Phonation Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phonation_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        vowel_a DECIMAL(10, 2),
        vowel_e DECIMAL(10, 2),
        vowel_i DECIMAL(10, 2),
        vowel_o DECIMAL(10, 2),
        vowel_u DECIMAL(10, 2),
        vowel_aa DECIMAL(10, 2),
        pitch_range VARCHAR(100),
        voice_quality VARCHAR(255),
        impressions TEXT,
        recommendations TEXT,
        waveform_a JSONB,
        waveform_e JSONB,
        waveform_i JSONB,
        waveform_o JSONB,
        waveform_u JSONB,
        waveform_aa JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Phonation Assessments table created/verified');

    // Create Voice Test Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voice_test_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        voice_quality VARCHAR(255),
        breathiness_level VARCHAR(50),
        harshness_level VARCHAR(50),
        impressions TEXT,
        recommendations TEXT,
        waveform JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Voice Test Assessments table created/verified');

    // Create S/Z Ratio Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sz_ratio_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        s_duration DECIMAL(10, 2),
        z_duration DECIMAL(10, 2),
        sz_ratio DECIMAL(10, 2),
        interpretation VARCHAR(255),
        impressions TEXT,
        recommendations TEXT,
        waveform_s JSONB,
        waveform_z JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ S/Z Ratio Assessments table created/verified');

    // Create Rate of Speech Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_of_speech_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        assessment_type VARCHAR(50),
        duration_sec DECIMAL(10, 2),
        words_per_minute DECIMAL(10, 2),
        speaking_rate VARCHAR(50),
        estimated_words INTEGER,
        pause_count INTEGER,
        pause_duration_sec DECIMAL(10, 2),
        impressions TEXT,
        recommendations TEXT,
        waveform JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Rate of Speech Assessments table created/verified');

    // Create Resonance Articulation Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resonance_articulation_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        amr_pa DECIMAL(10, 2),
        amr_ta DECIMAL(10, 2),
        amr_ka DECIMAL(10, 2),
        smr DECIMAL(10, 2),
        resonance_quality VARCHAR(255),
        nasality_impression VARCHAR(255),
        articulation_accuracy_percent DECIMAL(5, 2),
        phoneme_errors TEXT,
        impressions TEXT,
        recommendations TEXT,
        waveform JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Resonance Articulation Assessments table created/verified');

    // Create Articulation Screener Assessments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articulation_screener_assessments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        phoneme_accuracy_percent DECIMAL(5, 2),
        errors_identified TEXT,
        severity_level VARCHAR(50),
        recommendations_screener TEXT,
        impressions TEXT,
        recommendations TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Articulation Screener Assessments table created/verified');

    // Create Comprehensive Reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comprehensive_reports (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        slp_id INTEGER NOT NULL REFERENCES slp_users(id) ON DELETE CASCADE,
        report_type VARCHAR(100),
        title VARCHAR(255),
        summary TEXT,
        findings TEXT,
        impressions TEXT,
        recommendations TEXT,
        html_content LONGTEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Comprehensive Reports table created/verified');

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_slp_id ON patients(slp_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON assessment_sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_slp_id ON assessment_sessions(slp_id);
    `);
    console.log('✓ Database indexes created/verified');

    console.log('\n✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
};

module.exports = { initializeDatabase };
