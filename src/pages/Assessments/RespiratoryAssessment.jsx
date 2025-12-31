import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import './RespiratoryAssessment.css';

export default function RespiratoryAssessment() {
  const { patientId } = useParams();
  const [formData, setFormData] = useState({
    vital_capacity: '',
    inspiratory_capacity: '',
    expiratory_capacity: '',
    phonation_duration: '',
    breathing_pattern: 'normal',
    breathing_rate: '',
  });
  const [results, setResults] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/assessments/respiratory', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error('Failed to save assessment');

      const data = await response.json();
      setResults(data.data || data);
      setSubmitted(true);
    } catch (error) {
      console.error('Submission error:', error);
    }
  };

  return (
    <div className="respiratory-assessment">
      <div className="assessment-header">
        <h2>Respiratory Assessment</h2>
        <p>Evaluate patient's respiratory function and phonation support</p>
      </div>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="assessment-form">
          <div className="form-section">
            <h3>Vital Capacity Measures</h3>
            
            <div className="form-group">
              <label>Vital Capacity (liters)</label>
              <input
                type="number"
                name="vital_capacity"
                step="0.1"
                value={formData.vital_capacity}
                onChange={handleChange}
                placeholder="e.g., 3.5"
              />
              <small>Total amount of air that can be exhaled</small>
            </div>

            <div className="form-group">
              <label>Inspiratory Capacity (liters)</label>
              <input
                type="number"
                name="inspiratory_capacity"
                step="0.1"
                value={formData.inspiratory_capacity}
                onChange={handleChange}
                placeholder="e.g., 3.0"
              />
              <small>Maximum amount of air that can be inhaled</small>
            </div>

            <div className="form-group">
              <label>Expiratory Capacity (liters)</label>
              <input
                type="number"
                name="expiratory_capacity"
                step="0.1"
                value={formData.expiratory_capacity}
                onChange={handleChange}
                placeholder="e.g., 2.5"
              />
              <small>Maximum amount of air that can be exhaled</small>
            </div>
          </div>

          <div className="form-section">
            <h3>Phonation Support</h3>
            
            <div className="form-group">
              <label>Phonation Duration (seconds)</label>
              <input
                type="number"
                name="phonation_duration"
                step="0.1"
                value={formData.phonation_duration}
                onChange={handleChange}
                placeholder="e.g., 15.5"
              />
              <small>How long patient can sustain voicing on one breath</small>
            </div>

            <div className="form-group">
              <label>Breathing Rate (breaths per minute)</label>
              <input
                type="number"
                name="breathing_rate"
                value={formData.breathing_rate}
                onChange={handleChange}
                placeholder="e.g., 14"
              />
            </div>

            <div className="form-group">
              <label>Breathing Pattern</label>
              <select name="breathing_pattern" value={formData.breathing_pattern} onChange={handleChange}>
                <option value="normal">Normal</option>
                <option value="shallow">Shallow</option>
                <option value="labored">Labored</option>
                <option value="irregular">Irregular</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-large">
            Save Assessment
          </button>
        </form>
      ) : (
        <div className="results-section">
          <h3>✓ Assessment Saved</h3>
          <div className="saved-data">
            <p><strong>Vital Capacity:</strong> {formData.vital_capacity} L</p>
            <p><strong>Phonation Duration:</strong> {formData.phonation_duration}s</p>
            <p><strong>Breathing Rate:</strong> {formData.breathing_rate} bpm</p>
            <p><strong>Pattern:</strong> {formData.breathing_pattern}</p>
          </div>
        </div>
      )}
    </div>
  );
}
