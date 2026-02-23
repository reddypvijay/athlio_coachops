export default function Table({ columns, data, keyField = 'id', emptyMessage = 'No records found.' }) {
    return (
        <div className="table-wrapper">
            <table className="table">
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th key={col.key} style={col.style || {}}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map(row => (
                            <tr key={row[keyField]}>
                                {columns.map(col => (
                                    <td key={col.key} style={col.style || {}}>
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
