import './Card.css';

const Card = ({
  children,
  title,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      className={`card ${hoverable ? 'card-hoverable' : ''} ${className}`}
      onClick={onClick}
    >
      {title && <div className="card-header">{title}</div>}
      <div className="card-body">{children}</div>
    </div>
  );
};

export default Card;
