# CoachOps Task Plan
**Version:** 2.2 (Updated post-Session 4)
**Last Updated:** 2026-02-23
**First operational month:** March 2026

---

## ✅ Protocol 0: Initialization
- [x] Project directory structure created
- [x] task_plan.md created (v1) → updated to v2 → v2.1 → v2.2
- [x] findings.md created
- [x] progress.md created
- [x] gemini.md created (v1) → updated to v2 → v2.1
- [x] Discovery Questions confirmed by user
- [x] task_plan.md approved by user

---

## ✅ Phase 1: Foundation & Database
- [x] Supabase project created (`vjopoeugkfkdkipxtzhz`, ap-south-1)
- [x] Database schema — **9 tables:**
  - [x] `communities`
  - [x] `sports` (weekly_off_days TEXT[], sport_master_id FK)
  - [x] `sport_masters` — global sport catalog
  - [x] `coaches` (bank details, joining_date, **relieving_date** ⭐ NEW)
  - [x] `coach_sport_assignments` (monthly_salary per assignment)
  - [x] `monthly_attendance` (exception-based, total_paid_days now NUMERIC(6,1))
  - [x] `paid_holidays` (per community, per date)
  - [x] `substitute_logs` (includes payment_date)
- [x] RLS policies configured (authenticated users only)
- [x] FK indexes created (performance)
- [x] Supabase Storage bucket: `coach-documents` (private, 5MB)

---

## ✅ Phase 2: Authentication & Core UI
- [x] Supabase Auth (email/password)
- [x] Login/logout flow
- [x] Protected routes
- [x] Sidebar layout (220px + main content, sticky)
- [x] Navigation: Dashboard / Communities / Sports / Coaches / Paid Holidays / Attendance / Payroll / Attendance Export / Substitute Coaches

---

## ✅ Phase 3: Community & Sport Management
- [x] Community CRUD interface (list, add, edit, archive)
- [x] Global Sports catalog (`sport_masters`) — add/edit/delete
- [x] Sport assignment to community with shift timings, operating days, multi weekly-off
- [x] Community detail view (sports list + assigned coaches)

---

## ✅ Phase 4: Coach Management
- [x] Coach CRUD (list with search, add, edit, status)
- [x] Document upload (Aadhaar, PAN — optional)
- [x] Bank details (encrypted account number, IFSC, UPI)
- [x] Coach profile view
- [x] Coach form — **sport is now required** ⭐ NEW
- [x] Coach-sport assignments (community + monthly salary per row)
- [x] **Relieving Date feature** ⭐ NEW:
  - [x] `relieving_date` column added to coaches table
  - [x] "Mark Inactive" modal now asks for Last Working Day (date picker)
  - [x] Reactivating a coach clears relieving_date
  - [x] Attendance grid locks all days after relieving_date
  - [x] Warning banner shown if coach was relieved during the selected month
  - [x] Eligible days / Paid Days calculation stops at relieving_date

---

## ✅ Phase 5: Paid Holiday Management
- [x] PH management page (community + month/year selector)
- [x] Calendar view, click to toggle PH
- [x] Holiday name editor
- [x] Toast notification on PH mark

---

## ✅ Phase 6: Attendance Review
- [x] Community → sport → coach → month/year selector
- [x] Calendar grid (default P, mark exceptions A/SUB/HD)
- [x] PH days auto-marked (read-only)
- [x] Pre-joining days disabled and greyed out
- [x] **Post-relieving days disabled and greyed out** ⭐ NEW
- [x] Mid-month joining warning banner
- [x] **Relieving date warning banner** ⭐ NEW
- [x] Substitute modal (name, phone, payment amount)
- [x] Save attendance
- [x] ↺ Reset button
- [x] Half Day (HD) support for multi-shift sports (each HD deducts 0.5 day)
- [x] **HD save error fixed** (total_paid_days column changed to NUMERIC(6,1)) ⭐ NEW

---

## ✅ Phase 7: Payroll System
- [x] Payroll dashboard (select month/year, all communities)
- [x] Salary formula: `salary / calendar_days × (eligible_days − A − SUB)`
- [x] Mid-month joining proration
- [x] Multi-community coaches: one row per assignment
- [x] `tools/calculate_salary.py` (10 pytest scenarios pass)

---

## ✅ Phase 8: Attendance Sheet Export ⭐ FULLY REBUILT
- [x] **New web page** at `/attendance-export` (📊 in sidebar)
- [x] Community + month + year selector with live preview table
- [x] Color-coded preview (WO=green, PH=yellow, A=red, HD=orange, P=default)
- [x] **Excel output exactly matches reference file** (Zenith Jan Attendance.xlsx):
  - [x] Column layout: A=Sl.No, B=Sl.no, C=Name, D=Designation, E:AI=days, AJ:AQ=summaries
  - [x] Day headers: Row 7 = day abbreviation, Row 8 = date number
  - [x] Live COUNTIF formulas in AJ:AQ (not hardcoded values)
  - [x] Total Paid Days = Present + PH + WO + HD×0.5 (matches reference formula)
  - [x] Cell colors: WO=green (#C6EFCE), PH=yellow (#FFEB9C), A=red (#FFC7CE), HD=orange (#FFD966), P=white
  - [x] Proper merges (title, info rows, header rows 7-8, footer)
  - [x] Row heights 28pt (all rows), column widths matched
  - [x] Footer: Prepared By / Checked By / Approved By
- [x] Installed `xlsx-js-style` for full cell styling support
- [x] `tools/coaches_import_template.csv` — CSV template for bulk coach upload

---

## 🔲 Phase 9: Testing
- [x] Unit tests — Python calculate_salary.py (10+ scenarios)
- [ ] Integration test — full March 2026 workflow with real data
- [ ] Security test (RLS, document access, encryption)
- [ ] Re-enable 7-day attendance edit restriction (disabled for testing)
- [ ] User acceptance testing

---

## 🔲 Phase 10: Deployment
- [ ] Pre-deployment checklist
- [ ] GitHub push
- [ ] Netlify/Vercel deploy (build: `npm run build`, publish: `dist`)
- [ ] Configure env vars on hosting platform
- [ ] Post-deployment smoke tests

---

## 🔲 Phase 11: Onboarding & Handoff
- [ ] Data entry: all communities, sports per community, 50+ coaches with assignments
- [ ] Training walk-through
- [ ] **Go live March 2026** (optional: run parallel with Excel for one month)
- [ ] Compare CoachOps payroll vs manual → retire Excel

---

## Future Phases (NOT Phase 1)
- [ ] Mobile app for coach daily check-in
- [ ] Leave management (CL/SL/PL approval workflow)
- [ ] WhatsApp notifications
- [ ] Analytics dashboard
- [ ] Community portal
