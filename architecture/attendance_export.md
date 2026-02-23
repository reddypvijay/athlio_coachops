# Attendance Sheet Export SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Rule 5, Payload 2

## Goal
Generate `.xlsx` file matching `Zenith_Jan_Attendance.xlsx` "Muster Roll" template exactly.

## Template Structure

| Row | Content |
|---|---|
| Row 1 | Title: "Muster Roll For the Month of [Month] [Year]" (bold, merged A–AQ) |
| Row 2 | Empty |
| Row 3 | Community Name label (A) + value (D) |
| Row 4 | Attendance Month label (A) + date value (D) |
| Row 5 | Department label (A) + sport name (D) |
| Row 6 | Empty |
| Row 7 | Headers (Sl.No, Sl.no, Name, Designation, dates 1–31, summary headers) |
| Row 8 | Sub-headers (dates repeated) |
| Row 9+ | Coach data rows |

## Column Mapping

| Columns | Content |
|---|---|
| A | Serial number |
| B | Serial number (duplicate) |
| C | Coach name |
| D | "Coach" (designation) |
| E–AI | Attendance codes (1 per day, max 31 days) |
| AJ | Total Days Present |
| AK | Total PH |
| AL | Total CL/SL/PL |
| AM | Total Comp Off |
| AN | Total Weekoff |
| AO | Total Half Days |
| AP | Half Day count |
| AQ | Total Paid Days |

## Attendance Code Population Logic (per cell)

For each coach row, for each day:
```
if day in paid_holidays    → code = "PH"
elif day is weekly off     → code = "WO"
elif str(day) in attendance_data → code = attendance_data[str(day)]  # "A" or "SUB"
else                       → code = "P"  # Default: present
```

## Summary Column Formulas (MUST BE FORMULAS, NOT HARDCODED VALUES)

For row N (starting at row 9):

| Column | Formula |
|---|---|
| AJ | `=COUNTIF(E{N}:AI{N},"p")` |
| AK | `=COUNTIF(E{N}:AI{N},"ph")` |
| AL | `=COUNTIF(E{N}:AI{N},"cl")+COUNTIF(E{N}:AF{N},"sl")+COUNTIF(E{N}:AF{N},"pl")` |
| AM | `=COUNTIF(E{N}:AF{N},"co")` |
| AN | `=COUNTIF(E{N}:AI{N},"wo")` |
| AO | `=AP{N}/2` |
| AP | `=COUNTIF(E{N}:AF{N},"1")` |
| AQ | `=AJ{N}+AK{N}+AL{N}+AN{N}+AO{N}+AM{N}` |

Row numbers must increment correctly for each coach.

## Formatting
- Title: Bold, font size 14
- Row 7 headers: Bold, light blue fill (#D5E8F0)
- All cells: Thin borders
- Column widths: Auto-fit

## Coach Data Input Format
```python
coaches = [
    {
        "name": "Rohan Kumar",
        "attendance_data": {"5": "A", "20": "SUB"},
        "paid_holiday_days": [8, 25],   # Day numbers (int) that are PH
        "weekly_off_day": "Sunday"       # Inherited from sport
    },
    ...
]
```

## Success Criteria
- [ ] File opens in Microsoft Excel without errors
- [ ] File opens in Google Sheets without errors
- [ ] Formulas calculate correctly when codes change
- [ ] Format visually matches reference template
- [ ] Works for February (28/29 days) and January (31 days)
- [ ] Works for 5 coaches and 50+ coaches

## Testing Checklist
- [ ] Generate for 5 coaches, open in Excel, verify formulas
- [ ] Generate for 50+ coaches
- [ ] Generate for February (28 and 29 days)
- [ ] Generate for January (31 days)
- [ ] Test with PH on weekday + PH on weekend
- [ ] Test with all attendance codes present
