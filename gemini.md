# CoachOps — Project Constitution (gemini.md)
**Version:** 2.1 (Updated post-Session 4)
**Last Updated:** 2026-02-23
**Authority:** This file is the single source of truth. All code must conform to schemas and rules defined here. Changes require explicit user approval.

---

## 1. North Star Goal

Reduce monthly payroll processing from **6 hours to 30 minutes** while achieving 100% calculation accuracy and complete attendance visibility.

### Success Criteria
| Metric | Target |
|---|---|
| Payroll calculation time | < 30 minutes |
| Calculation accuracy | 100% (zero errors) |
| Attendance visibility | 100% (exception tracking) |
| Report generation | Instant (Excel export on-demand) |
| Scalability | Handle 100+ coaches without performance degradation |

---

## 2. Discovery Answers

> **Status:** AWAITING USER CONFIRMATION (Discovery Questions presented)

### Q1 — North Star
**✅ CONFIRMED:** Eliminate 6-hour monthly payroll chaos → 30-minute automated process with 100% accuracy. Scale from 50 to 100+ coaches without increasing admin workload.

### Q2 — Integrations

**✅ CONFIRMED:**
- **Supabase** (database + storage + auth) — account **not yet created**, will be set up during Phase 1
- Email for MFA/password reset — **included in Supabase Auth** (no separate service)
- **No other Phase 1 integrations**
- Future: WhatsApp API (Phase 4), Mobile app (Phase 3)

**NOT Needed:**
- Payment gateways, SMS services, additional cloud storage

### Q3 — Source of Truth
**✅ CONFIRMED:**
- No historical data import required — system starts with **empty database**
- First operational month: **March 2026** (fresh start)
- `Zenith_Jan_Attendance.xlsx` — format template for Excel export ONLY (no data import)
- All data entered fresh via CoachOps dashboard

### Q4 — Delivery Payload
**✅ CONFIRMED:**
1. **Web Dashboard** — desktop-only, React SPA, Netlify/Vercel
2. **Excel Attendance Sheets** (.xlsx) — Muster Roll template exact match
3. **Payroll Reports** (CSV/Excel) — **one combined line per coach** (sum of all assignments)

NOT delivered: Mobile app, PDF reports, automated email reports (Phase 1)

### Q5 — Behavioral Rules
**✅ CONFIRMED + CLARIFIED:**
- Exception-based attendance, PH per community — confirmed
- Mid-month joining → **prorate based on days present** out of working days from joining date
- Multi-community payroll export → **one combined line per coach** (total salary summed)
- PH is per community — confirmed
- Monthly salary is **per assignment** (per sport per community), NOT global per coach
  - e.g., Coach at Community A (₹10,000) + Community B (₹8,000) = ₹18,000 total
- See Section 3 below (12 rules, updated).

---

## 3. Integrations

### Phase 1 (Core System)
- **Supabase**
  - Database: PostgreSQL (7 tables)
  - Storage: Private buckets for documents (`coach-documents`)
  - Auth: Email/password + TOTP MFA

### Future Phases
- WhatsApp Business API (Phase 4)
- Mobile app for coach check-in (Phase 3)

### Not Required
- Payment gateways, SMS services, additional cloud storage

---

## 4. Data Schemas

> **INVARIANT:** Implement exactly in Supabase PostgreSQL. Any schema change requires updating this file first.

### Schema 1: communities
```json
{
  "id": "uuid (auto-generated, primary key)",
  "name": "string (required, max 200 chars, unique case-insensitive, e.g., 'Aparna Zenith')",
  "address": "text (required, full address)",
  "contact_person": "string (required, max 100 chars)",
  "contact_phone": "string (required, format: +91XXXXXXXXXX)",
  "contract_start_date": "date (required, format: YYYY-MM-DD)",
  "monthly_fee": "decimal (optional, 2 decimal places, check >= 0)",
  "status": "enum (required, values: 'active' | 'inactive' | 'terminated', default: 'active')",
  "created_at": "timestamp with timezone (auto, default: now())",
  "updated_at": "timestamp with timezone (auto, updated by trigger)"
}
```

