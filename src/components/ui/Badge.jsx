/**
 * variant: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'
 */
export default function Badge({ children, variant = 'neutral', className = '' }) {
    return (
        <span className={`badge badge-${variant} ${className}`}>
            {children}
        </span>
    )
}
