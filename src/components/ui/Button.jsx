export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    ...props
}) {
    const cls = [
        'btn',
        `btn-${variant}`,
        size !== 'md' ? `btn-${size}` : '',
        className,
    ].filter(Boolean).join(' ')

    return (
        <button className={cls} disabled={disabled || loading} {...props}>
            {loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
            {children}
        </button>
    )
}