### Schema 2: sports
```json
{
  "id": "uuid (auto-generated, primary key)",
  "community_id": "uuid (required, FK → communities.id, ON DELETE RESTRICT)",
  "sport_master_id": "uuid (required, FK → sport_masters.id)",
  "sport_name": "string (required, max 50 chars — copied from sport_masters)",
  "shift_timings": "jsonb (array of objects: [{\"start\": \"6:00 AM\", \"end\": \"8:00 AM\"}])",
  "operating_days": "jsonb (array of strings: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])",
  "weekly_off_days": "TEXT[] (array of day names, e.g. ['Sunday'] or ['Sunday','Monday'])",
  "location_within_community": "string (optional, e.g., 'Court 1', 'Pool Area', 'Gym')",
  "notes": "text (optional)",
  "created_at": "timestamp with timezone (auto, default: now())"
}
```
**Note:** Multi-shift (≥2 shift_timings) enables Half Day (HD) mode in the Attendance Grid.

### Schema 3: coaches
```json
{
  "id": "uuid (auto-generated, primary key)",
  "name": "string (required, max 100 chars)",
  "phone": "string (required, unique, format: +91XXXXXXXXXX)",
  "email": "string (optional, must be valid email)",
  "bank_account_number": "encrypted_string (required, encrypted at rest)",
  "bank_ifsc": "string (required, 11 chars, format: XXXX0XXXXXX)",
  "upi_id": "string (optional)",
  "joining_date": "date (required, format: YYYY-MM-DD)",
  "relieving_date": "date (optional, last working day — set when marking coach inactive)",
  "sport_master_id": "uuid (required, FK → sport_masters.id — coach's primary sport)",
  "status": "enum (required, values: 'active' | 'inactive' | 'on_leave', default: 'active')",
  "document_aadhaar_url": "string (optional, Supabase Storage path)",
  "document_pan_url": "string (optional, Supabase Storage path)",
  "document_certificates": "jsonb (optional, array of storage URLs)",
  "created_at": "timestamp with timezone (auto, default: now())",
  "updated_at": "timestamp with timezone (auto, updated by trigger)"
}
```
**Constraints:**
- Unique: `phone`
- Check: `bank_ifsc` matches `^[A-Z]{4}0[A-Z0-9]{6}$`
- Check: `phone` matches `^\+91[6-9]\d{9}$`
- `sport_master_id` required in UI form when creating new coach
- `relieving_date` automatically cleared when coach is reactivated

> ⚠️ **`monthly_salary` is NOT on this table** — it lives on `coach_sport_assignments` because salary is per assignment (per sport at community), not global per coach.

### Schema 4: coach_sport_assignments
```json
{
  "id": "uuid (auto-generated, primary key)",
  "coach_id": "uuid (required, FK → coaches.id, ON DELETE RESTRICT)",
  "sport_id": "uuid (required, FK → sports.id, ON DELETE RESTRICT)",
  "monthly_salary": "decimal (required, must be > 0, 2 decimal places — salary for THIS assignment only)",
  "created_at": "timestamp with timezone (auto, default: now())"
}
```
**Constraints:**
- Unique: `(coach_id, sport_id)` — coach cannot be assigned to same sport twice
- Check: `monthly_salary > 0`
- FK: both `ON DELETE RESTRICT`

> **KEY DESIGN:** `monthly_salary` lives HERE, not on `coaches`. A coach's total monthly pay = SUM of all assignment salaries.
>
> **Example:** Priya at Community A (₹10,000) + Community B (₹8,000) = ₹18,000 total
>
> **Note:** `working_days` and `weekly_off_day` are inherited from `sports` table.

