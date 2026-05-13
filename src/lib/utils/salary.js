// src/lib/utils/salary.js

/**
 * Calculate gross salary for a worker
 * @param {object} worker  - { salary_type: 'fixed'|'daily_wage', salary_amount }
 * @param {number} workingDays - number of present days (used for daily_wage only)
 * @param {number} totalDays   - total working days in month (used for fixed proration if needed)
 */
export function calculateGrossSalary(worker, workingDays, totalDays = 26) {
  if (worker.salary_type === 'fixed') {
    // Fixed: full salary regardless of attendance
    // Optional: prorate if desired — uncomment below
    // return (worker.salary_amount / totalDays) * workingDays
    return worker.salary_amount
  }

  if (worker.salary_type === 'daily_wage') {
    return worker.salary_amount * workingDays
  }

  return 0
}

/**
 * Count present days from attendance records for a given worker + month
 * @param {Array} attendanceRecords - array of { status } objects
 */
export function countPresentDays(attendanceRecords) {
  return attendanceRecords.reduce((count, r) => {
    if (r.status === 'present')   return count + 1
    if (r.status === 'half_day')  return count + 0.5
    return count
  }, 0)
}