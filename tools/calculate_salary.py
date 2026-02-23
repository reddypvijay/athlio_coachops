"""
CoachOps Salary Calculator — tools/calculate_salary.py

Implements the deterministic salary formula from gemini.md Rule 4.
This is the SINGLE SOURCE OF TRUTH for salary computation — never replicate in UI/AI.

Usage (CLI):
    python calculate_salary.py --help

Usage (import):
    from calculate_salary import calculate_salary, count_operating_days
"""

import argparse
import calendar
import json
import sys
from datetime import date, datetime
from typing import Optional

DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def count_operating_days(
    year: int,
    month: int,
    operating_days: list[str],
    from_day: int = 1,
) -> int:
    """
    Count the number of operating days in a month, optionally starting from `from_day`
    (for mid-month joining proration).

    Args:
        year: Calendar year (e.g. 2026)
        month: Calendar month 1-12
        operating_days: List of day names the sport operates on, e.g. ['Monday', 'Tuesday', ...]
        from_day: First day to count from (1 = full month, >1 = mid-month joining)

    Returns:
        Integer count of operating weekdays.
    """
    op_set = set(operating_days)
    total_days = calendar.monthrange(year, month)[1]
    count = 0
    for day in range(from_day, total_days + 1):
        d = date(year, month, day)
        # date.weekday(): 0=Monday … 6=Sunday
        day_name = DAY_NAMES[d.weekday()]
        if day_name in op_set:
            count += 1
    return count


def count_ph_on_working_days(
    ph_dates: list[str],
    operating_days: list[str],
    year: int,
    month: int,
    from_day: int = 1,
) -> int:
    """
    Count paid holidays that fall on operating (working) days for this assignment,
    on or after from_day.

    Args:
        ph_dates: List of ISO date strings for paid holidays, e.g. ['2026-03-08', '2026-03-25']
        operating_days: Day names the sport operates on
        year, month: Period
        from_day: Only count PH on/after this day (mid-month joining)

    Returns:
        Integer count of effective paid holidays.
    """
    op_set = set(operating_days)
    count = 0
    for ph_str in ph_dates:
        ph = date.fromisoformat(ph_str)
        if ph.year != year or ph.month != month:
            continue
        if ph.day < from_day:
            continue
        if DAY_NAMES[ph.weekday()] in op_set:
            count += 1
    return count


def calculate_salary(
    monthly_salary: float,
    year: int,
    month: int,
    attendance_data: Optional[dict] = None,
    joining_date: Optional[str] = None,
) -> dict:
    """
    Calculate the net salary for one coach-sport assignment in one month.

    Formula:
        total_calendar_days = total days in the calendar month (e.g. 31 for January)
        eligible_days       = total_calendar_days - joining_day + 1  (full month if no joining_date)
        absences            = count of 'A' in attendance_data
        substitutes         = count of 'SUB' in attendance_data
        half_days           = count of 'HD' in attendance_data (multi-shift sports only)
        paid_days           = eligible_days - absences - substitutes - (half_days × 0.5)
        salary              = (paid_days / total_calendar_days) * monthly_salary

    Week-offs and Paid Holidays are implicitly paid (only A, SUB, and HD are deducted).

    Args:
        monthly_salary: The per-assignment monthly salary (must be > 0)
        year, month: Period being calculated (year >= 2026, month 1-12)
        attendance_data: Dict of {day_number_str: code}, exceptions only. e.g. {'5': 'A', '20': 'SUB'}
        joining_date: ISO date string if coach joined mid-month (e.g. '2026-03-15')

    Returns:
        Dict with full breakdown + 'calculated_salary' key.

    Raises:
        ValueError: If inputs are invalid or salary would be negative.
    """
    # --- Validate ---
    if monthly_salary <= 0:
        raise ValueError(f"monthly_salary must be > 0, got {monthly_salary}")
    if not (1 <= month <= 12):
        raise ValueError(f"month must be 1-12, got {month}")
    if year < 2026:
        raise ValueError(f"year must be >= 2026, got {year}")

    if attendance_data is None:
        attendance_data = {}

    # --- Mid-month joining ---
    from_day = 1
    if joining_date:
        jd = date.fromisoformat(joining_date)
        if jd.year == year and jd.month == month:
            from_day = jd.day

    # --- Step 1: Total calendar days in month (denominator is always full month) ---
    total_calendar_days = calendar.monthrange(year, month)[1]

    # Eligible calendar days (from joining date to end of month)
    eligible_days = total_calendar_days - from_day + 1

    # --- Step 2: Validate attendance codes ---
    valid_codes = {'A', 'SUB', 'HD'}
    for day_str, code in attendance_data.items():
        if code not in valid_codes:
            raise ValueError(f"Invalid attendance code '{code}' on day {day_str}. Valid codes: A, SUB, HD")

    absences = sum(1 for v in attendance_data.values() if v == 'A')
    substitutes = sum(1 for v in attendance_data.values() if v == 'SUB')
    half_days = sum(1 for v in attendance_data.values() if v == 'HD')

    # --- Step 3: Paid days ---
    # HD counts as 0.5 day deduction (attended only 1 of 2 shifts)
    # Week-offs and PHs are NOT deducted — they are implicitly paid
    paid_days = max(0, eligible_days - absences - substitutes - half_days * 0.5)

    # --- Step 4: Salary ---
    calculated_salary = (paid_days / total_calendar_days) * monthly_salary

    # --- Step 5: Validate & round ---
    if calculated_salary < 0:
        raise ValueError(f"Salary cannot be negative (got {calculated_salary})")

    calculated_salary = round(calculated_salary, 2)

    return {
        'monthly_salary': monthly_salary,
        'total_calendar_days': total_calendar_days,
        'eligible_days': eligible_days,
        'absences': absences,
        'half_days': half_days,
        'substitutes': substitutes,
        'paid_days': paid_days,
        'calculated_salary': calculated_salary,
    }


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='CoachOps salary calculator. Reads JSON input from stdin or --input flag.'
    )
    parser.add_argument('--input', help='Path to JSON input file (otherwise reads from stdin)')
    args = parser.parse_args()

    if args.input:
        with open(args.input) as f:
            payload = json.load(f)
    else:
        payload = json.load(sys.stdin)

    result = calculate_salary(
        monthly_salary=payload['monthly_salary'],
        year=payload['year'],
        month=payload['month'],
        attendance_data=payload.get('attendance_data'),
        joining_date=payload.get('joining_date'),
    )

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
