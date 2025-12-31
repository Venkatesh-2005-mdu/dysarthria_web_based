import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SLPProfile.css';

export default function SLPProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch profile');

      const data = await response.json();
      setUser(data.user);
      setFormData(data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
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

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      setUser(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  if (loading) return <div className="slp-profile"><p>Loading profile...</p></div>;

  return (
    <div className="slp-profile">
      <div className="profile-header">
        <button onClick={() => navigate(-1)} className="btn-back">← Back</button>
        <h1>SLP Profile</h1>
        <button onClick={() => setIsEditing(!isEditing)} className="btn-edit">
          {isEditing ? '❌ Cancel' : '✏️ Edit'}
        </button>
      </div>

      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-avatar">
            {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
          </div>

          <div className="profile-content">
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>License Number</label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Specialization</label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Organization</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                  />
                </div>
                <button onClick={handleSave} className="btn-save">
                  💾 Save Changes
                </button>
              </div>
            ) : (
              <div className="profile-info">
                <h2>{user?.first_name} {user?.last_name}</h2>
                <p className="email">{user?.email}</p>

                <div className="info-section">
                  <h3>Professional Information</h3>
                  <p><strong>License Number:</strong> {user?.license_number || 'Not provided'}</p>
                  <p><strong>Specialization:</strong> {user?.specialization || 'Not specified'}</p>
                  <p><strong>Organization:</strong> {user?.organization || 'Not specified'}</p>
                  <p><strong>Phone:</strong> {user?.phone || 'Not provided'}</p>
                </div>

                <div className="info-section">
                  <h3>Account Information</h3>
                  <p><strong>Member Since:</strong> {new Date(user?.created_at).toLocaleDateString()}</p>
                  <p><strong>Status:</strong> {user?.is_active ? '✓ Active' : '✗ Inactive'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
