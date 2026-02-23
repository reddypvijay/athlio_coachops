import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getDaysInMonth } from 'date-fns'
import XLSXStyle from 'xlsx-js-style'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Convert 0-based column index to Excel column letter (0=A, 25=Z, 26=AA, 35=AJ, 42=AQ)
function col(idx) {
    let result = ''
    let n = idx
    do {
        result = String.fromCharCode(65 + (n % 26)) + result
        n = Math.floor(n / 26) - 1
    } while (n >= 0)
    return result
}

// Shared border style
const BORDER = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
}

function cell(v, t, s = {}) {
    return { v, t, s }
}

function formulaCell(f, v, s = {}) {
    return { f, t: 'n', v: v ?? 0, s }
}

function attStyle(code) {
    const fills = { A: 'FFC7CE', WO: 'C6EFCE', PH: 'FFEB9C', HD: 'FFD966', SUB: 'FFE699' }
    const fontColors = { A: '9C0006', WO: '276221', PH: '9C6500', HD: '843C0C' }
    return {
        font: { bold: code !== 'P' && code !== '', sz: 10, color: { rgb: fontColors[code] ?? '000000' } },
        fill: { fgColor: { rgb: fills[code] ?? 'FFFFFF' } }, // white for P and empty cells
        alignment: { horizontal: 'center', vertical: 'center' },
        border: BORDER,
    }
}