### Schema 5: monthly_attendance
```json
{
  "id": "uuid (auto-generated, primary key)",
  "coach_id": "uuid (required, FK → coaches.id, ON DELETE RESTRICT)",
  "sport_id": "uuid (required, FK → sports.id, ON DELETE RESTRICT)",
  "community_id": "uuid (required, FK → communities.id, ON DELETE RESTRICT)",
  "month": "integer (required, 1-12, check: month BETWEEN 1 AND 12)",
  "year": "integer (required, check: year >= 2026)",
  "attendance_data": "jsonb (optional, stores ONLY exceptions: {\"5\": \"A\", \"20\": \"SUB\"})",
  "total_working_days": "integer (required, calculated from sport.operating_days, check > 0)",
  "days_present": "numeric(6,1) (optional, calculated — supports 0.5 increments for HD)",
  "days_absent": "integer (optional, calculated)",
  "days_substitute": "integer (optional, calculated)",
  "paid_holidays": "integer (optional, from paid_holidays table)",
  "total_paid_days": "numeric(6,1) (optional, calculated — supports 0.5 for Half Day)",
  "calculated_salary": "decimal (optional, 2 decimal places, calculated by Python tool)",
  "is_finalized": "boolean (default: false, set true when month is closed)",
  "created_at": "timestamp with timezone (auto, default: now())",
  "updated_at": "timestamp with timezone (auto, updated by trigger)"
}
```
**Constraints:**
- Unique: `(coach_id, sport_id, month, year)`
- Check: `month BETWEEN 1 AND 12`, `year >= 2026`, `total_working_days > 0`
- All FKs: `ON DELETE RESTRICT`

> **KEY DESIGN:** `attendance_data` stores **ONLY exceptions** (A, SUB). Default assumption is all days are P. PH and WO are auto-calculated — NOT stored in attendance_data.

**Calculation logic:**
```
days_present    = total_working_days - ph_count - count('A') - count('SUB')
total_paid_days = days_present + ph_count
calculated_salary = (total_paid_days / total_working_days) × coach.monthly_salary
```

### Schema 6: paid_holidays
```json
{
  "id": "uuid (auto-generated, primary key)",
  "community_id": "uuid (required, FK → communities.id, ON DELETE RESTRICT)",
  "date": "date (required, format: YYYY-MM-DD)",
  "holiday_name": "string (optional, e.g., 'Holi', 'Republic Day')",
  "created_at": "timestamp with timezone (auto, default: now())"
}
```
**Constraints:**
- Unique: `(community_id, date)` — cannot mark same day as PH twice for same community
- FK: `ON DELETE RESTRICT`

**Usage:** Admin sets PH at month start. Applies to ALL coaches at that community automatically. Only PH on working days count toward salary.

**Example Data:**
```json
[
  {"community_id": "uuid-123", "date": "2026-03-08", "holiday_name": "Holi"},
  {"community_id": "uuid-123", "date": "2026-03-25", "holiday_name": "Good Friday"},
  {"community_id": "uuid-456", "date": "2026-03-08", "holiday_name": "Holi"},
  {"community_id": "uuid-456", "date": "2026-03-30", "holiday_name": "Ugadi"}
]
```

### Schema 7: substitute_logs
```json
{
  "id": "uuid (auto-generated, primary key)",
  "original_coach_id": "uuid (required, FK → coaches.id, ON DELETE RESTRICT)",
  "substitute_coach_name": "string (required, max 100 chars)",
  "substitute_phone": "string (required, format: +91XXXXXXXXXX)",
  "date": "date (required, format: YYYY-MM-DD)",
  "community_id": "uuid (required, FK → communities.id, ON DELETE RESTRICT)",
  "sport_id": "uuid (required, FK → sports.id, ON DELETE RESTRICT)",
  "payment_amount": "decimal (required, must be > 0, 2 decimal places)",
  "is_paid": "boolean (required, default: false)",
  "payment_date": "date (optional, when marked as paid)",
  "created_at": "timestamp with timezone (auto, default: now())"
}
```
**Constraints:**
- Check: `payment_amount > 0`
- Check: `substitute_phone` matches `^\+91[6-9]\d{9}$`
- All FKs: `ON DELETE RESTRICT`

---

## 5. Behavioral Rules (MUST ENFORCE — 12 RULES)

> **INVARIANT:** Code that violates these rules must not be deployed.

### RULE 1: Attendance Workflow (Phase 1 Simplified — Exception-Based)

**Default state:** All coaches assumed PRESENT every working day. No daily marking required.

