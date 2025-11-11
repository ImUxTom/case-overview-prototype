/**
 * Helper functions for grouping tasks by date ranges
 */

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
 * Get the heading text for a group based on sort type
 * @param {string} groupKey - The group key
 * @param {string} sortBy - The sort type ('Due date', 'Custody time limit', 'Hearing date')
 * @returns {string} - The heading text
 */
function getGroupHeading(groupKey, sortBy) {
  const headings = {
    'Due date': {
      overdue: 'Tasks overdue',
      today: 'Tasks due today',
      tomorrow: 'Tasks due tomorrow',
      thisWeek: 'Tasks due this week',
      nextWeek: 'Tasks due next week',
      later: 'Tasks due later',
      noDate: 'Tasks with no due date'
    },
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
 * Add group metadata to tasks based on sort type
 * @param {Array} tasks - Array of task objects
 * @param {string} sortBy - The sort type ('Due date', 'Custody time limit', 'Hearing date')
 * @returns {Array} - Tasks with groupKey and groupHeading properties added
 */
function groupTasks(tasks, sortBy) {
  // Get today's date at midnight
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Determine which date field to use based on sort type
  return tasks.map(task => {
    let dateToUse = null

    if (sortBy === 'Custody time limit') {
      dateToUse = task.case?.soonestCTL
    } else if (sortBy === 'Hearing date') {
      dateToUse = task.case?.hearing?.date
    } else {
      // Default to 'Due date'
      dateToUse = task.dueDate
    }

    // Get the group key and heading
    const groupKey = getDateGroup(dateToUse, today)
    const groupHeading = getGroupHeading(groupKey, sortBy)

    // Add group metadata to task
    return {
      ...task,
      groupKey,
      groupHeading
    }
  })
}

module.exports = {
  getDateGroup,
  getGroupHeading,
  groupTasks
}
