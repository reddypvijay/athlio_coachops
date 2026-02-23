import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const EMPTY = {
    name: '', phone: '+91', email: '',
    bank_account_number: '', bank_ifsc: '', upi_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'active',
    sport_master_id: '',        // coach's primary sport (global catalog)
}

function emptyAssignment() {
    return { community_id: '', monthly_salary: '' }
}

export default function CoachForm({ coach, onClose, onSaved }) {
    const [form, setForm] = useState(coach ? {
        name: coach.name, phone: coach.phone, email: coach.email ?? '',
        bank_account_number: '',
        bank_ifsc: coach.bank_ifsc, upi_id: coach.upi_id ?? '',
        joining_date: coach.joining_date, status: coach.status,
        sport_master_id: coach.sport_master_id ?? '',
    } : EMPTY)
    const [assignments, setAssignments] = useState([emptyAssignment()])
    const [errors, setErrors] = useState({})
    const [showBankAccount, setShowBankAccount] = useState(false)

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    // Global sport catalog
    const { data: sportMasters = [] } = useQuery({
        queryKey: ['sport_masters'],
        queryFn: async () => {
            const { data, error } = await supabase.from('sport_masters').select('id, name').order('name')
            if (error) throw error
            return data
        },
    })

    // All communities
    const { data: communities = [] } = useQuery({
        queryKey: ['communities-list'],
        queryFn: async () => {
            const { data, error } = await supabase.from('communities').select('id, name').order('name')
            if (error) throw error
            return data
        },
    })

    // All sports (for auto-lookup community+sport_master → sport_id at save time)
    const { data: allSports = [] } = useQuery({
        queryKey: ['all-sports'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sports')
                .select('id, sport_master_id, community_id')
            if (error) throw error
            return data
        },
    })

    function updateAssignment(idx, key, val) {
        setAssignments(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], [key]: val }
            return next
        })
    }

    function addAssignment() {
        setAssignments(prev => [...prev, emptyAssignment()])
    }

    function removeAssignment(idx) {
        setAssignments(prev => prev.filter((_, i) => i !== idx))
    }

    const validate = () => {
        const e = {}
        if (!form.name.trim()) e.name = 'Name is required'
        if (!/^\+91[6-9]\d{9}$/.test(form.phone)) e.phone = 'Must be +91XXXXXXXXXX'
        if (form.email && !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'Invalid email format'
        if (!coach && !form.bank_account_number.trim()) e.bank_account_number = 'Bank account is required'
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc)) e.bank_ifsc = 'Format: XXXX0XXXXXX (e.g., SBIN0001234)'
        if (!form.joining_date) e.joining_date = 'Joining date is required'
        if (!form.sport_master_id) e.sport_master_id = 'Sport is required'

        if (!coach) {
            assignments.forEach((a, i) => {
                const hasData = a.community_id || a.monthly_salary
                if (hasData) {
                    if (!a.community_id) e[`asgn_${i}_community`] = 'Select a community'
                    if (!a.monthly_salary || isNaN(Number(a.monthly_salary)) || Number(a.monthly_salary) <= 0)
                        e[`asgn_${i}_salary`] = 'Enter a valid salary'
                    // If sport is selected, verify the community has that sport configured
                    if (form.sport_master_id && a.community_id) {
                        const match = allSports.find(
                            s => s.community_id === a.community_id && s.sport_master_id === form.sport_master_id
                        )
                        if (!match) e[`asgn_${i}_sport`] = `This sport is not configured for this community`
                    }
                }
            })
        }

        setErrors(e)
        return Object.keys(e).length === 0
    }

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const payload = {
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                bank_ifsc: form.bank_ifsc.trim().toUpperCase(),
                upi_id: form.upi_id.trim() || null,
                joining_date: form.joining_date,
                status: form.status,
                sport_master_id: form.sport_master_id || null,
            }
            if (form.bank_account_number.trim()) {
                payload.bank_account_number = form.bank_account_number.trim()
            }

            if (coach) {
                const { error } = await supabase.from('coaches').update(payload).eq('id', coach.id)
                if (error) throw error
            } else {
                const { data: newCoach, error } = await supabase
                    .from('coaches')
                    .insert(payload)
                    .select('id')
                    .single()
                if (error) throw error

                // Resolve sport_id from community + sport_master
                const validAssignments = assignments.filter(a => a.community_id && a.monthly_salary)
                if (validAssignments.length > 0 && form.sport_master_id) {
                    const rows = []
                    for (const a of validAssignments) {
                        const sport = allSports.find(
                            s => s.community_id === a.community_id && s.sport_master_id === form.sport_master_id
                        )
                        if (sport) {
                            rows.push({
                                coach_id: newCoach.id,
                                sport_id: sport.id,
                                monthly_salary: Number(a.monthly_salary),
                            })
                        }
                    }
                    if (rows.length > 0) {
                        const { error: aErr } = await supabase.from('coach_sport_assignments').insert(rows)
                        if (aErr) throw aErr
                    }
                }
            }
        },
        onSuccess: onSaved,
        onError: (err) => setErrors({ form: err.message }),
    })

    const handleSubmit = (e) => { e.preventDefault(); if (validate()) mutate() }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{coach ? 'Edit Coach' : 'Add Coach'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {errors.form && <div className="alert alert-danger">{errors.form}</div>}

                        {/* Basic Info */}
                        <div className="form-grid">
                            <div className="input-group full-width">
                                <label className="input-label">Full Name <span className="required">*</span></label>
                                <input className={`input${errors.name ? ' error' : ''}`} value={form.name} onChange={set('name')} placeholder="e.g., Priya Sharma" />
                                {errors.name && <span className="input-error">⚠ {errors.name}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Phone <span className="required">*</span></label>
                                <input className={`input${errors.phone ? ' error' : ''}`} value={form.phone} onChange={set('phone')} placeholder="+91XXXXXXXXXX" />
                                {errors.phone && <span className="input-error">⚠ {errors.phone}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Email</label>
                                <input className={`input${errors.email ? ' error' : ''}`} type="email" value={form.email} onChange={set('email')} placeholder="Optional" />
                                {errors.email && <span className="input-error">⚠ {errors.email}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Joining Date <span className="required">*</span></label>
                                <input type="date" className={`input${errors.joining_date ? ' error' : ''}`} value={form.joining_date} onChange={set('joining_date')} />
                                {errors.joining_date && <span className="input-error">⚠ {errors.joining_date}</span>}
                            </div>

                            {/* Sport moved here, next to Joining Date */}
                            <div className="input-group">
                                <label className="input-label">Sport <span className="hint">Optional</span></label>
                                <select className="select" value={form.sport_master_id} onChange={set('sport_master_id')}>
                                    <option value="">— Select sport —</option>
                                    {sportMasters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            {coach && (
                                <div className="input-group">
                                    <label className="input-label">Status</label>
                                    <select className="select" value={form.status} onChange={set('status')}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="on_leave">On Leave</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Bank Details */}
                        <hr className="divider" />
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            🔒 Bank Details (Encrypted at Rest)
                        </div>

                        <div className="form-grid">
                            <div className="input-group full-width">
                                <label className="input-label">
                                    Bank Account Number <span className="required">*</span>
                                    {coach && <span className="hint" style={{ marginLeft: '6px' }}>(leave blank to keep current)</span>}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className={`input${errors.bank_account_number ? ' error' : ''}`}
                                        type={showBankAccount ? 'text' : 'password'}
                                        value={form.bank_account_number}
                                        onChange={set('bank_account_number')}
                                        placeholder={coach ? '•••• (hidden)' : 'Account number'}
                                        style={{ paddingRight: '50px' }}
                                    />
                                    <button type="button" onClick={() => setShowBankAccount(s => !s)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>
                                        {showBankAccount ? '🙈' : '👁'}
                                    </button>
                                </div>
                                {errors.bank_account_number && <span className="input-error">⚠ {errors.bank_account_number}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">IFSC Code <span className="required">*</span></label>
                                <input
                                    className={`input font-mono${errors.bank_ifsc ? ' error' : ''}`}
                                    value={form.bank_ifsc}
                                    onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
                                    placeholder="SBIN0001234" maxLength={11}
                                />
                                {errors.bank_ifsc && <span className="input-error">⚠ {errors.bank_ifsc}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">UPI ID <span className="hint">Optional</span></label>
                                <input className="input" value={form.upi_id} onChange={set('upi_id')} placeholder="e.g., coach@upi" />
                            </div>
                        </div>

                        {/* Sport Assignments — only for new coaches */}
                        {!coach && (
                            <>
                                <hr className="divider" />
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    🏅 Community Assignments <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — can be added later)</span>
                                </div>

                                {!form.sport_master_id && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)' }}>
                                        Select a sport above to link communities to this coach.
                                    </div>
                                )}

                                {form.sport_master_id && assignments.map((a, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 8, alignItems: 'start' }}>
                                        <div>
                                            {i === 0 && <div className="input-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Community</div>}
                                            <select
                                                className={`select${errors[`asgn_${i}_community`] ? ' error' : ''}`}
                                                value={a.community_id}
                                                onChange={e => updateAssignment(i, 'community_id', e.target.value)}
                                            >
                                                <option value="">— Community —</option>
                                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            {errors[`asgn_${i}_community`] && <span className="input-error" style={{ fontSize: '0.7rem' }}>⚠ {errors[`asgn_${i}_community`]}</span>}
                                            {errors[`asgn_${i}_sport`] && <span className="input-error" style={{ fontSize: '0.7rem' }}>⚠ {errors[`asgn_${i}_sport`]}</span>}
                                        </div>

                                        <div>
                                            {i === 0 && <div className="input-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Monthly Salary ₹</div>}
                                            <input
                                                className={`input font-mono${errors[`asgn_${i}_salary`] ? ' error' : ''}`}
                                                type="number" min="0" placeholder="0"
                                                value={a.monthly_salary}
                                                onChange={e => updateAssignment(i, 'monthly_salary', e.target.value)}
                                            />
                                            {errors[`asgn_${i}_salary`] && <span className="input-error" style={{ fontSize: '0.7rem' }}>⚠ {errors[`asgn_${i}_salary`]}</span>}
                                        </div>

                                        <div style={{ paddingTop: i === 0 ? 22 : 0 }}>
                                            {assignments.length > 1 && (
                                                <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => removeAssignment(i)} title="Remove">✕</button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {form.sport_master_id && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={addAssignment} style={{ alignSelf: 'flex-start' }}>
                                        + Add Another Community
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isPending}>
                            {isPending ? 'Saving…' : coach ? 'Save Changes' : 'Add Coach'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
