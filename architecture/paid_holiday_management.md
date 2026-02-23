# Paid Holiday Management SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Rule 2

## Goal
Allow admin to configure community-level paid holidays each month, which auto-apply to all coaches at that community.

## What is a Paid Holiday (PH)?

- Facility is CLOSED — no coaching happens
- Coaches don't work but still get paid (counted in total_paid_days)
- No substitute needed (entire facility is off)
- Set per **community** (not per coach, not per sport)

## Difference Between Communities

Different communities can have different PH days each month. Example:
```
March 2026:
- Aparna Zenith: Holi (March 8) + Good Friday (March 25)
- Aparna Elysium: Holi (March 8) + Ugadi (March 30)
```

## Configuration Process

```
1. Admin navigates to "Paid Holidays" page
2. Selects community from dropdown
3. Selects month/year
4. Calendar view shows all days of the month
5. Admin clicks date to toggle as PH (blue highlight)
6. Optionally enters holiday name (e.g., "Holi")
7. Saves → creates records in paid_holidays table
8. PH applies to all coaches at this community automatically
```

## Database Operations

**Set PH:**
```sql
INSERT INTO paid_holidays (community_id, date, holiday_name)
VALUES ($1, $2, $3)
ON CONFLICT (community_id, date) DO UPDATE SET holiday_name = EXCLUDED.holiday_name;
```

**Remove PH:**
```sql
DELETE FROM paid_holidays WHERE community_id = $1 AND date = $2;
```

**Get PH for salary calculation:**
```sql
SELECT date FROM paid_holidays
WHERE community_id = $1
AND EXTRACT(year FROM date) = $2
AND EXTRACT(month FROM date) = $3;
```

## PH Salary Impact

```python
# Only PH on WORKING days count toward pay (not PH on weekly offs)
ph_count = 0
for ph_date in community_paid_holidays:
    day_name = ["Monday","Tuesday",...][ph_date.weekday()]
    if day_name in sport.operating_days:    # Working day check
        ph_count += 1

# PH on weekly off → no extra pay (already off)
# Example: Republic Day = Sunday, and sport has Sunday off → doesn't count
```

## UI: Calendar View

```
March 2026 — Aparna Zenith
┌─────────────────────────────────┐
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun │
│   2    3    4    5    6    7    8  │
│                              [PH:Holi]│
│   9   10   11   12   13   14   15 │
│  ...  ...  ...  ...  ...  ...  ...│
│  23   24  [25]  26   27   28   29 │
│       [PH:Good Friday]            │
│  30   31                          │
└─────────────────────────────────┘
[Save Paid Holidays]
```

- Clicking a date toggles PH on/off (blue = PH, gray = normal)
- Hovering shows holiday name input

## Validation Rules

| Rule | Detail |
|---|---|
| Cannot mark weekly off as PH | Weekly offs auto-detected from sports table |
| Cannot mark future months without limit | Admin can plan ahead (no restriction) |
| Cannot mark past months if finalized | If `monthly_attendance.is_finalized = true`, block edits |
| Duplicate PH dates | Handled by UNIQUE constraint (upsert) |

## Impact on Excel Export

When generating Muster Roll:
- PH days automatically filled with "PH" code
- WO days automatically filled with "WO" code
- Only exception days (A, SUB) come from attendance_data
- Default remaining days = "P"
