import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function emptyForm() {
    return {
        sport_master_id: '',
        sport_name: '',
        operating_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        weekly_off_days: ['Sunday'],
        location_within_community: '',
        notes: '',
        shift_timings: [{ start: '', end: '' }],
    }
}

export default function SportForm({ communityId, sport, onClose, onSaved }) {
    const [form, setForm] = useState(sport ? {
        sport_master_id: sport.sport_master_id ?? '',
        sport_name: sport.sport_name,
        operating_days: sport.operating_days ?? [],
        // Handle both old (string) and new (array) format
        weekly_off_days: Array.isArray(sport.weekly_off_days)
            ? sport.weekly_off_days
            : sport.weekly_off_day
                ? [sport.weekly_off_day]
                : [],
        location_within_community: sport.location_within_community ?? '',
        notes: sport.notes ?? '',
        shift_timings: sport.shift_timings?.length ? sport.shift_timings : [{ start: '', end: '' }],
    } : emptyForm())
    const [errors, setErrors] = useState({})

    const { data: sportMasters = [], isLoading: mastersLoading } = useQuery({
        queryKey: ['sport_masters'],
        queryFn: async () => {
            const { data, error } = await supabase.from('sport_masters').select('id, name').order('name')
            if (error) throw error
            return data
        },
    })

    // Toggle operating day — also remove from weekly_off_days if re-added as operating
    const toggleOperatingDay = (day) => {
        setForm(f => {
            const has = f.operating_days.includes(day)
            const nextOp = has ? f.operating_days.filter(d => d !== day) : [...f.operating_days, day]
            // If day becomes operating, it can't also be a weekly off
            const nextOff = has ? f.weekly_off_days : f.weekly_off_days.filter(d => d !== day)
            return { ...f, operating_days: nextOp, weekly_off_days: nextOff }
        })
    }

    // Toggle weekly off day — only days NOT in operating_days are valid
    const toggleWeeklyOffDay = (day) => {
        setForm(f => {
            const has = f.weekly_off_days.includes(day)
            const next = has
                ? f.weekly_off_days.filter(d => d !== day)
                : [...f.weekly_off_days, day]
            return { ...f, weekly_off_days: next }
        })
    }

    const updateShift = (i, key, val) => {
        setForm(f => {
            const ts = [...f.shift_timings]
            ts[i] = { ...ts[i], [key]: val }
            return { ...f, shift_timings: ts }
        })
    }
    const addShift = () => setForm(f => ({ ...f, shift_timings: [...f.shift_timings, { start: '', end: '' }] }))
    const removeShift = (i) => setForm(f => ({ ...f, shift_timings: f.shift_timings.filter((_, idx) => idx !== i) }))

    const validate = () => {
        const e = {}
        if (!form.sport_master_id) e.sport_master_id = 'Please select a sport from the catalog'
        if (form.operating_days.length === 0) e.operating_days = 'Select at least one operating day'
        const offOverlap = form.weekly_off_days.filter(d => form.operating_days.includes(d))
        if (offOverlap.length > 0) e.weekly_off_days = `Cannot be both operating and off: ${offOverlap.join(', ')}`
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const selectedMaster = sportMasters.find(m => m.id === form.sport_master_id)
            const payload = {
                community_id: communityId,
                sport_master_id: form.sport_master_id,
                sport_name: selectedMaster?.name ?? form.sport_name,
                operating_days: form.operating_days,
                weekly_off_days: form.weekly_off_days,
                location_within_community: form.location_within_community.trim() || null,
                notes: form.notes.trim() || null,
                shift_timings: form.shift_timings.filter(t => t.start && t.end),
            }
            if (sport) {
                const { error } = await supabase.from('sports').update(payload).eq('id', sport.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('sports').insert(payload)
                if (error) throw error
            }
        },
        onSuccess: onSaved,
        onError: (err) => setErrors({ form: err.message }),
    })

    const handleSubmit = (e) => { e.preventDefault(); if (validate()) mutate() }

    // Days available for weekly off = all days NOT marked as operating
    const offDayOptions = ALL_DAYS.filter(d => !form.operating_days.includes(d))

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{sport ? 'Edit Sport' : 'Add Sport to Community'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {errors.form && <div className="alert alert-danger">{errors.form}</div>}

                        {/* Sport selector */}
                        <div className="input-group">
                            <label className="input-label">Sport <span className="required">*</span></label>
                            {mastersLoading ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading sports catalog…</div>
                            ) : sportMasters.length === 0 ? (
                                <div style={{ color: 'var(--warning)', fontSize: '0.875rem', padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                                    ⚠ No sports in the catalog yet. Go to <strong>Sports</strong> in the sidebar to add some first.
                                </div>
                            ) : (
                                <select
                                    className={`select${errors.sport_master_id ? ' error' : ''}`}
                                    value={form.sport_master_id}
                                    onChange={e => setForm(f => ({ ...f, sport_master_id: e.target.value }))}
                                >
                                    <option value="">— Select sport —</option>
                                    {sportMasters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            )}
                            {errors.sport_master_id && <span className="input-error">⚠ {errors.sport_master_id}</span>}
                        </div>

                        {/* Operating Days */}
                        <div className="input-group">
                            <label className="input-label">Operating Days <span className="required">*</span></label>
                            <div className="checkbox-group">
                                {ALL_DAYS.map(d => (
                                    <div key={d}
                                        className={`day-chip${form.operating_days.includes(d) ? ' active' : ''}`}
                                        onClick={() => toggleOperatingDay(d)}
                                    >
                                        {d.slice(0, 3)}
                                    </div>
                                ))}
                            </div>
                            {errors.operating_days && <span className="input-error">⚠ {errors.operating_days}</span>}
                        </div>

                        {/* Weekly Off Days — multi-select */}
                        <div className="input-group">
                            <label className="input-label">
                                Weekly Off Days
                                <span className="hint" style={{ marginLeft: 6 }}>Select one or more</span>
                            </label>
                            {offDayOptions.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    All days are selected as operating — deselect some to mark weekly offs.
                                </div>
                            ) : (
                                <div className="checkbox-group">
                                    {offDayOptions.map(d => (
                                        <div key={d}
                                            className={`day-chip${form.weekly_off_days.includes(d) ? ' active' : ''}`}
                                            onClick={() => toggleWeeklyOffDay(d)}
                                            style={form.weekly_off_days.includes(d) ? { background: 'rgba(248,113,113,0.2)', borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}
                                        >
                                            {d.slice(0, 3)}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {form.weekly_off_days.length > 0 && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    Weekly offs: <strong>{form.weekly_off_days.join(', ')}</strong>
                                </div>
                            )}
                            {errors.weekly_off_days && <span className="input-error">⚠ {errors.weekly_off_days}</span>}
                        </div>

                        {/* Shifts */}
                        <div className="input-group">
                            <label className="input-label">Shift Timings</label>
                            {form.shift_timings.map((t, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                    <input className="input" type="time" value={t.start} onChange={e => updateShift(i, 'start', e.target.value)} style={{ flex: 1 }} />
                                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                                    <input className="input" type="time" value={t.end} onChange={e => updateShift(i, 'end', e.target.value)} style={{ flex: 1 }} />
                                    {form.shift_timings.length > 1 && (
                                        <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => removeShift(i)}>✕</button>
                                    )}
                                </div>
                            ))}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={addShift} style={{ alignSelf: 'flex-start' }}>+ Add Shift</button>
                        </div>

                        <div className="form-grid">
                            <div className="input-group">
                                <label className="input-label">Location</label>
                                <input className="input" value={form.location_within_community}
                                    onChange={e => setForm(f => ({ ...f, location_within_community: e.target.value }))}
                                    placeholder="e.g., Court 1, Pool Area" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Notes</label>
                                <input className="input" value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Optional notes" />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isPending || sportMasters.length === 0}>
                            {isPending ? 'Saving…' : sport ? 'Save Changes' : 'Add Sport'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
