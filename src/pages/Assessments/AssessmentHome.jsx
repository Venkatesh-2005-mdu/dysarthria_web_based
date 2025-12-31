import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AssessmentHome.css';

export default function AssessmentHome() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/patients', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch patients');

      const data = await response.json();
      setPatients(data.patients || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const assessments = [
    {
      id: 'phonation',
      name: 'Phonation Test',
      description: 'Analyze voice quality: fundamental frequency, jitter, shimmer',
      icon: '🔊',
      color: '#FF6B6B',
    },
    {
      id: 'rate-of-speech',
      name: 'Rate of Speech',
      description: 'Measure speaking rate: words per minute, articulation rate',
      icon: '⚡',
      color: '#4ECDC4',
    },
    {
      id: 'resonance',
      name: 'Resonance Analysis',
      description: 'Detect nasality and resonance characteristics',
      icon: '🎺',
      color: '#FFD93D',
    },
    {
      id: 'articulation',
      name: 'Articulation Screener',
      description: 'Assess phoneme accuracy and articulation clarity',
      icon: '📢',
      color: '#95E1D3',
    },
    {
      id: 'sz-ratio',
      name: 'S/Z Ratio',
      description: 'Measure fricative duration and efficiency ratio',
      icon: '🗣️',
      color: '#FFA07A',
    },
    {
      id: 'pitch',
      name: 'Pitch Analysis',
      description: 'Comprehensive pitch analysis and frequency range',
      icon: '🎵',
      color: '#B19CD9',
    },
    {
      id: 'pataka',
      name: 'Pataka Test',
      description: 'Rapid syllable repetition and articulation rate',
      icon: '💨',
      color: '#87CEEB',
    },
  ];

  const handleAssessmentClick = (assessment) => {
    if (!selectedPatient) {
      setError('Please select a patient first');
      return;
    }
    navigate(`/assessment/${assessment.id}/${selectedPatient.id}`);
  };

  if (loading) return <div className="assessment-container"><p>Loading patients...</p></div>;

  return (
    <div className="assessment-home">
      <div className="assessment-header">
        <h1>Speech Assessment Center</h1>
        <p>Select a patient and choose an assessment</p>
      </div>

      <div className="assessment-layout">
        {/* Patient Selection */}
        <div className="patient-selector">
          <h2>Select Patient</h2>
          {error && <div className="error-message">{error}</div>}
          <div className="patient-list">
            {patients.length === 0 ? (
              <div className="no-patients">
                <p>No patients found</p>
                <button onClick={() => navigate('/add-patient')} className="btn-primary">
                  Add Patient
                </button>
              </div>
            ) : (
              patients.map(patient => (
                <div
                  key={patient.id}
                  className={`patient-item ${selectedPatient?.id === patient.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div className="patient-info">
                    <h3>{patient.first_name} {patient.last_name}</h3>
                    <p className="patient-id">ID: {patient.id}</p>
                    {patient.diagnosis && <p className="patient-diagnosis">{patient.diagnosis}</p>}
                  </div>
                  <div className={`selection-indicator ${selectedPatient?.id === patient.id ? 'active' : ''}`}>
                    ✓
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assessment Grid */}
        <div className="assessment-grid">
          <h2>Available Assessments</h2>
          {selectedPatient && (
            <p className="selected-patient-info">
              Testing: <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong>
            </p>
          )}
          <div className="assessment-cards">
            {assessments.map(assessment => (
              <div
                key={assessment.id}
                className="assessment-card"
                style={{ borderTopColor: assessment.color }}
                onClick={() => handleAssessmentClick(assessment)}
              >
                <div className="assessment-icon" style={{ color: assessment.color }}>
                  {assessment.icon}
                </div>
                <h3>{assessment.name}</h3>
                <p>{assessment.description}</p>
                <button
                  className="start-btn"
                  style={{ backgroundColor: assessment.color }}
                  disabled={!selectedPatient}
                >
                  Start Assessment
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
