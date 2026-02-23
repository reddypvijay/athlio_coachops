import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const EMPTY = {
    name: '', address: '', contact_person: '', contact_phone: '+91',
    contract_start_date: '', monthly_fee: '', status: 'active',
}

export default function CommunityForm({ community, onClose, onSaved }) {
    const [form, setForm] = useState(community ? {
        name: community.name,
        address: community.address,
        contact_person: community.contact_person,
        contact_phone: community.contact_phone,
        contract_start_date: community.contract_start_date,
        monthly_fee: community.monthly_fee ?? '',
        status: community.status,
    } : EMPTY)
    const [errors, setErrors] = useState({})

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    const validate = () => {
        const e = {}
        if (!form.name.trim()) e.name = 'Community name is required'
        if (form.name.length > 200) e.name = 'Max 200 chars'
        if (!form.address.trim()) e.address = 'Address is required'
        if (!form.contact_person.trim()) e.contact_person = 'Contact person is required'
        if (!/^\+91[6-9]\d{9}$/.test(form.contact_phone)) e.contact_phone = 'Must be +91XXXXXXXXXX'
        if (!form.contract_start_date) e.contract_start_date = 'Start date is required'
        if (form.monthly_fee && Number(form.monthly_fee) < 0) e.monthly_fee = 'Must be ≥ 0'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const payload = {
                name: form.name.trim(),
                address: form.address.trim(),
                contact_person: form.contact_person.trim(),
                contact_phone: form.contact_phone.trim(),
                contract_start_date: form.contract_start_date,
                monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
                status: form.status,
            }
            if (community) {
                const { error } = await supabase.from('communities').update(payload).eq('id', community.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('communities').insert(payload)
                if (error) throw error
            }
        },
        onSuccess: onSaved,
        onError: (err) => setErrors({ form: err.message }),
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validate()) mutate()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{community ? 'Edit Community' : 'Add Community'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {errors.form && <div className="alert alert-danger">{errors.form}</div>}

                        <div className="form-grid">
                            <div className="input-group full-width">
                                <label className="input-label">Community Name <span className="required">*</span></label>
                                <input className={`input${errors.name ? ' error' : ''}`} value={form.name} onChange={set('name')} placeholder="e.g., Aparna Zenith" />
                                {errors.name && <span className="input-error">⚠ {errors.name}</span>}
                            </div>

                            <div className="input-group full-width">
                                <label className="input-label">Address <span className="required">*</span></label>
                                <textarea className={`textarea${errors.address ? ' error' : ''}`} value={form.address} onChange={set('address')} placeholder="Full address" rows={2} />
                                {errors.address && <span className="input-error">⚠ {errors.address}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Contact Person <span className="required">*</span></label>
                                <input className={`input${errors.contact_person ? ' error' : ''}`} value={form.contact_person} onChange={set('contact_person')} placeholder="Name" />
                                {errors.contact_person && <span className="input-error">⚠ {errors.contact_person}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Contact Phone <span className="required">*</span></label>
                                <input className={`input${errors.contact_phone ? ' error' : ''}`} value={form.contact_phone} onChange={set('contact_phone')} placeholder="+91XXXXXXXXXX" />
                                {errors.contact_phone && <span className="input-error">⚠ {errors.contact_phone}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Contract Start Date <span className="required">*</span></label>
                                <input type="date" className={`input${errors.contract_start_date ? ' error' : ''}`} value={form.contract_start_date} onChange={set('contract_start_date')} />
                                {errors.contract_start_date && <span className="input-error">⚠ {errors.contract_start_date}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Monthly Fee (₹) <span className="hint">Optional</span></label>
                                <input type="number" step="0.01" min="0" className="input" value={form.monthly_fee} onChange={set('monthly_fee')} placeholder="0.00" />
                            </div>

                            {community && (
                                <div className="input-group full-width">
                                    <label className="input-label">Status</label>
                                    <select className="select" value={form.status} onChange={set('status')}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="terminated">Terminated</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isPending}>
                            {isPending ? 'Saving…' : community ? 'Save Changes' : 'Add Community'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
