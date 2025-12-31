import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NewDashboard.css';

export default function NewDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ patients: 0, assessments: 0, reports: 0 });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(prev => ({ ...prev, patients: data.patients?.length || 0 }));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const assessmentTypes = [
    { name: 'Phonation', icon: '🔊', path: '/assessment/phonation' },
    { name: 'Respiratory', icon: '💨', path: '/assessment/respiratory' },
    { name: 'Rate of Speech', icon: '⚡', path: '/assessment/rate-of-speech' },
    { name: 'Voice Quality', icon: '🎤', path: '/assessment/voice-test' },
    { name: 'Articulation', icon: '📢', path: '/assessment/articulation' },
    { name: 'Resonance', icon: '🎺', path: '/assessment/resonance' },
    { name: 'S/Z Ratio', icon: '🗣️', path: '/assessment/sz-ratio' },
    { name: 'Pitch Analysis', icon: '🎵', path: '/assessment/pitch' },
  ];

  return (
    <div className="new-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>SLP Assessment Platform</h1>
          <p className="welcome">Welcome, {user?.first_name}!</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          🚪 Logout
        </button>
      </header>

      <div className="dashboard-container">
        {/* Stats Section */}
        <section className="stats-section">
          <div className="stat-box">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.patients}</h3>
              <p>Patients</p>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <h3>{stats.assessments}</h3>
              <p>Assessments</p>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.reports}</h3>
              <p>Reports</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button onClick={() => navigate('/add-patient')} className="action-btn">
              ➕ New Patient
            </button>
            <button onClick={() => navigate('/patients')} className="action-btn">
              👥 View Patients
            </button>
            <button onClick={() => navigate('/assessments')} className="action-btn">
              📋 Start Assessment
            </button>
            <button onClick={() => navigate('/reports')} className="action-btn">
              📊 View Reports
            </button>
          </div>
        </section>

        {/* Assessment Types Grid */}
        <section className="assessments-section">
          <h2>Available Assessments</h2>
          <div className="assessment-grid">
            {assessmentTypes.map((assessment, idx) => (
              <div
                key={idx}
                className="assessment-box"
                onClick={() => navigate(assessment.path)}
              >
                <div className="assessment-icon">{assessment.icon}</div>
                <h3>{assessment.name}</h3>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="recent-activity">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p className="no-activity">No recent activity</p>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="activity-item">
                  {activity.description}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
