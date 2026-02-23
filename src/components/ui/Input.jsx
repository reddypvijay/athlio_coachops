export default function Input({
    label,
    id,
    error,
    helper,
    className = '',
    ...props
}) {
    return (
        <div className={`form-group ${className}`}>
            {label && <label className="form-label" htmlFor={id}>{label}</label>}
            <input
                id={id}
                className={`form-input${error ? ' input-error' : ''}`}
                {...props}
            />
            {error && <p className="form-error">{error}</p>}
            {helper && !error && <p className="form-helper">{helper}</p>}
        </div>
    )
}
