import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PatientHistory() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredPatients = patients.filter(p =>
    p.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div>Loading patients...</div>;

  return (
    <div className="patient-history">
      <h2>Patient History</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search patients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="patients-list">
        {filteredPatients.length === 0 ? (
          <p>No patients found</p>
        ) : (
          filteredPatients.map(patient => (
            <div key={patient.id} className="patient-card" onClick={() => navigate(`/patient/${patient.id}`)}>
              <h3>{patient.first_name} {patient.last_name}</h3>
              <p>Email: {patient.email || 'N/A'}</p>
              <p>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</p>
              <p>Diagnosis: {patient.diagnosis || 'Not specified'}</p>
            </div>
          ))
        )}
      </div>
      <button onClick={() => navigate('/add-patient')} className="btn-primary">
        Add New Patient
      </button>
    </div>
  );
}
