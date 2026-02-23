# CoachOps Progress Log
**Project:** CoachOps Management System
**Started:** 2026-02-22

---

## 2026-02-23 — Session 4: Excel Export, Bug Fixes & Relieving Date ✅

### Actions Completed

**UI Consistency**
- [x] Substitute Coach and Sports table UI updated to match other screens
- [x] Attendance and Payroll filter bars now use `input-group`/`input-label`/`select` CSS classes (matching Paid Holidays dark-theme style)
- [x] Both Attendance and Payroll pages now have proper `page-header` + `page-body` layout and styled empty states

**Attendance Export — New Feature**
- [x] New page `src/pages/AttendanceExport/index.jsx` at `/attendance-export`
- [x] Nav item `📊 Attendance Export` added between Payroll and Substitute Coaches
- [x] Route `/attendance-export` added in `App.jsx`
- [x] Live preview table with color-coded attendance codes (WO=green, PH=yellow, A=red, HD=orange)
- [x] Legend with code explanations
- [x] Sticky columns for coach name + designation (horizontal scroll)
- [x] Installed `xlsx-js-style` for styled Excel export

**Excel Export — Matched Reference File Exactly**
- Reference: `/Users/vi/Downloads/Jan Attendance/Zenith Jan Attendance.xlsx` (analysed via openpyxl)
- [x] Column layout: A=Sl.No, B=Sl.no, C=Name, D=Designation, E:AI = days 01-31, AJ:AQ = summaries
- [x] Day headers: Row 7 = day abbreviation (Thu/Fri…), Row 8 = date number (01/02…)
- [x] COUNTIF Excel formulas in summary columns (AJ=Present, AK=PH, AL=CL/SL/PL, AM=CompOff, AN=WO, AO=HD/2, AP=HDcount, AQ=TotalPaid)
- [x] Total Paid Days formula: `AJ+AK+AL+AN+AO+AM` (P+PH+WO+HD×0.5)
- [x] Cell fill colors: WO=#C6EFCE, PH=#FFEB9C, A=#FFC7CE, HD=#FFD966, P=white (#FFFFFF)
- [x] Matching font colors per code (dark red for A, dark green for WO, etc.)
- [x] Merges: title (A1:M2), info rows (A3:G5), header rows 7-8 merged per column, footer (B:G / Q:Z / AJ:AQ)
- [x] Row heights 28pt, column widths matched
- [x] Footer: Prepared By / Checked By / Approved By
- [x] File name: `Muster_Roll_{CommunityName}_{Month}_{Year}.xlsx`

**HD Save Bug Fix**
- [x] `total_paid_days` DB column changed from `integer` to `numeric(6,1)` (user ran SQL in Supabase)
- [x] `days_present` DB column also changed to `numeric(6,1)`
- [x] Code updated to use `Math.round(totalPaidDays * 10) / 10` in `AttendanceGrid.jsx`

**Data Management**
- [x] User truncated all tables (communities, coaches, sports, assignments, attendance, PH, substitutes) for fresh data entry
- [x] `tools/coaches_import_template.csv` created for Supabase CSV bulk import
- [x] CSV template columns: name, phone, joining_date, status, bank_ifsc, upi_id, sport_master_id

**Coach Validation**
- [x] Sport is now a **required field** when creating a new coach (`CoachForm.jsx` validate function)

**Relieving Date — New Feature**
- [x] `ALTER TABLE coaches ADD COLUMN relieving_date date` (user ran SQL in Supabase)
- [x] `CommunityDetail.jsx` — "Mark Inactive" modal now includes a **Last Working Day** date picker
  - Defaults to today's date
  - Max = today (cannot set future date)
  - Saves `relieving_date` to coaches table alongside `status = 'inactive'`
  - Reactivating a coach clears `relieving_date = null`
- [x] `AttendanceGrid.jsx` — days after `relieving_date` are now:
  - Greyed out and non-interactive (same as before-joining days)
  - Tooltips show "After last working day (day X)"
  - "Last Day X" stat chip shown in red
  - Eligible days & Paid Days calculations now stop at relieving_date
  - PH count filtered to eligible range only
- [x] `Attendance/index.jsx` — fetches `relieving_date` alongside `joining_date`
  - Passes `relievingDate` prop to `AttendanceGrid`
  - Shows red warning banner if coach was relieved during the selected month

### Errors Fixed
- HD save error: `invalid input syntax for type integer: "29.5"` — fixed by altering column types + rounding in code
- `days_present` also caused the error (not just `total_paid_days`) — fixed both

### Known Pending
- `ALTER TABLE coaches ADD COLUMN relieving_date date` — user needs to run this SQL if not done yet
- 7-day attendance edit restriction still disabled for testing (to be re-enabled before go-live)

---

## 2026-02-22 22:22 — Session 3: Feature Completion & UX Polish ✅

### Actions Completed

**Schema Changes**
- [x] Added `sport_masters` table (global sport catalog, RLS enabled)
- [x] Added `sport_master_id` FK to `sports` table
- [x] Migrated `weekly_off_day TEXT` → `weekly_off_days TEXT[]` (multi-week-off support)

**New Pages**
- [x] `src/pages/Sports/index.jsx` — CRUD for global sport catalog
- [x] Added `/sports` route in `App.jsx`
- [x] Added 🏅 Sports nav item in sidebar

**Communities**
- [x] `SportForm.jsx` — replaced free-text sport_name with sport_masters dropdown
- [x] `SportForm.jsx` — replaced single weekly-off dropdown with multi-select chip UI
- [x] `CommunityDetail.jsx` — updated display to show `weekly_off_days` array

**Coach Management**
- [x] `CoachForm.jsx` — added sport selection (from sport_masters) next to Joining Date
- [x] `CoachForm.jsx` — added Community Assignments section (community + salary rows)

**Attendance**
- [x] Added ↺ Reset button
- [x] Fixed hardcoded "Rohit" in mid-month joining warning
- [x] Added `savedAttendance` state

**Global Toast Notification System**
- [x] `src/context/ToastContext.jsx` created
- [x] Wired into all add/edit/save actions

**Data Cleanup**
- [x] Deleted all test data (coaches, assignments, attendance, communities, sports, PH)

---

## 2026-02-22 — Session 2: Core Feature Build ✅

- [x] React SPA scaffolded (Vite + React 18 + Supabase JS + React Query + date-fns)
- [x] Auth flow, layout, navigation
- [x] Communities, Coaches, Paid Holidays, Attendance, Payroll, Substitute Coaches pages
- [x] `tools/calculate_salary.py` (10 pytest tests pass)
- [x] `tools/export_attendance_sheet.py` — muster roll Excel export (Python/openpyxl)

---

## 2026-02-22 — Phase B: Supabase Database Setup ✅

- [x] Supabase project: `coachops` (id: `vjopoeugkfkdkipxtzhz`, ap-south-1, free tier)
- [x] 7 tables migrated with RLS
- [x] Storage bucket `coach-documents` (private, 5MB)
- [x] Advisory fixes: FK indexes, search_path hardened

---

## 2026-02-22 — Protocol 0: Initialization ✅
- [x] Project directory scaffolded
- [x] `gemini.md` v2, `task_plan.md` v2
- [x] Discovery questions confirmed
