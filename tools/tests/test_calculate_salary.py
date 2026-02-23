"""
CoachOps — 10 pytest tests for calculate_salary.py (new calendar-day formula)
Run: pytest tools/tests/ -v

Formula: salary / total_calendar_days × (calendar_days − absences − subs)
Week-offs and PHs are implicitly paid — only A and SUB are deducted.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from calculate_salary import calculate_salary

# January 2026 = 31 calendar days
# March 2026 = 31 calendar days


def test_1_perfect_attendance():
    """No exceptions → full salary."""
    result = calculate_salary(
        monthly_salary=10_000,
        year=2026,
        month=1,
        attendance_data={},
    )
    assert result['total_calendar_days'] == 31
    assert result['paid_days'] == 31
    assert result['calculated_salary'] == 10_000.00


def test_2_one_absence():
    """1 absent day → deduct 1/31 of salary."""
    result = calculate_salary(
        monthly_salary=20_000,
        year=2026,
        month=1,
        attendance_data={'5': 'A'},
    )
    assert result['absences'] == 1
    assert result['paid_days'] == 30
    assert result['calculated_salary'] == round(20_000 / 31 * 30, 2)


def test_3_one_substitute():
    """1 SUB day → deduct 1/31 of salary."""
    result = calculate_salary(
        monthly_salary=20_000,
        year=2026,
        month=1,
        attendance_data={'20': 'SUB'},
    )
    assert result['substitutes'] == 1
    assert result['paid_days'] == 30
    assert result['calculated_salary'] == round(20_000 / 31 * 30, 2)


def test_4_two_absences():
    """2 absent days → deduct 2/31. Matches user's stated example."""
    result = calculate_salary(
        monthly_salary=20_000,
        year=2026,
        month=1,
        attendance_data={'5': 'A', '12': 'A'},
    )
    # 20000 / 31 * 29 = 18,709.68
    assert result['absences'] == 2
    assert result['paid_days'] == 29
    assert result['calculated_salary'] == round(20_000 / 31 * 29, 2)


def test_5_week_off_does_not_affect_salary():
    """Week-off days are implicitly paid — no attendance_data entry needed."""
    # No absences → full salary regardless of week-off schedule
    result = calculate_salary(
        monthly_salary=10_000,
        year=2026,
        month=1,
        attendance_data={},
    )
    assert result['paid_days'] == 31
    assert result['calculated_salary'] == 10_000.00


def test_6_paid_holiday_does_not_affect_salary():
    """PH days are implicitly paid — not stored in attendance_data."""
    # PHs don't appear in attendance_data (they're read-only in UI)
    # So a month with PHs but no absences = full salary
    result = calculate_salary(
        monthly_salary=10_000,
        year=2026,
        month=1,
        attendance_data={},  # no exceptions → PH has no effect
    )
    assert result['calculated_salary'] == 10_000.00


def test_7_mid_month_joining():
    """Coach joins Jan 16 → eligible days = 31-16+1 = 16, denominator stays 31."""
    result = calculate_salary(
        monthly_salary=20_000,
        year=2026,
        month=1,
        attendance_data={},
        joining_date='2026-01-16',
    )
    assert result['eligible_days'] == 16
    assert result['total_calendar_days'] == 31
    assert result['paid_days'] == 16
    assert result['calculated_salary'] == round(20_000 / 31 * 16, 2)


def test_8_all_days_absent():
    """All calendar days marked A → salary = 0."""
    # Mark all 31 days as absent
    attendance = {str(d): 'A' for d in range(1, 32)}
    result = calculate_salary(
        monthly_salary=10_000,
        year=2026,
        month=1,
        attendance_data=attendance,
    )
    assert result['paid_days'] == 0
    assert result['calculated_salary'] == 0.00


def test_9_no_attendance_data_defaults_to_perfect():
    """None attendance_data → same as {} → perfect attendance."""
    result = calculate_salary(
        monthly_salary=10_000,
        year=2026,
        month=1,
        attendance_data=None,
    )
    assert result['absences'] == 0
    assert result['substitutes'] == 0
    assert result['calculated_salary'] == 10_000.00


def test_10_invalid_code_raises():
    """Unknown attendance code → ValueError."""
    with pytest.raises(ValueError, match="Invalid attendance code"):
        calculate_salary(
            monthly_salary=10_000,
            year=2026,
            month=1,
            attendance_data={'5': 'CL'},  # CL is Phase 2+ only
        )
