import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export default function AssignmentForm({ coachId, onClose, onSaved }) {
    const [communityId, setCommunityId] = useState('')
    const [sportId, setSportId] = useState('')
    const [salary, setSalary] = useState('')
    const [errors, setErrors] = useState({})

    const { data: communities = [] } = useQuery({
        queryKey: ['communities'],
        queryFn: async () => {
            const { data } = await supabase.from('communities').select('id, name').eq('status', 'active').order('name')
            return data ?? []
        },
    })

    const { data: sports = [] } = useQuery({
        queryKey: ['sports', communityId],
        enabled: !!communityId,
        queryFn: async () => {
            const { data } = await supabase
                .from('sports')
                .select('id, sport_name, weekly_off_days, operating_days')
                .eq('community_id', communityId)
                .order('sport_name')
            return data ?? []
        },
    })

    const selectedSport = sports.find(s => s.id === sportId)

    const validate = () => {
        const e = {}
        if (!communityId) e.community = 'Select a community'
        if (!sportId) e.sport = 'Select a sport'
        if (!salary || Number(salary) <= 0) e.salary = 'Monthly salary must be > 0'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('coach_sport_assignments').insert({
                coach_id: coachId,
                sport_id: sportId,
                monthly_salary: Number(salary),
            })
            if (error) throw error
        },
        onSuccess: onSaved,
        onError: (err) => setErrors({ form: err.message }),
    })

    const handleSubmit = (e) => { e.preventDefault(); if (validate()) mutate() }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Assign to Sport</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {errors.form && <div className="alert alert-danger">{errors.form}</div>}

                        <div className="input-group">
                            <label className="input-label">Community <span className="required">*</span></label>
                            <select className={`select${errors.community ? ' error' : ''}`}
                                value={communityId} onChange={e => { setCommunityId(e.target.value); setSportId('') }}>
                                <option value="">— Select Community —</option>
                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {errors.community && <span className="input-error">⚠ {errors.community}</span>}
                        </div>

                        <div className="input-group">
                            <label className="input-label">Sport <span className="required">*</span></label>
                            <select className={`select${errors.sport ? ' error' : ''}`}
                                value={sportId} onChange={e => setSportId(e.target.value)} disabled={!communityId}>
                                <option value="">— Select Sport —</option>
                                {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
                            </select>
                            {errors.sport && <span className="input-error">⚠ {errors.sport}</span>}
                        </div>

                        {selectedSport && (
                            <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
                                📅 <strong>Schedule:</strong> {selectedSport.operating_days?.join(', ')} · Off: {(selectedSport.weekly_off_days ?? []).join(', ')}
                            </div>
                        )}

                        <div className="input-group">
                            <label className="input-label">Monthly Salary (₹) <span className="required">*</span></label>
                            <input type="number" step="0.01" min="1"
                                className={`input font-mono${errors.salary ? ' error' : ''}`}
                                value={salary} onChange={e => setSalary(e.target.value)}
                                placeholder="e.g., 10000" />
                            <span className="hint">Per assignment — not shared with other assignments</span>
                            {errors.salary && <span className="input-error">⚠ {errors.salary}</span>}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isPending}>
                            {isPending ? 'Assigning…' : 'Assign Coach'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
