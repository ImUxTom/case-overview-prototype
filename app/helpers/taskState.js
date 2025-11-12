/**
 * Calculate the severity of a task based on its dates
 * @param {Object} task - Task object with reminderDate, dueDate, escalationDate, completedDate
 * @returns {string} - One of: 'Completed', 'Escalated', 'Overdue', 'Due', 'Pending'
 */
function getTaskSeverity(task) {
  const now = new Date();

  // Completed tasks are always in 'Completed' severity
  if (task.completedDate) {
    return 'Completed';
  }

  // Check dates in order of priority: Escalated > Overdue > Due > Pending
  if (new Date(task.escalationDate) <= now) {
    return 'Escalated';
  }

  if (new Date(task.dueDate) <= now) {
    return 'Overdue';
  }

  if (new Date(task.reminderDate) <= now) {
    return 'Due';
  }

  return 'Pending';
}

module.exports = {
  getTaskSeverity
};
