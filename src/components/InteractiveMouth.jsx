import './InteractiveMouth.css';

const InteractiveMouth = ({ state = 'neutral', phoneme = '' }) => {
  const getMouthShape = () => {
    switch (state) {
      case 'closed':
        return 'mouth-closed';
      case 'open':
        return 'mouth-open';
      case 'smile':
        return 'mouth-smile';
      case 'round':
        return 'mouth-round';
      default:
        return 'mouth-neutral';
    }
  };

  return (
    <div className="interactive-mouth">
      <div className="mouth-container">
        <svg viewBox="0 0 200 200" className="mouth-svg">
          {/* Head circle */}
          <circle cx="100" cy="80" r="60" fill="#fdbcb4" stroke="#333" strokeWidth="2" />

          {/* Eyes */}
          <circle cx="80" cy="60" r="6" fill="#333" />
          <circle cx="120" cy="60" r="6" fill="#333" />

          {/* Mouth */}
          <g className={getMouthShape()}>
            <path d="M 70 100 Q 100 120 130 100" stroke="#333" strokeWidth="3" fill="none" />
          </g>

          {/* Optional: eyebrows */}
          <path d="M 65 45 Q 80 40 95 45" stroke="#333" strokeWidth="2" fill="none" />
          <path d="M 105 45 Q 120 40 135 45" stroke="#333" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {phoneme && (
        <div className="phoneme-label">
          <span className="phoneme">{phoneme}</span>
        </div>
      )}
    </div>
  );
};

export default InteractiveMouth;