**Month Start Process:**
1. Admin selects community
2. Opens "Manage Paid Holidays" calendar for the month
3. Clicks dates to mark as PH (e.g., Holi = March 8)
4. PH applies to ALL coaches at that community automatically

**During Month:** No marking needed. If substitute needed → mark SUB + pay immediately (cash/UPI).

**Month End Process:**
1. Admin reviews the month per community and sport
2. Marks ONLY exceptions:
   - **A** — Coach didn't show up, no substitute
   - **SUB** — Substitute covered; original coach not paid for that day
3. System calculates automatically:
   ```
   expected_working_days = total_working_days - ph_count
   days_worked = expected_working_days - absences - substitutes
   total_paid_days = days_worked + ph_count
   salary = (total_paid_days / total_working_days) × monthly_salary
   ```

**Future Phase 2:** Coaches check in daily via mobile app (real-time tracking).

---

### RULE 2: Paid Holiday (PH) Logic

- PH = facility closed. Coach doesn't work but gets paid.
- Set per community (not per coach). Different communities can have different PH days.
- PH only counts **if it falls on a working day** (if PH is on weekly off → no extra pay)
- PH automatically included in `total_paid_days`

**Example:**
```
March 2026 (Mon–Sat schedule, total_working_days = 26):
  PH days: March 8 (Sat) + March 25 (Wed) → ph_count = 2
  Coach absent: March 5 | Substitute: March 20

  expected_working_days = 26 - 2 = 24
  days_worked = 24 - 1 (absent) - 1 (sub) = 22
  total_paid_days = 22 + 2 (PH) = 24
  salary = (24/26) × monthly_salary
```

---

### RULE 3: Weekly Off Configuration

- **Level:** Per sport at community level (NOT per coach)
- Weekly off inherited by all coaches assigned to that sport
- Weekly off days NOT counted in `total_working_days` and NOT paid

**Example:**
```
Cricket at Aparna Zenith:  Operating Mon–Sat, Weekly Off: Sunday
Swimming at Aparna Zenith: Operating Tue–Sun, Weekly Off: Monday
```

A coach assigned to both gets Sunday + Monday off.

---

### RULE 4: Salary Calculation (DETERMINISTIC — PYTHON TOOL ONLY)

**Formula implemented in `tools/calculate_salary.py` ONLY. Never in AI/UI layer.**

```python
import calendar
from datetime import date

# Uses assignment.monthly_salary (NOT coach.monthly_salary — there is none)
# Each assignment is calculated INDEPENDENTLY, then summed for total pay

# Step 1: Total working days (handling mid-month joining if applicable)
if joining_date and joining_date.month == month and joining_date.year == year:
    start_day = joining_date.day   # Prorate from joining date
else:
    start_day = 1
total_working_days = count_operating_days(month, year, sport.operating_days, start_day)

# Step 2: PH count (only PH on working days, only from joining date onwards)
ph_count = count_ph_on_working_days(ph_dates, sport.operating_days, month, year, start_day)

# Step 3: Expected working days (excluding PH)
expected_working_days = total_working_days - ph_count

# Step 4: Exceptions from attendance_data
absences = count(attendance_data, 'A')
substitutes = count(attendance_data, 'SUB')

# Step 5: Days actually worked
days_worked = expected_working_days - absences - substitutes

# Step 6: Total paid days
total_paid_days = days_worked + ph_count

# Step 7: Calculate salary using ASSIGNMENT salary (not global)
calculated_salary = (total_paid_days / total_working_days) * assignment.monthly_salary

# Step 8: Validate + round
if calculated_salary < 0:
    raise ValueError("Salary cannot be negative")
return round(calculated_salary, 2)
```

**Constraints:** Result >= 0 always. Round to exactly 2 decimal places.

**Mid-month joining:** Prorate based on days present from joining date. `total_working_days` counts only from joining_date to end of month.

---

### RULE 5: Attendance Codes (Phase 1)

