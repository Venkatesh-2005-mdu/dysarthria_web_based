import React, { useState } from 'react';
import './Patient.css'; // Import the CSS file

const Patient = () => {
  // 1. State for form submission and data
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [impression, setImpression] = useState("");
  const [history, setHistory] = useState("");
  const [prevHistory, setPrevHistory] = useState("");

  // Handler for the submit button
  const handleAddPatient = () => {
    // Basic validation
    if (name && age && gender) { // Keeping validation minimal
      setIsSubmitted(true);
    } else {
      alert("Some required fields have not been filled!");
    }
  };

  // --- RENDERING THE FORM (Two-Column Layout) ---
  const renderForm = () => (
    <>
      <h2>Patient Information</h2>
      
      
      <div className="form-grid">

        {/* --- COLUMN 1: Short Inputs (Name, Age, Gender) --- */}
        <div className="column-left">
          
          {/* Name Field */}
          <div className="patient-detail">
            <label htmlFor="name">Name:</label>
            <input 
              id="name" type="text" className="detail-input" 
              value={name} onChange={(e) => setName(e.target.value)} 
            />
          </div>

          {/* Age Field */}
          <div className="patient-detail">
            <label htmlFor="age">Age:</label>
            <input 
              id="age" type="number" className="detail-input" 
              value={age} onChange={(e) => setAge(e.target.value)} 
            />
          </div>

          {/* Gender Field */}
          <div className="patient-detail">
            <label htmlFor="gender">Gender:</label>
            <select 
              id="gender" className="detail-select" 
              value={gender} onChange={(e) => setGender(e.target.value)}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div> {/* End of column-left */}


        {/* --- COLUMN 2: Long Textareas (Clinical, Brief, Prev. History) --- */}
        <div className="column-right">
          
          {/* Clinical Impression */}
          <div className="patient-detail full-width">
            <label htmlFor="impression">Clinical Impression:</label>
            <textarea
              id="impression" className="detail-textarea"
              value={impression} onChange={(e) => setImpression(e.target.value)}
              rows="3"
            />
          </div>

          {/* Brief History */}
          <div className="patient-detail full-width">
            <label htmlFor="history">Brief History:</label>
            <textarea
              id="history" className="detail-textarea"
              value={history} onChange={(e) => setHistory(e.target.value)}
              rows="3"
            />
          </div>

          {/* Previous Medical History */}
          <div className="patient-detail full-width">
            <label htmlFor="prevHistory">Prev. Medical History:</label>
            <textarea
              id="prevHistory" className="detail-textarea"
              value={prevHistory} onChange={(e) => setPrevHistory(e.target.value)}
              rows="3"
            />
          </div>
        </div> {/* End of column-right */}
        
      </div> {/* End of form-grid */}

      {/* --- Submit Button (Stays outside the grid to span full width) --- */}
      <button 
        className="add-patient-button" 
        onClick={handleAddPatient}
      >
        Add Patient
      </button>
    </>
  );

  // --- RENDERING THE SUMMARY (Logic is fine, no changes needed) ---
  const renderSummary = () => (
    <div className="patient-summary">
      <h2>Patient Details Saved!</h2>
      <div className="summary-detail">
        <strong>Name:</strong> <span>{name || 'N/A'}</span>
      </div>
      <div className="summary-detail">
        <strong>Age:</strong> <span>{age || 'N/A'}</span>
      </div>
      <div className="summary-detail">
        <strong>Gender:</strong> <span>{gender || 'N/A'}</span>
      </div>
      <div className="summary-detail full-summary-text">
        <strong>Clinical Impression:</strong> <p>{impression || 'None recorded'}</p>
      </div>
      <div className="summary-detail full-summary-text">
        <strong>Brief History:</strong> <p>{history || 'None recorded'}</p>
      </div>
      <div className="summary-detail full-summary-text">
        <strong>Prev. Medical History:</strong> <p>{prevHistory || 'None recorded'}</p>
      </div>
      <button 
        className="add-patient-button back-button" 
        onClick={() => setIsSubmitted(false)}
      >
        Go Back to Form
      </button>
    </div>
  );

  // The main return uses a conditional rendering based on the state
  return (
    <div className="patient-card">
      {isSubmitted ? renderSummary() : renderForm()}
    </div>
  );
};

export default Patient;