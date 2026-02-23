import { format, getDaysInMonth, getDay, isWeekend } from 'date-fns'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Given a month (1-12), year, and array of operating day names (e.g. ['Monday','Tuesday',...]),
 * return the count of working days and the array of Date objects.
 *
 * @param {number} year
 * @param {number} month  1-12
 * @param {string[]} operatingDays  e.g. ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
 * @param {number} fromDay  start day of month (default 1, use for mid-month joining)
 * @returns {{ count: number, dates: Date[] }}
 */
export function getWorkingDaysInMonth(year, month, operatingDays, fromDay = 1) {
    const totalDays = getDaysInMonth(new Date(year, month - 1, 1))
    const opSet = new Set(operatingDays)
    const dates = []

    for (let d = fromDay; d <= totalDays; d++) {
        const date = new Date(year, month - 1, d)
        const dayName = DAY_NAMES[getDay(date)]
        if (opSet.has(dayName)) {
            dates.push(date)
        }
    }

    return { count: dates.length, dates }
}

/**
 * Format a Date or ISO string as "22 Feb 2026"
 */
export function formatDate(date) {
    if (!date) return '—'
    return format(new Date(date), 'd MMM yyyy')
}

/**
 * Format a number as Indian currency: ₹12,345.00
 */
export function formatCurrency(amount) {
    if (amount == null) return '—'
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)
}

/**
 * Return full month name from month number (1-12)
 */
export function getMonthName(month) {
    return new Date(2026, month - 1, 1).toLocaleString('en-IN', { month: 'long' })
}

/**
 * Return array of { value, label } for month selector
 */
export function getMonthOptions() {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: getMonthName(i + 1),
    }))
}
