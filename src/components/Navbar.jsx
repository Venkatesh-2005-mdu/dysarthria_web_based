import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ userRole = 'slp', userName = 'User' }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          🗣️ SLP Assessment Platform
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link
              to="/dashboard"
              className={`nav-link ${isActive('/dashboard')}`}
            >
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/assessments"
              className={`nav-link ${isActive('/assessments')}`}
            >
              Assessments
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/patients"
              className={`nav-link ${isActive('/patients')}`}
            >
              Patients
            </Link>
          </li>
          <li className="nav-item">
            <Link
              to="/reports"
              className={`nav-link ${isActive('/reports')}`}
            >
              Reports
            </Link>
          </li>
          {userRole === 'slp' && (
            <li className="nav-item">
              <Link
                to="/profile"
                className={`nav-link ${isActive('/profile')}`}
              >
                Profile
              </Link>
            </li>
          )}
          <li className="nav-item">
            <span className="nav-username">{userName}</span>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
