import React, { useState } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const quickActions = [
    {
      id: 1,
      title: 'New Assessment',
      description: 'Start a new assessment session',
      icon: '📋',
      action: () => navigate('/assessments'),
      color: '#FF6B6B',
    },
    {
      id: 2,
      title: 'Add Patient',
      description: 'Register a new patient',
      icon: '👤',
      action: () => navigate('/add-patient'),
      color: '#4ECDC4',
    },
    {
      id: 3,
      title: 'View Patients',
      description: 'Browse patient records',
      icon: '👥',
      action: () => navigate('/patients'),
      color: '#FFD93D',
    },
    {
      id: 4,
      title: 'View Reports',
      description: 'Access assessment reports',
      icon: '📊',
      action: () => navigate('/reports'),
      color: '#95E1D3',
    },
  ];

  const recentAssessments = [
    { id: 1, patient: 'John Smith', type: 'Phonation', date: '2024-01-15', status: 'Completed' },
    { id: 2, patient: 'Sarah Johnson', type: 'Rate of Speech', date: '2024-01-14', status: 'Completed' },
    { id: 3, patient: 'Michael Brown', type: 'Resonance Analysis', date: '2024-01-13', status: 'In Progress' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Welcome, {user?.first_name}!</h1>
          <p>SLP Assessment Platform</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </header>

      <div className="dashboard-content">
        {/* Quick Stats */}
        <section className="stats-section">
          <div className="stat-card">
            <h3>Total Patients</h3>
            <p className="stat-value">--</p>
          </div>
          <div className="stat-card">
            <h3>Assessments Today</h3>
            <p className="stat-value">--</p>
          </div>
          <div className="stat-card">
            <h3>Pending Reports</h3>
            <p className="stat-value">--</p>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="actions-section">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            {quickActions.map(action => (
              <div
                key={action.id}
                className="action-card"
                onClick={action.action}
                style={{ borderTopColor: action.color }}
              >
                <div className="action-icon" style={{ color: action.color }}>
                  {action.icon}
                </div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Assessments */}
        <section className="recent-section">
          <h2>Recent Assessments</h2>
          <div className="assessments-table">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Assessment Type</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAssessments.map(assessment => (
                  <tr key={assessment.id}>
                    <td>{assessment.patient}</td>
                    <td>{assessment.type}</td>
                    <td>{assessment.date}</td>
                    <td>
                      <span className={`status ${assessment.status.toLowerCase().replace(' ', '-')}`}>
                        {assessment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SLP Information */}
        <section className="info-section">
          <h2>Your Profile</h2>
          <div className="info-card">
            <p><strong>Name:</strong> {user?.first_name} {user?.last_name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            {user?.license_number && <p><strong>License:</strong> {user.license_number}</p>}
            {user?.specialization && <p><strong>Specialization:</strong> {user.specialization}</p>}
            {user?.organization && <p><strong>Organization:</strong> {user.organization}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
