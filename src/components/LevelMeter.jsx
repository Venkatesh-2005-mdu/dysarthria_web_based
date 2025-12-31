import './LevelMeter.css';

const LevelMeter = ({ level = 0, max = 100, label = '', className = '' }) => {
  const percentage = (level / max) * 100;
  
  let color = '#28a745';
  if (percentage > 70) color = '#dc3545';
  else if (percentage > 40) color = '#ffc107';

  return (
    <div className={`level-meter ${className}`}>
      {label && <label className="level-label">{label}</label>}
      <div className="meter-bar">
        <div
          className="meter-fill"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="level-value">{Math.round(level)}</span>
    </div>
  );
};

export default LevelMeter;
