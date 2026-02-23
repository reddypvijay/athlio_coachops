# Substitute Tracking SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Rule 6

## Goal
Track substitute coaches when original coach cannot work, ensuring original coach's salary is correctly deducted and substitute payment is recorded.

## Trigger
Admin marks a specific day as `SUB` in attendance review interface.

## Required Information

| Field | Type | Validation |
|---|---|---|
| `substitute_coach_name` | string | Required, max 100 chars |
| `substitute_phone` | string | Required, `^\+91[6-9]\d{9}$` |
| `payment_amount` | decimal | Required, must be > 0 |
| `is_paid` | boolean | Default: false (mark true when settled same day) |
| `payment_date` | date | Set when marking is_paid = true |

## Process Flow

```
1. Admin selects coach + specific date in attendance interface
2. Admin clicks "Mark Substitute"
3. Modal opens → capture:
   - substitute_coach_name (text input)
   - substitute_phone (text input with +91 validation)
   - payment_amount (number input)
   - "Mark as Paid" checkbox (recommended to check same day)

4. On save:
   a. Create record in substitute_logs table
   b. Update attendance_data for original coach: {"{day}": "SUB"}
   c. If 'is_paid' checked → set payment_date = today

5. On payroll calculation:
   - Day marked 'SUB' → NOT counted in original coach's total_paid_days
   - Substitute payment tracked separately in reports
```

## Salary Impact on Original Coach

```
Before SUB: days_worked = expected_working_days - absences
After SUB:  days_worked = expected_working_days - absences - substitutes

# Substitute days effectively zero out that day's pay
```

## Monthly Substitute Report

Generated when admin views payroll for a month:
- List all substitutes for that month (across all coaches/communities)
- Columns: Date, Community, Sport, Original Coach, Substitute Name, Phone, Amount, Paid Status
- Total substitute expenses for the month

## Payment Settlement

- Standard practice: Pay substitute same day (cash or UPI)
- Mark `is_paid = true` + set `payment_date = today`
- If not paid same day: appears in "Unpaid Substitutes" dashboard alert

## Error Handling

| Error | Response |
|---|---|
| Cannot mark SUB on PH | "Cannot log substitute on Paid Holiday (facility closed)" |
| Cannot mark SUB on weekly off | "Cannot log substitute on weekly off day" |
| Future date | "Cannot mark attendance for future dates" |
| Payment amount = 0 | "Substitute payment amount must be greater than 0" |
| Invalid phone format | "Phone must be in +91XXXXXXXXXX format" |
