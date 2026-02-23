# Salary Calculation SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Rule 4

## Goal
Calculate accurate monthly salary for each coach based on exception-based attendance, paid holidays, and sport schedule.

## Formula (DETERMINISTIC — implemented in `tools/calculate_salary.py` ONLY)

```
Step 1: total_working_days = count of sport.operating_days in calendar month
Step 2: ph_count = count of paid_holidays for community that fall on working days
Step 3: expected_working_days = total_working_days - ph_count
Step 4: absences = count of days marked 'A' in attendance_data
Step 5: substitutes = count of days marked 'SUB' in attendance_data
Step 6: days_worked = expected_working_days - absences - substitutes
Step 7: total_paid_days = days_worked + ph_count
Step 8: calculated_salary = (total_paid_days / total_working_days) × coach.monthly_salary
Step 9: validate >= 0, round to 2 decimal places
```

## Inputs

| Parameter | Type | Description |
|---|---|---|
| `month` | int | 1–12 |
| `year` | int | e.g., 2026 |
| `assignment_monthly_salary` | float | Per-assignment salary (from `coach_sport_assignments.monthly_salary`). Must be > 0. NOT from coaches table. |
| `sport_operating_days` | List[str] | e.g., ["Monday",...,"Saturday"] |
| `sport_weekly_off` | str | e.g., "Sunday" |
| `paid_holidays` | List[date] | Community PH dates for the month |
| `attendance_data` | Dict[str, str] | Exceptions only e.g., {"5": "A", "20": "SUB"} |
| `joining_date` | date (optional) | For mid-month joining proration |

> **Multi-assignment coaches:** Call this function ONCE per assignment, then SUM results for total pay.

## Implementation

```python
import calendar
from datetime import date
from typing import Dict, List, Optional

def calculate_monthly_salary(
    month: int,
    year: int,
    assignment_monthly_salary: float,   # From coach_sport_assignments, NOT coaches table
    sport_operating_days: List[str],
    paid_holidays: List[date],
    attendance_data: Dict[str, str],
    joining_date: Optional[date] = None
) -> Dict:
    """
    Deterministic salary calculation for ONE assignment.
    For multi-community coaches, call once per assignment and SUM results.
    Same inputs → always same output.
    """
    day_names = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    _, num_days = calendar.monthrange(year, month)
    
    # Handle mid-month joining (prorate from joining date)
    start_day = 1
    if joining_date and joining_date.year == year and joining_date.month == month:
        start_day = joining_date.day

    # Step 1: Count total working days (from start_day to end of month)
    total_working_days = 0
    for day in range(start_day, num_days + 1):
        day_name = day_names[date(year, month, day).weekday()]
        if day_name in sport_operating_days:
            total_working_days += 1

    if total_working_days == 0:
        raise ValueError(f"No working days found for {month}/{year}")
    if assignment_monthly_salary <= 0:
        raise ValueError(f"assignment_monthly_salary must be > 0, got {assignment_monthly_salary}")

    # Step 2: Count PH on working days only (and only on/after joining date)
    ph_count = 0
    for ph_date in paid_holidays:
        if ph_date.month == month and ph_date.year == year:
            if ph_date.day >= start_day:
                day_name = day_names[ph_date.weekday()]
                if day_name in sport_operating_days:
                    ph_count += 1

    # Step 3: Expected working days
    expected_working_days = total_working_days - ph_count

    # Step 4–5: Count exceptions
    absences = sum(1 for code in attendance_data.values() if code == 'A')
    substitutes = sum(1 for code in attendance_data.values() if code == 'SUB')

    # Step 6: Days worked
    days_worked = expected_working_days - absences - substitutes

    # Step 7: Total paid days
    total_paid_days = days_worked + ph_count

    # Step 8: Salary (using ASSIGNMENT salary)
    calculated_salary = (total_paid_days / total_working_days) * assignment_monthly_salary

    # Step 9: Validate + round
    if calculated_salary < 0:
        raise ValueError(
            f"Calculated salary is negative: {calculated_salary}. "
            f"Check: absences={absences}, substitutes={substitutes}, "
            f"expected_working_days={expected_working_days}"
        )

    return {
        "month": month,
        "year": year,
        "assignment_monthly_salary": assignment_monthly_salary,
        "total_working_days": total_working_days,
        "paid_holidays": ph_count,
        "expected_working_days": expected_working_days,
        "absences": absences,
        "substitutes": substitutes,
        "days_worked": days_worked,
        "total_paid_days": total_paid_days,
        "calculated_salary": round(calculated_salary, 2)
    }
```

## Edge Cases

| # | Case | Handling |
|---|---|---|
| 1 | Mid-month joining | `start_day = joining_date.day`; `total_working_days` counts only from that day; prorate is automatic |
| 2 | Leap year Feb | `calendar.monthrange()` handles automatically |
| 3 | PH on weekly off | Check `day_name in sport_operating_days` before counting PH |
| 4 | All days PH | `expected_working_days = 0`, coach gets full salary |
| 5 | No attendance data | `attendance_data = {}` → absences = substitutes = 0 → full assignment salary |
| 6 | All absent | `days_worked = 0`, salary = only PH portion |
| 7 | Multi-community | Call once per assignment, SUM all `calculated_salary` values for total payout |

## Test Scenarios (10 required)

1. Perfect attendance (no absences, no substitutes, no PH)
2. One absence (1 day A)
3. One substitute (1 day SUB)
4. Multiple absences (3 days A)
5. With PH (2 PH days, perfect attendance)
6. PH + absence (2 PH, 2 A)
7. PH on weekly off (PH falls on Sunday, sport off Sun)
8. Mid-month joining (joins on 15th)
9. Leap year February (29 days)
10. Full month absent (all days A except PH)

## Output Format
```json
{
  "month": 3,
  "year": 2026,
  "assignment_monthly_salary": 10000.00,
  "total_working_days": 26,
  "paid_holidays": 2,
  "expected_working_days": 24,
  "absences": 1,
  "substitutes": 1,
  "days_worked": 22,
  "total_paid_days": 24,
  "calculated_salary": 9230.77
}
```

**Aggregation (multi-community coach):**
```json
{
  "coach_id": "uuid-priya",
  "coach_name": "Priya Sharma",
  "assignments": [
    {"community": "Aparna Zenith",   "sport": "Basketball", "assignment_salary": 10000, "calculated_salary": 9230.77},
    {"community": "Aparna Elysium",  "sport": "Basketball", "assignment_salary": 8000,  "calculated_salary": 8000.00},
    {"community": "Aparna Aura",     "sport": "Swimming",   "assignment_salary": 5000,  "calculated_salary": 4807.69}
  ],
  "total_calculated_salary": 22038.46
}
```
