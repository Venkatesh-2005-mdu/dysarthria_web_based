import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './GenerateReport.css';

export default function GenerateReport() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    session_id: '',
    title: '',
    summary: '',
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/assessments/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.session_id) {
      setError('Please select a session');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/reports/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const data = await response.json();
      setSubmitted(true);
      setTimeout(() => navigate('/reports'), 2000);
    } catch (error) {
      setError(error.message);
      console.error('Report generation error:', error);
    }
  };

  if (loading) return <div className="generate-report"><p>Loading...</p></div>;

  return (
    <div className="generate-report">
      <div className="report-header">
        <h1>Generate Assessment Report</h1>
        <p>Create a comprehensive report from assessment session</p>
      </div>

      {submitted ? (
        <div className="success-message">
          <h2>✓ Report Generated Successfully</h2>
          <p>Redirecting to reports...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="report-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h2>Select Assessment Session</h2>
            <div className="form-group">
              <label htmlFor="session_id">Assessment Session</label>
              <select
                id="session_id"
                name="session_id"
                value={formData.session_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Select a session --</option>
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>
                    Patient {session.patient_id} - {new Date(session.session_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h2>Report Information</h2>
            
            <div className="form-group">
              <label htmlFor="title">Report Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Speech-Language Pathology Assessment Report"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                placeholder="Provide a summary of assessment findings and recommendations..."
                rows="8"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => navigate('/reports')} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              📄 Generate Report
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