export default function AttendanceExport() {
    const now = new Date()
    const [communityId, setCommunityId] = useState('')
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [generating, setGenerating] = useState(false)

    const { data: communities = [] } = useQuery({
        queryKey: ['communities'],
        queryFn: async () => {
            const { data } = await supabase.from('communities').select('id, name').eq('status', 'active').order('name')
            return data ?? []
        },
    })

    const selectedCommunity = communities.find(c => c.id === communityId)

    const { data: exportData, isLoading } = useQuery({
        queryKey: ['attendance-export', communityId, month, year],
        enabled: !!communityId,
        queryFn: async () => {
            const { data: sports } = await supabase
                .from('sports')
                .select('id, sport_name, operating_days, weekly_off_days')
                .eq('community_id', communityId)
                .order('sport_name')
            if (!sports?.length) return { rows: [], totalDays: getDaysInMonth(new Date(year, month - 1)) }

            const sportIds = sports.map(s => s.id)
            const { data: assignments } = await supabase
                .from('coach_sport_assignments')
                .select('coach_id, sport_id, monthly_salary, coaches(id, name, joining_date)')
                .in('sport_id', sportIds)

            const coachIds = [...new Set((assignments ?? []).map(a => a.coach_id))]
            let attRecords = []
            if (coachIds.length > 0) {
                const { data: att } = await supabase
                    .from('monthly_attendance')
                    .select('coach_id, sport_id, attendance_data')
                    .eq('month', month).eq('year', year)
                    .in('coach_id', coachIds)
                attRecords = att ?? []
            }

            const lastDay = getDaysInMonth(new Date(year, month - 1))
            const { data: ph } = await supabase
                .from('paid_holidays')
                .select('date')
                .eq('community_id', communityId)
                .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
                .lte('date', `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
            const phDays = new Set((ph ?? []).map(p => parseInt(p.date.split('-')[2], 10)))

            const attMap = {}
            for (const r of attRecords) attMap[`${r.coach_id}_${r.sport_id}`] = r.attendance_data || {}

            const sportMap = Object.fromEntries(sports.map(s => [s.id, s]))
            const sorted = [...(assignments ?? [])].sort((a, b) => {
                const sA = sportMap[a.sport_id]?.sport_name ?? ''
                const sB = sportMap[b.sport_id]?.sport_name ?? ''
                return sA !== sB ? sA.localeCompare(sB) : (a.coaches?.name ?? '').localeCompare(b.coaches?.name ?? '')
            })

            let serial = 1
            const rows = []
            for (const asgn of sorted) {
                const sport = sportMap[asgn.sport_id]
                const coach = asgn.coaches
                if (!coach || !sport) continue

                const attData = attMap[`${asgn.coach_id}_${asgn.sport_id}`] || {}
                const weeklyOff = new Set(sport.weekly_off_days ?? [])

                let fromDay = 1
                if (coach.joining_date) {
                    const jd = new Date(coach.joining_date)
                    if (jd.getFullYear() === year && jd.getMonth() + 1 === month) fromDay = jd.getDate()
                }

                const dayCodes = {}
                let p = 0, a = 0, wo = 0, ph_ = 0, hd = 0, sub = 0
                for (let d = 1; d <= lastDay; d++) {
                    if (d < fromDay) { dayCodes[d] = ''; continue }
                    const saved = attData[String(d)]
                    let code
                    if (saved) code = saved
                    else if (phDays.has(d)) code = 'PH'
                    else if (weeklyOff.has(DAY_NAMES[new Date(year, month - 1, d).getDay()])) code = 'WO'
                    else code = 'P'
                    dayCodes[d] = code
                    if (code === 'P') p++
                    else if (code === 'A') a++
                    else if (code === 'WO') wo++
                    else if (code === 'PH') ph_++
                    else if (code === 'HD') hd++
                    else if (code === 'SUB') { p++; sub++ }
                }

                rows.push({
                    serial: serial++,
                    name: coach.name,
                    designation: sport.sport_name,
                    dayCodes,
                    totalP: p, totalA: a, totalWO: wo, totalPH: ph_, totalHD: hd,
                    totalPaidDays: p + ph_ + wo + hd * 0.5,
                })
            }

            return { rows, totalDays: lastDay }
        },
    })

    function generateExcel() {
        if (!exportData?.rows?.length) return
        setGenerating(true)
        try {
            const { rows, totalDays } = exportData
            const communityName = selectedCommunity?.name ?? ''
            const monthName = MONTHS[month - 1]
            const monthShort = MONTH_SHORT[month - 1]
            const lastDayColIdx = 4 + totalDays - 1  // E=4, AI=34 for 31 days
            const lastDayCol = col(lastDayColIdx)

            const wb = XLSXStyle.utils.book_new()
            const ws = {}

            // ── Styles ──────────────────────────────────────────────────────
            const CENTER = { horizontal: 'center', vertical: 'center', wrapText: true }
            const hdrStyle = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'D9E1F2' } }, alignment: CENTER, border: BORDER }
            const sumHdrStyle = { font: { bold: true, sz: 8 }, fill: { fgColor: { rgb: 'D9E1F2' } }, alignment: CENTER, border: BORDER }
            const dayHdrStyle = { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'BDD7EE' } }, alignment: CENTER, border: BORDER }
            const dataStyle = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: BORDER }
            const numStyle = { font: { sz: 10 }, alignment: CENTER, border: BORDER }
            const sumStyle = { font: { sz: 10 }, alignment: CENTER, border: BORDER }
            const totalStyle = { font: { bold: true, sz: 10 }, alignment: CENTER, border: BORDER }
            const labelStyle = { font: { bold: true, sz: 11 } }

            // ── Row 1-2: Title ───────────────────────────────────────────────
            ws['A1'] = cell(`Muster  Roll For the  Month of ${monthName} ${year}`, 's',
                { font: { bold: true, sz: 14 }, alignment: { horizontal: 'left', vertical: 'center' } })

            // ── Rows 3-5: Info ───────────────────────────────────────────────
            ws['A3'] = cell('Community Name                       :', 's', labelStyle)
            ws['D3'] = cell(communityName, 's', {})
            ws['A4'] = cell('Attendance Month                     : ', 's', labelStyle)
            ws['D4'] = cell(`${monthShort}-${String(year).slice(2)}`, 's', {})
            ws['A5'] = cell('Department                              :', 's', labelStyle)
            ws['D5'] = cell('Club House', 's', {})

            // ── Row 7-8: Column headers ──────────────────────────────────────
            ws['A7'] = cell('Sl.No', 's', hdrStyle)
            ws['B7'] = cell('Sl.no', 's', hdrStyle)
            ws['C7'] = cell('Name', 's', hdrStyle)
            ws['D7'] = cell('Designation', 's', hdrStyle)

            for (let d = 1; d <= totalDays; d++) {
                const c = col(4 + d - 1)
                const dayName = DAY_ABBR[new Date(year, month - 1, d).getDay()]
                ws[`${c}7`] = cell(dayName, 's', dayHdrStyle)
                ws[`${c}8`] = cell(String(d).padStart(2, '0'), 's', dayHdrStyle)
            }

            // Summary column headers (AJ=35 … AQ=42)
            const sumHeaders = ['Total Days\nPresent', 'Total PH', 'Total CL/SL/PL', 'Total Comp Off', 'Total Weekoff', 'Total Half Days', 'Half Day\nCount', 'Total Paid Days']
            sumHeaders.forEach((h, i) => { ws[`${col(35 + i)}7`] = cell(h, 's', sumHdrStyle) })

            // ── Data rows ────────────────────────────────────────────────────
            rows.forEach((row, idx) => {
                const r = 9 + idx
                ws[`A${r}`] = cell(row.serial, 'n', numStyle)
                ws[`B${r}`] = cell(row.serial, 'n', numStyle)
                ws[`C${r}`] = cell(row.name, 's', dataStyle)
                ws[`D${r}`] = cell(row.designation, 's', dataStyle)

                for (let d = 1; d <= totalDays; d++) {
                    const code = row.dayCodes[d] ?? 'P'
                    ws[`${col(4 + d - 1)}${r}`] = cell(code, 's', attStyle(code))
                }

                // COUNTIF formulas — mirroring the reference file exactly
                ws[`AJ${r}`] = formulaCell(`COUNTIF(E${r}:${lastDayCol}${r},"p")`, row.totalP, sumStyle)
                ws[`AK${r}`] = formulaCell(`COUNTIF(E${r}:${lastDayCol}${r},"ph")`, row.totalPH, sumStyle)
                ws[`AL${r}`] = formulaCell(
                    `COUNTIF(E${r}:${lastDayCol}${r},"cl")+COUNTIF(E${r}:${lastDayCol}${r},"sl")+COUNTIF(E${r}:${lastDayCol}${r},"pl")`,
                    0, sumStyle)
                ws[`AM${r}`] = formulaCell(`COUNTIF(E${r}:${lastDayCol}${r},"co")`, 0, sumStyle)
                ws[`AN${r}`] = formulaCell(`COUNTIF(E${r}:${lastDayCol}${r},"wo")`, row.totalWO, sumStyle)
                ws[`AP${r}`] = formulaCell(`COUNTIF(E${r}:${lastDayCol}${r},"hd")`, row.totalHD, sumStyle)
                ws[`AO${r}`] = formulaCell(`AP${r}/2`, row.totalHD / 2, sumStyle)
                ws[`AQ${r}`] = formulaCell(`AJ${r}+AK${r}+AL${r}+AN${r}+AO${r}+AM${r}`, row.totalPaidDays, totalStyle)
            })

            // ── Footer ───────────────────────────────────────────────────────
            const footerRow = 9 + rows.length + 1
            ws[`B${footerRow}`] = cell('Prepared By', 's', { font: { bold: true }, border: BORDER })
            ws[`Q${footerRow}`] = cell('Checked By', 's', { font: { bold: true }, border: BORDER })
            ws[`AJ${footerRow}`] = cell('Approved By', 's', { font: { bold: true }, border: BORDER })

            // ── Sheet range ──────────────────────────────────────────────────
            ws['!ref'] = `A1:${col(42)}${footerRow}`

            // ── Merges ───────────────────────────────────────────────────────
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 1, c: 12 } },  // A1:M2 title
                { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },   // A3:C3
                { s: { r: 2, c: 3 }, e: { r: 2, c: 6 } },   // D3:G3
                { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },   // A4:C4
                { s: { r: 3, c: 3 }, e: { r: 3, c: 6 } },   // D4:G4
                { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },   // A5:C5
                { s: { r: 4, c: 3 }, e: { r: 4, c: 6 } },   // D5:G5
                { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },   // A7:A8
                { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } },   // B7:B8
                { s: { r: 6, c: 2 }, e: { r: 7, c: 2 } },   // C7:C8
                { s: { r: 6, c: 3 }, e: { r: 7, c: 3 } },   // D7:D8
                // Summary headers merged across rows 7-8
                ...Array.from({ length: 8 }, (_, i) => ({ s: { r: 6, c: 35 + i }, e: { r: 7, c: 35 + i } })),
                // Footer
                { s: { r: footerRow - 1, c: 1 }, e: { r: footerRow - 1, c: 6 } },   // B:G
                { s: { r: footerRow - 1, c: 16 }, e: { r: footerRow - 1, c: 25 } },  // Q:Z
                { s: { r: footerRow - 1, c: 35 }, e: { r: footerRow - 1, c: 42 } },  // AJ:AQ
            ]

            // ── Column widths ─────────────────────────────────────────────────
            ws['!cols'] = [
                { wch: 4 },   // A: Sl.No
                { wch: 5.5 }, // B: Sl.no
                { wch: 18 },  // C: Name
                { wch: 22 },  // D: Designation
                ...Array.from({ length: totalDays }, () => ({ wch: 4.5 })),
                { wch: 8 },   // AJ: Total Present
                { wch: 6 },   // AK: Total PH
                { wch: 9 },   // AL: CL/SL/PL
                { wch: 7 },   // AM: Comp Off
                { wch: 8 },   // AN: Weekoff
                { wch: 7 },   // AO: HD value
                { wch: 7 },   // AP: HD count
                { wch: 8 },   // AQ: Paid Days
            ]

            // ── Row heights ───────────────────────────────────────────────────
            ws['!rows'] = Array.from({ length: footerRow }, () => ({ hpt: 28 }))

            XLSXStyle.utils.book_append_sheet(wb, ws, 'Attendance')
            XLSXStyle.writeFile(wb,
                `Muster_Roll_${communityName.replace(/\s+/g, '_')}_${monthShort}_${year}.xlsx`)
        } finally {
            setGenerating(false)
        }
    }

    const rows = exportData?.rows ?? []
    const totalDays = exportData?.totalDays ?? getDaysInMonth(new Date(year, month - 1))

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance Export</h1>
                    <p className="page-subtitle">Generate monthly muster roll sheets for any community.</p>
                </div>
                {rows.length > 0 && (
                    <button className="btn btn-primary" onClick={generateExcel} disabled={generating}>
                        {generating ? 'Generating…' : '⬇ Download Excel'}
                    </button>
                )}
            </div>

            <div className="page-body">
                {/* Filter bar */}
                <div className="card mb-6">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: '1 1 220px' }}>
                            <label className="input-label">Community</label>
                            <select className="select" value={communityId} onChange={e => setCommunityId(e.target.value)}>
                                <option value="">— Select Community —</option>
                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 110px' }}>
                            <label className="input-label">Month</label>
                            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 90px' }}>
                            <label className="input-label">Year</label>
                            <select className="select" value={year} onChange={e => setYear(Number(e.target.value))}>
                                {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {!communityId ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <div className="empty-state-title">Select a Community</div>
                        <p className="empty-state-text">Choose a community to preview and download the muster roll.</p>
                    </div>
                ) : isLoading ? (
                    <div className="page-loading"><div className="spinner" /> Loading attendance data…</div>
                ) : rows.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">No Coaches Assigned</div>
                        <p className="empty-state-text">No coaches are assigned to {selectedCommunity?.name} yet.</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">
                                    Muster Roll — {selectedCommunity?.name} — {MONTHS[month - 1]} {year}
                                </h3>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {rows.length} coaches · Scroll right to see all days →
                                </p>
                            </div>
                            <button className="btn btn-primary" onClick={generateExcel} disabled={generating}>
                                {generating ? 'Generating…' : '⬇ Download Excel'}
                            </button>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0 0 12px', fontSize: '0.75rem' }}>
                            {[['P', 'Present', 'var(--text-muted)', 'transparent'], ['WO', 'Week Off', '#166534', '#C6EFCE'], ['PH', 'Paid Holiday', '#713f12', '#FFEB9C'], ['A', 'Absent', '#991b1b', '#FFC7CE'], ['HD', 'Half Day', '#92400e', '#FFD966']].map(([code, label, color, bg]) => (
                                <span key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ background: bg, color, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 3, padding: '1px 6px', fontWeight: 600, fontSize: '0.72rem' }}>{code}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                </span>
                            ))}
                        </div>

                        <div className="table-wrap" style={{ fontSize: '0.78rem' }}>
                            <table style={{ minWidth: 'max-content', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 36, textAlign: 'center', padding: '4px 3px', position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface-2)' }}>No</th>
                                        <th style={{ minWidth: 160, padding: '4px 8px', position: 'sticky', left: 36, zIndex: 2, background: 'var(--surface-2)' }}>Name</th>
                                        <th style={{ minWidth: 130, padding: '4px 8px', position: 'sticky', left: 196, zIndex: 2, background: 'var(--surface-2)' }}>Designation</th>
                                        {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                                            <th key={d} style={{ minWidth: 36, textAlign: 'center', padding: '3px 2px' }}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                                                    {DAY_ABBR[new Date(year, month - 1, d).getDay()]}
                                                </div>
                                                <div style={{ lineHeight: 1.4 }}>{String(d).padStart(2, '0')}</div>
                                            </th>
                                        ))}
                                        {['P', 'PH', 'WO', 'HD', 'A', 'Paid'].map(h => (
                                            <th key={h} style={{ minWidth: 44, textAlign: 'center', fontSize: '0.68rem', padding: '4px 3px' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(row => (
                                        <tr key={`${row.serial}`}>
                                            <td style={{ textAlign: 'center', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }}>{row.serial}</td>
                                            <td style={{ fontWeight: 600, padding: '4px 8px', position: 'sticky', left: 36, zIndex: 1, background: 'var(--surface)', whiteSpace: 'nowrap' }}>{row.name}</td>
                                            <td style={{ color: 'var(--text-muted)', padding: '4px 8px', position: 'sticky', left: 196, zIndex: 1, background: 'var(--surface)', whiteSpace: 'nowrap' }}>{row.designation}</td>
                                            {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
                                                const code = row.dayCodes[d] ?? 'P'
                                                const bg = { A: '#fca5a5', WO: '#86efac', PH: '#fef08a', HD: '#fb923c', SUB: '#fde68a' }[code]
                                                const fc = { A: '#7f1d1d', WO: '#14532d', PH: '#713f12', HD: '#7c2d12', SUB: '#78350f' }[code]
                                                return (
                                                    <td key={d} style={{
                                                        textAlign: 'center', padding: '3px 2px',
                                                        background: bg || 'transparent',
                                                        color: fc || 'var(--text-muted)',
                                                        fontWeight: code !== 'P' && code !== '' ? 600 : 400,
                                                        fontSize: '0.7rem',
                                                    }}>{code}</td>
                                                )
                                            })}
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.totalP}</td>
                                            <td style={{ textAlign: 'center', color: '#b45309' }}>{row.totalPH}</td>
                                            <td style={{ textAlign: 'center', color: '#15803d' }}>{row.totalWO}</td>
                                            <td style={{ textAlign: 'center', color: '#c2410c' }}>{row.totalHD}</td>
                                            <td style={{ textAlign: 'center', color: '#b91c1c' }}>{row.totalA}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--success)' }}>{row.totalPaidDays}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
