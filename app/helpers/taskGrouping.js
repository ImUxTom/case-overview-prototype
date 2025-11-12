/**
 * Helper functions for grouping tasks by severity or date ranges
 */

const { getTaskSeverity } = require('./taskState');

/**
 * Get the sort order for severity groups
 * @param {string} severity - The task severity ('Escalated', 'Overdue', 'Due', 'Pending')
 * @returns {number} - Sort priority (lower = higher priority)
 */
function getSeveritySortOrder(severity) {
  const order = {
    'Escalated': 1,
    'Overdue': 2,
    'Due': 3,
    'Pending': 4
  };

  return order[severity] || 999;
}

/**
 * Get the date group key for a given date
 * @param {Date} date - The date to categorize
 * @param {Date} today - Today's date (midnight)
 * @returns {string} - Group key: 'overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later', or 'noDate'
 */
function getDateGroup(date, today) {
  if (!date) {
    return 'noDate'
  }

  // Normalize date to midnight for comparison
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  // Calculate time boundaries
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const endOfWeek = new Date(today)
  const daysUntilSunday = 7 - today.getDay()
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday)

  const startOfNextWeek = new Date(endOfWeek)
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 1)

  const endOfNextWeek = new Date(startOfNextWeek)
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 6)

  // Categorize the date
  if (dateOnly < today) {
    return 'overdue'
  } else if (dateOnly.getTime() === today.getTime()) {
    return 'today'
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'tomorrow'
  } else if (dateOnly <= endOfWeek) {
    return 'thisWeek'
  } else if (dateOnly <= endOfNextWeek) {
    return 'nextWeek'
  } else {
    return 'later'
  }
}

/**
 * Get the heading text for a date group based on sort type
 * @param {string} groupKey - The group key
 * @param {string} sortBy - The sort type ('Custody time limit', 'Hearing date')
 * @returns {string} - The heading text
 */
function getDateGroupHeading(groupKey, sortBy) {
  const headings = {
    'Custody time limit': {
      overdue: 'Custody time limit has ended',
      today: 'Custody time limit ends today',
      tomorrow: 'Custody time limit ends tomorrow',
      thisWeek: 'Custody time limit ends this week',
      nextWeek: 'Custody time limit ends next week',
      later: 'Custody time limit ends later',
      noDate: 'No custody time limit set'
    },
    'Hearing date': {
      overdue: 'Hearing date has passed',
      today: 'Hearing is today',
      tomorrow: 'Hearing is tomorrow',
      thisWeek: 'Hearing is this week',
      nextWeek: 'Hearing is next week',
      later: 'Hearing is later',
      noDate: 'No hearing scheduled'
    }
  }

  return headings[sortBy]?.[groupKey] || groupKey
}

/**
 * Add group metadata to tasks based on their severity or date (depending on sortBy)
 * @param {Array} tasks - Array of task objects
 * @param {string} sortBy - Optional. The sort type ('Custody time limit', 'Hearing date'). Defaults to severity-based grouping.
 * @returns {Array} - Tasks with groupKey, groupHeading, sortOrder, and severity properties added
 */
function groupTasks(tasks, sortBy) {
  if (sortBy === 'Custody time limit' || sortBy === 'Hearing date') {
    // Use date-based grouping
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return tasks.map(task => {
      let dateToUse = null

      if (sortBy === 'Custody time limit') {
        dateToUse = task.case?.soonestCTL
      } else if (sortBy === 'Hearing date') {
        dateToUse = task.case?.hearing?.date
      }

      // Get the group key and heading
      const groupKey = getDateGroup(dateToUse, today)
      const groupHeading = getDateGroupHeading(groupKey, sortBy)

      // Always calculate severity for filtering purposes
      const severity = getTaskSeverity(task)
      const sortOrder = getSeveritySortOrder(severity)

      // Add group metadata to task
      return {
        ...task,
        severity,
        sortOrder,
        groupKey,
        groupHeading
      }
    })
  } else {
    // Use severity-based grouping (default for 'Due date')
    return tasks.map(task => {
      // Calculate task severity
      const severity = getTaskSeverity(task);
      const groupHeading = severity;
      const sortOrder = getSeveritySortOrder(severity);

      // Add group metadata to task
      return {
        ...task,
        severity,
        groupKey: severity,
        groupHeading,
        sortOrder
      };
    });
  }
}

module.exports = {
  getSeveritySortOrder,
  getDateGroup,
  getDateGroupHeading,
  groupTasks
};
