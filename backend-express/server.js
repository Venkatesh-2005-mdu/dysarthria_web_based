const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');
const { initializeDatabase } = require('./utils/initDb');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const debugRoutes = require('./routes/debugRoutes');
const audioAnalysisRoutes = require('./routes/audioAnalysisRoutes');

const app = express();

// CORS middleware - Allow all origins for development
app.use(cors());
// Increase payload size limit for waveform data (50MB limit)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Express backend is running' });
});

// Routes
app.use('/auth', authRoutes);
// Patient routes (requires authentication)
app.use('/api/patients', patientRoutes);
// Assessment routes (requires authentication)
app.use('/api/assessments', assessmentRoutes);
// Report routes (requires authentication)
app.use('/api/reports', reportRoutes);
// Audio analysis routes (requires authentication)
app.use('/api/analyze', audioAnalysisRoutes);
app.use('/phonation', audioAnalysisRoutes);
app.use('/api/sz', audioAnalysisRoutes);
// Debug routes (database verification)
app.use('/debug', debugRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

(async () => {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    client.release();

    // Initialize tables
    await initializeDatabase();

    // Start server
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`
╔════════════════════════════════════════╗
║   SLP Assessment Backend (Express)     ║
║   Database & Authentication Server     ║
╚════════════════════════════════════════╝
      
✓ Server running on http://localhost:${PORT}
✓ Database: ${process.env.DB_NAME}
✓ CORS enabled for: ${process.env.CORS_ORIGIN}

Available endpoints:
  - POST   /auth/register    - Register new SLP user
  - POST   /auth/login       - Login SLP user
  - GET    /auth/profile     - Get user profile (requires token)
  - GET    /health           - Health check
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = app;
