# CoachOps Findings
**Last Updated:** 2026-02-22 13:05
**Purpose:** Research discoveries, constraints, and errors encountered

---

## BLAST Framework Update: v1 → FINAL (2026-02-22 13:05)

User provided the FINAL version of the BLAST Master Prompt. Key changes applied to all memory files:

### Schema Changes
| Change | Details |
|---|---|
| Tables: 6 → **7** | Added `paid_holidays` table (community-level PH calendar) |
| `sports` schema | Added `weekly_off_day` field directly on sports table |
| `coach_sport_assignments` | Simplified — removed `working_days` + `weekly_off_day` (inherited from sport) |
| `monthly_attendance` | Added `is_finalized` field; `attendance_data` now stores **exceptions only** (not all codes) |
| `substitute_logs` | Added `payment_date` field |

### Workflow Changes (CRITICAL)
- **Exception-based attendance:** Default = Present. Only mark A and SUB.
- **PH is community-level:** Set once, applies to all coaches at that community.
- **Attendance workflow:** Month Start (set PH) → During month (mark SUB if any) → Month End (mark A exceptions only).

### Salary Formula Updated
```
Old: (total_paid_days / total_working_days) × salary where total_paid_days = P + PH + leaves + WO

New: expected_working_days = total_working_days - ph_count
     days_worked = expected_working_days - absences - substitutes
     total_paid_days = days_worked + ph_count
     salary = (total_paid_days / total_working_days) × salary
```

### Rules Expanded
- Old: 5 rules → New: **12 rules**
- New rules cover: PH logic, Weekly off config, multi-community coaches, data validation, all edge cases

### Task Plan Expanded
- Old: 8 phases → New: **11 phases**
- Added: Phase 5 (Paid Holiday Management), Phase 11 (Onboarding & Handoff)
- Added: Future phases list (mobile, leave mgmt, WhatsApp, analytics, community portal)

### Architecture SOPs
- Removed: `authentication.md`
- Added: `paid_holiday_management.md`
- Renamed: `upload_document.py` → `upload_document_to_storage.py`
- Renamed: `validate_attendance_code.py` → `create_substitute_log.py`

---

---

## Section 1: Project Context (2026-02-22)

### Business Domain
- Solo entrepreneur managing 50+ coaches across multiple gated communities in India
- Sports managed: Cricket, Basketball, Swimming, Tennis, Badminton, and others
- Current tooling: Excel/Google Sheets (manual, trust-based)
- Payment model: Communities pay monthly fees → coaches receive monthly salaries

### Key Constraints Identified (from Master Prompt)
- Attendance cannot be edited for dates older than 7 days (fraud prevention)
- Attendance cannot be marked for future dates
- Salary calculation must be deterministic (in Python tools, not AI/LLM layer)
- Negative salaries must be mathematically impossible
- Bank account numbers must be encrypted at rest
- Aadhaar/PAN access restricted to admin (private Supabase Storage bucket)
- MFA mandatory — no opt-out

---

## Section 2: Architecture Decisions (Pending User Input)

### Tech Stack (Proposed)
- **Frontend:** React (Vite) — desktop-optimized
- **Backend/Database:** Supabase (PostgreSQL + RLS + Storage + Auth)
- **Payroll Logic:** Python tools (deterministic, no AI in calculation path)
- **Excel Export:** Python `openpyxl` library
- **Authentication:** Supabase Auth with TOTP MFA
- **Hosting:** Vercel or Netlify (TBD)

### Supabase Notes
- RLS (Row-Level Security) must be enabled on ALL tables
- Use `ON DELETE RESTRICT` — no cascades allowed per business rules
- Private bucket `coach-documents` for Aadhaar/PAN (signed URLs for access)
- Supabase Vault or application-level encryption for bank account numbers
- MFA via TOTP available natively in Supabase Auth

### Excel Export Notes
- Target format: "Muster Roll" template (reference: Zenith_Jan_Attendance.xlsx)
- Library: `openpyxl` for formula insertion (not hardcoded values)
- Summary columns use COUNTIF formulas — must be preserved in .xlsx output
- Attendance codes stored uppercase in database

---

## Section 3: Open Questions (Awaiting User)

1. **North Star:** What is the singular desired outcome of CoachOps?
2. **Integrations:** Which external services are needed? Are API keys ready?
3. **Source of Truth:** Where does primary data currently live?
4. **Delivery Payload:** How/where should results be delivered?
5. **Behavioral Rules:** Critical business rules and edge cases?

*(Answers will be documented in gemini.md)*

---

## Section 4: Errors Encountered

*None yet — will be updated during build phases.*

---

## Section 5: Research To-Do (Phase B - Blueprint)

- [ ] Review Supabase RLS policy patterns for multi-table admin access
- [ ] Research openpyxl formula injection (vs. hardcoded values)
- [ ] Validate salary formula against Indian payroll edge cases
- [ ] Research React + Supabase Auth TOTP MFA flow
- [ ] Investigate Supabase Vault availability for encryption
