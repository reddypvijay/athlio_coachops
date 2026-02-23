import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function SubstituteModal({ isOpen, onClose, date, coachId, sportId, communityId, onSaved }) {
    const [form, setForm] = useState({
        substitute_coach_name: '',
        substitute_phone: '+91',
        payment_amount: '',
    })
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    function validate() {
        const errs = {}
        if (!form.substitute_coach_name.trim()) errs.substitute_coach_name = 'Name is required'
        if (!/^\+91[6-9]\d{9}$/.test(form.substitute_phone)) errs.substitute_phone = 'Enter valid +91XXXXXXXXXX number'
        const amt = parseFloat(form.payment_amount)
        if (!form.payment_amount || isNaN(amt) || amt <= 0) errs.payment_amount = 'Enter a valid amount > 0'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    async function handleSave() {
        if (!validate()) return
        setSaving(true)
        try {
            const { error } = await supabase.from('substitute_logs').insert({
                original_coach_id: coachId,
                substitute_coach_name: form.substitute_coach_name.trim(),
                substitute_phone: form.substitute_phone,
                payment_amount: parseFloat(form.payment_amount),
                date,
                community_id: communityId,
                sport_id: sportId,
                is_paid: false,
            })
            if (error) throw error
            onSaved()
            onClose()
            setForm({ substitute_coach_name: '', substitute_phone: '+91', payment_amount: '' })
        } catch (err) {
            setErrors({ submit: err.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Substitute" width={480}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
                Date: <strong style={{ color: 'var(--text)' }}>{date}</strong>
            </p>

            <Input
                label="Substitute Name"
                id="sub-name"
                value={form.substitute_coach_name}
                onChange={e => set('substitute_coach_name', e.target.value)}
                placeholder="Full name"
                error={errors.substitute_coach_name}
            />

            <Input
                label="Phone Number"
                id="sub-phone"
                value={form.substitute_phone}
                onChange={e => set('substitute_phone', e.target.value)}
                placeholder="+91XXXXXXXXXX"
                error={errors.substitute_phone}
            />

            <Input
                label="Payment Amount (₹)"
                id="sub-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.payment_amount}
                onChange={e => set('payment_amount', e.target.value)}
                placeholder="e.g. 500"
                error={errors.payment_amount}
            />

            {errors.submit && (
                <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginTop: 8 }}>{errors.submit}</p>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" loading={saving} onClick={handleSave}>Save Substitute</Button>
            </div>
        </Modal>
    )
}
