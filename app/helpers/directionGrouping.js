/**
 * Helper functions for grouping directions by date status
 */

/**
 * Get the date group key for a given date
 * @param {Date} date - The date to categorize
 * @param {Date} today - Today's date (midnight)
 * @returns {string} - Group key: 'overdue', 'today', 'tomorrow', 'later', or 'noDate'
 */
function getDateGroup(date, today) {
  if (!date) {
    return 'noDate'
  }

  // Normalize date to midnight for comparison
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  // Calculate tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Categorize the date
  if (dateOnly < today) {
    return 'overdue'
  } else if (dateOnly.getTime() === today.getTime()) {
    return 'today'
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'tomorrow'
  } else {
    return 'later'
  }
}

/**
 * Get the heading text for a direction date group based on sort type
 * @param {string} groupKey - The group key
 * @param {string} sortBy - The sort type ('Due date', 'Custody time limit', 'Hearing date')
 * @returns {string} - The heading text
 */
function getDateGroupHeading(groupKey, sortBy) {
  const headings = {
    'Due date': {
      overdue: 'Overdue',
      today: 'Due today',
      tomorrow: 'Due tomorrow',
      later: 'Due later',
      noDate: 'No due date'
    },
    'Custody time limit': {
      overdue: 'Custody time limit expired',
      today: 'Custody time limit ends today',
      tomorrow: 'Custody time limit ends tomorrow',
      later: 'Custody time limit ends later',
      noDate: 'No custody time limit'
    },
    'Hearing date': {
      overdue: 'Hearing date has passed',
      today: 'Hearing is today',
      tomorrow: 'Hearing is tomorrow',
      later: 'Hearing is later',
      noDate: 'No hearing scheduled'
    }
  }

  return headings[sortBy]?.[groupKey] || groupKey
}

/**
 * Get the sort order for direction date groups
 * @param {string} groupKey - The group key
 * @returns {number} - Sort priority (lower = higher priority)
 */
function getDateGroupSortOrder(groupKey) {
  const order = {
    'overdue': 1,
    'today': 2,
    'tomorrow': 3,
    'later': 4,
    'noDate': 5
  }

  return order[groupKey] || 999
}

/**
 * Add group metadata to directions based on their due date, custody time limit, or hearing date
 * @param {Array} directions - Array of direction objects
 * @param {string} sortBy - Optional. The sort type ('Custody time limit', 'Hearing date'). Defaults to 'Due date'.
 * @returns {Array} - Directions with groupKey, groupHeading, and sortOrder properties added
 */
function groupDirections(directions, sortBy = 'Due date') {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return directions.map(direction => {
    let dateToUse = null

    if (sortBy === 'Custody time limit') {
      dateToUse = direction.case?.soonestCTL
    } else if (sortBy === 'Hearing date') {
      dateToUse = direction.case?.hearings?.[0]?.startDate
    } else {
      dateToUse = direction.dueDate
    }

    // Get the group key and heading
    const groupKey = getDateGroup(dateToUse, today)
    const groupHeading = getDateGroupHeading(groupKey, sortBy)
    const sortOrder = getDateGroupSortOrder(groupKey)

    // Add group metadata to direction
    return {
      ...direction,
      groupKey,
      groupHeading,
      sortOrder
    }
  })
}

module.exports = {
  getDateGroup,
  getDateGroupHeading,
  getDateGroupSortOrder,
  groupDirections
}
