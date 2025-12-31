import './Input.css';

const Input = ({
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  onBlur,
  disabled = false,
  error = '',
  label = '',
  className = '',
  ...props
}) => {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        className={`input ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
};

export default Input;