| Code | Meaning | Coach Paid? | How Applied |
|---|---|---|---|
| **P** | Present | ✅ Yes | Default (not stored, assumed) |
| **A** | Absent | ❌ No | Marked at month end |
| **SUB** | Substitute | ❌ No | Marked during/end of month |
| **PH** | Paid Holiday | ✅ Yes | Auto-applied from community PH calendar |
| **WO** | Week Off | ❌ No | Auto-applied from sport weekly_off_days |
| **HD** | Half Day | ⚡ 0.5 | Available only for multi-shift sports (≥2 shifts); deducts 0.5 from paid days |

**Validation:**
- Only codes above valid in Phase 1
- Cannot mark attendance for future dates
- Cannot edit attendance older than 7 days from today
- Cannot mark any code on a day before `joining_date` or after `relieving_date`

---

### RULE 6: Substitute Tracking

When marking attendance as `SUB`, MUST capture:
- `substitute_coach_name` (required)
- `substitute_phone` (required, +91 format)
- `payment_amount` (required, must be > 0)

Actions:
1. Create record in `substitute_logs`
2. Mark original coach's attendance for that day = 'SUB'
3. 'SUB' days NOT counted in original coach's `total_paid_days`
4. Default: `is_paid = false` (mark true same day when cash/UPI settled)

---

### RULE 7: Document Management (OPTIONAL — No Blocking)

- Documents: Aadhaar, PAN, coaching certificates
- Storage: Supabase Storage private bucket `coach-documents`
- File size: max 5MB per document
- Allowed formats: PDF, JPG, PNG only
- Can add coach and process payroll WITHOUT documents
- Dashboard shows `⚠️ Documents Missing` badge — no enforcement

**Security:** Admin authentication required to view. RLS enforced. Signed URLs only.

---

### RULE 8: Bank Details Security

- `bank_account_number`: encrypted at rest (Supabase Vault or AES-256)
- `bank_ifsc`: required, 11 chars
- `upi_id`: optional
- NEVER store bank account number in plaintext
- Encryption key in environment variable only

---

### RULE 9: Multiple Community Assignments

One coach = one profile, even if working at 5+ communities.

```
Coach: Priya Sharma
Assignments + Salaries:
  1. Basketball @ Aparna Zenith (Mon,Wed,Fri)   → monthly_salary = ₹10,000
  2. Basketball @ Aparna Elysium (Tue,Thu,Sat)  → monthly_salary = ₹8,000
  3. Swimming @ Aparna Aura (Sun)               → monthly_salary = ₹5,000

Payroll calculation:
  → 3 separate monthly_attendance records (one per assignment per month)
  → Each assignment's salary calculated independently
  → Total monthly pay = ₹10,000 + ₹8,000 + ₹5,000 = ₹23,000
  → One bank transfer to Priya for ₹23,000

Payroll export:
  → ONE combined line per coach (not 3 separate lines)
  → Shows breakdown per assignment + grand total
```

---

### RULE 10: Data Integrity

- All FKs use `ON DELETE RESTRICT` — no cascades
- Use `status = 'inactive'` instead of hard-deletes
- Unique: `(coach_id, sport_id, month, year)` in monthly_attendance
- Check: `monthly_salary > 0`, `month BETWEEN 1 AND 12`, `year >= 2026`
- `created_at` and `updated_at` on all tables
- Cannot delete historical attendance records

---

### RULE 11: Data Validation

| Field | Validation |
|---|---|
| Phone | `^\+91[6-9]\d{9}$` |
| IFSC | `^[A-Z]{4}0[A-Z0-9]{6}$` |
| Monthly Salary | > 0, max 2 decimal places |
| Monthly Salary range | Typical ₹10,000–₹50,000 |
| Year | >= 2026 |
| Attendance date | Cannot be future; cannot edit > 7 days old |

---

### RULE 12: Edge Cases (All must be handled)

**Edge Case 1 — Mid-Month Joining:**
```
Coach joins Feb 15:
  total_working_days = working days from Feb 15 to Feb 28
  Only count attendance from joining_date onwards
  Same formula with adjusted total_working_days
```

**Edge Case 2 — PH on Weekly Off:**
```
PH falls on Sunday (sport has Sunday off):
  → doesn't add extra pay (already off)
  → ph_count only includes PH on working days
```

