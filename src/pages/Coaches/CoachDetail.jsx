import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import CoachForm from './CoachForm'
import AssignmentForm from './AssignmentForm'
import { useToast } from '../../context/ToastContext'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE = 5 * 1024 * 1024

export default function CoachDetail() {
    const { id } = useParams()
    const qc = useQueryClient()
    const { showToast } = useToast()
    const [editingCoach, setEditingCoach] = useState(false)
    const [addingAssignment, setAddingAssignment] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const aadhaarRef = useRef()
    const panRef = useRef()
    const certRef = useRef()

    const { data: coach, isLoading } = useQuery({
        queryKey: ['coach', id],
        queryFn: async () => {
            const { data, error } = await supabase.from('coaches').select('*').eq('id', id).single()
            if (error) throw error
            return data
        },
    })

    const { data: assignments = [] } = useQuery({
        queryKey: ['assignments', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('coach_sport_assignments')
                .select('*, sports(sport_name, weekly_off_days, operating_days, communities(name))')
                .eq('coach_id', id)
            if (error) throw error
            return data
        },
    })

    const deleteAssignment = useMutation({
        mutationFn: async (assignId) => {
            const { error } = await supabase.from('coach_sport_assignments').delete().eq('id', assignId)
            if (error) throw error
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', id] }),
    })

    const uploadDoc = async (file, docType) => {
        setUploadError('')
        if (!ALLOWED_TYPES.includes(file.type)) { setUploadError('Only PDF, JPG, PNG allowed'); return }
        if (file.size > MAX_SIZE) { setUploadError('File must be under 5MB'); return }
        const ext = file.name.split('.').pop()
        const path = `${id}/${docType}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('coach-documents').upload(path, file, { upsert: true })
        if (uploadErr) { setUploadError(uploadErr.message); return }
        const colName = docType === 'aadhaar' ? 'document_aadhaar_url' : 'document_pan_url'
        await supabase.from('coaches').update({ [colName]: path }).eq('id', id)
        qc.invalidateQueries({ queryKey: ['coach', id] })
    }

    const uploadCert = async (file) => {
        setUploadError('')
        if (!ALLOWED_TYPES.includes(file.type)) { setUploadError('Only PDF, JPG, PNG allowed'); return }
        if (file.size > MAX_SIZE) { setUploadError('File must be under 5MB'); return }
        const ext = file.name.split('.').pop()
        const certs = coach?.document_certificates ?? []
        const path = `${id}/certificates/cert_${Date.now()}.${ext}`
        await supabase.storage.from('coach-documents').upload(path, file)
        await supabase.from('coaches').update({ document_certificates: [...certs, path] }).eq('id', id)
        qc.invalidateQueries({ queryKey: ['coach', id] })
    }

    if (isLoading) return <div className="page-loading"><div className="spinner" /> Loading…</div>
    if (!coach) return <div className="page-body"><div className="alert alert-danger">Coach not found.</div></div>

    const docsComplete = coach.document_aadhaar_url && coach.document_pan_url

    return (
        <>
            <div className="page-header">
                <div>
                    <Link to="/coaches" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>← Coaches</Link>
                    <h1 className="page-title" style={{ marginTop: '6px' }}>{coach.name}</h1>
                    <p className="page-subtitle">
                        {coach.phone}{coach.email ? ` · ${coach.email}` : ''} · Joined {new Date(coach.joining_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!docsComplete && <span className="badge badge-warning">⚠ Documents Missing</span>}
                    <button className="btn btn-ghost" onClick={() => setEditingCoach(true)}>Edit Coach</button>
                </div>
            </div>

            <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Assignments */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Sport Assignments ({assignments.length})</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setAddingAssignment(true)}>+ Assign Sport</button>
                    </div>
                    {assignments.length === 0 ? (
                        <p className="text-muted text-sm">No assignments yet. Assign this coach to a sport.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {assignments.map(a => (
                                <div key={a.id} style={{
                                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)', padding: '14px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                            {a.sports?.sport_name} @ {a.sports?.communities?.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {(a.sports?.operating_days ?? []).join(', ')} · Off: {(a.sports?.weekly_off_days ?? []).join(', ')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: 'var(--primary)' }}>
                                            ₹{Number(a.monthly_salary).toLocaleString('en-IN')}
                                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '3px' }}>/mo</span>
                                        </div>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => { if (confirm('Remove this assignment?')) deleteAssignment.mutate(a.id) }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {assignments.length > 0 && (
                                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-muted)', paddingRight: '4px' }}>
                                    Total: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
                                        ₹{assignments.reduce((s, a) => s + Number(a.monthly_salary), 0).toLocaleString('en-IN')}
                                    </strong>/month
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bank Details */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🔒 Payment Details</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem' }}>
                        <div>
                            <div className="text-muted text-xs" style={{ marginBottom: '3px' }}>BANK ACCOUNT</div>
                            <div className="font-mono">••••••••••••</div>
                        </div>
                        <div>
                            <div className="text-muted text-xs" style={{ marginBottom: '3px' }}>IFSC CODE</div>
                            <div className="font-mono">{coach.bank_ifsc}</div>
                        </div>
                        {coach.upi_id && (
                            <div>
                                <div className="text-muted text-xs" style={{ marginBottom: '3px' }}>UPI ID</div>
                                <div className="font-mono">{coach.upi_id}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Documents */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Documents</h3>
                    </div>
                    {uploadError && <div className="alert alert-danger mb-4">{uploadError}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'Aadhaar', field: 'document_aadhaar_url', ref: aadhaarRef, docType: 'aadhaar' },
                            { label: 'PAN Card', field: 'document_pan_url', ref: panRef, docType: 'pan' },
                        ].map(({ label, field, ref, docType }) => (
                            <div key={docType} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</div>
                                    {coach[field]
                                        ? <span className="badge badge-success" style={{ marginTop: '4px' }}>✓ Uploaded</span>
                                        : <span className="badge badge-warning" style={{ marginTop: '4px' }}>⚠ Missing</span>
                                    }
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()}>
                                    {coach[field] ? 'Replace' : 'Upload'}
                                </button>
                                <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && uploadDoc(e.target.files[0], docType)} />
                            </div>
                        ))}

                        {/* Certificates */}
                        <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Coaching Certificates</div>
                                <button className="btn btn-secondary btn-sm" onClick={() => certRef.current?.click()}>+ Upload</button>
                                <input ref={certRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && uploadCert(e.target.files[0])} />
                            </div>
                            {(coach.document_certificates ?? []).length === 0
                                ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No certificates uploaded.</p>
                                : <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{coach.document_certificates.length} certificate(s) uploaded.</p>
                            }
                        </div>
                    </div>
                </div>
            </div>

            {editingCoach && (
                <CoachForm coach={coach} onClose={() => setEditingCoach(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['coach', id] }); setEditingCoach(false); showToast('Coach updated successfully!') }} />
            )}
            {addingAssignment && (
                <AssignmentForm coachId={id} onClose={() => setAddingAssignment(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['assignments', id] }); setAddingAssignment(false); showToast('Assignment added!') }} />
            )}
        </>
    )
}
