import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RespiratoryAssessment.css";

export default function RespiratoryAssessment() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    breathingPattern: "",
    speechBreath: "",
    nonSpeechBreath: "",
    blowingTime: "",
  });

  // Scroll to top on component mount
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Respiratory Assessment Saved:", formData);

    // After saving → go back to AssessmentHome
    navigate("/assessments");
  };

  return (
    <div className="resp-wrapper">
      {/* Premium Navbar */}
      <nav className="resp-navbar">
        <div className="navbar-left">
          <button className="nav-back-btn" onClick={() => navigate("/assessmenthome")}>
            ← Back
          </button>
          <h2 className="navbar-title">Respiratory Assessment</h2>
        </div>
        <div className="navbar-right">
          <div className="nav-progress">
            <span className="progress-label">Step 1 of 6</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "16.67%" }} />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb Navigation */}
      <div className="resp-breadcrumb">
        <span>Dashboard</span>
        <span className="breadcrumb-separator">›</span>
        <span>Assessments</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">Respiratory</span>
      </div>

      {/* Instructions Card */}
      <div className="resp-instructions glass-card">
        <div className="instructions-header">
          <h3 className="instructions-title">Assessment Guidelines</h3>
        </div>
        <div className="instructions-tips">
          <div className="tip-item">
            <span className="tip-icon">💨</span>
            <p><strong>Breathing Pattern:</strong> Assess the primary breathing pattern (thoracic, clavicular, or abdominal) at rest.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🗣️</span>
            <p><strong>Speech Breathing:</strong> Evaluate breathing adequacy during connected speech and narrative tasks.</p>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⏱️</span>
            <p><strong>Blowing Duration:</strong> Measure sustained blowing time as an indicator of respiratory support.</p>
          </div>
        </div>
      </div>

      <form className="resp-form glass-card" onSubmit={handleSubmit}>
        
        {/* Breathing Pattern */}
        <div className="resp-field">
          <label>Breathing Pattern</label>
          <select name="breathingPattern" onChange={handleChange} required>
            <option value="">Select</option>
            <option value="thoracic">Thoracic</option>
            <option value="clavicular">Clavicular</option>
            <option value="abdominal">Abdominal</option>
          </select>
        </div>

        {/* Speech Breathing */}
        <div className="resp-field">
          <label>Breathing Pattern During Speech</label>
          <select name="speechBreath" onChange={handleChange} required>
            <option value="">Select</option>
            <option value="adequate">Adequate</option>
            <option value="inadequate">Inadequate</option>
          </select>
        </div>

        {/* Non-Speech Breathing */}
        <div className="resp-field">
          <label>Breathing Pattern During Non-Speech</label>
          <select name="nonSpeechBreath" onChange={handleChange} required>
            <option value="">Select</option>
            <option value="adequate">Adequate</option>
            <option value="inadequate">Inadequate</option>
          </select>
        </div>

        {/* Blowing Time */}
        <div className="resp-field">
          <label>Blowing Duration (in seconds)</label>
          <input
            type="number"
            min="0"
            name="blowingTime"
            placeholder="Enter seconds"
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="resp-btn glass-btn">
          💾 Save & Return Home
        </button>
      </form>
    </div>
  );
}