**Edge Case 3 — Coach Absent on PH:**
```
Impossible — PH means facility closed (nobody works)
→ System should show error: "Cannot mark absence on Paid Holiday"
```

**Edge Case 4 — Leap Year:**
```
Use Python's calendar.monthrange(year, month) — handles automatically
```

**Edge Case 5 — No Attendance Data:**
```
Admin forgets to mark exceptions:
  attendance_data = NULL or {}
  → absences = 0, substitutes = 0
  → salary calculated as if perfect attendance
  → Dashboard shows: "⚠️ Attendance not reviewed for [Month]"
```

**Edge Case 6 — Entire Month on Leave:**
```
All days marked 'A':
  days_worked = 0
  total_paid_days = only PH days (if any)
  calculated_salary = 0 or minimal (PH days only)
  Coach still appears in reports (not deleted)
```

---

## 6. Delivery Payloads

### Payload 1: Web Dashboard
- **Format:** React SPA (desktop-optimized, Vite)
- **Deployment:** Netlify or Vercel (custom domain optional)
- **Access:** Desktop/laptop only (responsive design NOT required for Phase 1)

### Payload 2: Excel Attendance Sheets
- **Format:** `.xlsx` with preserved formulas (NOT hardcoded values)
- **Template:** Matches `Zenith_Jan_Attendance.xlsx` exactly
- **Trigger:** "Export Attendance" button per community

### Payload 3: Payroll Reports
- **Format:** `.csv` or `.xlsx`
- **Columns:** Coach name, days worked, total paid days, calculated salary, bank account, IFSC, UPI
- **Aggregation:** If coach multi-community → breakdown per assignment + total

---

## 7. Design System

| Token | Value |
|---|---|
| Font (Body) | DM Sans |
| Font (Headings) | Bebas Neue |
| Font (Code/Numbers) | DM Mono |
| Background | `#0a0a0a` |
| Surface | `#181c24` |
| Border | `#252a35` |
| Text | `#f0f2f8` |
| Muted Text | `#6b7280` |
| Primary | `#e8ff47` (Neon Yellow) |
| Accent | `#ff6b35` (Orange) |
| Success | `#4ade80` |
| Warning | `#fbbf24` |
| Danger | `#f87171` |
| Sidebar Width | 220px |
| Card Padding | 20–24px |
| Session Timeout | 24 hours |

---

## 8. Environment Variables (Required)

```env
# .env (NEVER commit to git)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only
ENCRYPTION_KEY=your-aes-256-key                   # bank account encryption
```

---

## 9. Future Triggers (Phase 4+, NOT Phase 1)

- Monthly report cron on 1st of each month
- Payroll email reminder on 25th of each month
- WhatsApp no-show alerts (requires external service)
- Daily attendance reminder email at 9 PM to admin

---

## 10. Invariants (NEVER Violate)

1. Payroll calculation logic lives ONLY in `tools/calculate_salary.py`
2. Salary result is NEVER negative
3. No hard-deletes (use `status = 'inactive'`)
4. API keys NEVER in source code (always `.env`)
5. Bank account numbers NEVER stored in plaintext
6. Document access NEVER bypasses authentication
7. Attendance NEVER marked for future dates
8. Attendance NEVER edited if older than 7 days
9. Excel exports ALWAYS use formulas (never hardcoded values)
10. No cascade deletes (all FKs use ON DELETE RESTRICT)
11. `relieving_date` MUST be set when marking a coach inactive — it gates payroll accuracy
12. Excel exports ALWAYS use COUNTIF formulas — never hardcoded summary values

---

### RULE 12 ADDITION: Edge Case 7 — Mid-Month Relieving

```
Coach last works Feb 10, admin marks inactive on Feb 14:
  → Enter relieving_date = Feb 10 in the "Mark Inactive" modal
  → Attendance grid automatically locks all days Feb 11-28
  → eligibleDays = relieving_date.day - joining_day + 1
  → Payroll calculates correctly based on 10 days only
  → If reactivated: relieving_date is cleared automatically
```
