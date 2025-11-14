const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { getTaskSeverity } = require('../helpers/taskState')

module.exports = router => {

  router.get("/overview", async (req, res) => {
    const currentUser = req.session.data.user
    const userUnitIds = currentUser?.units?.map(uu => uu.unitId) || []

    const unassignedCaseCount = await prisma.case.count({
      where: {
        lawyers: {
          none: {}   // means no related lawyers
        }
      }
    })

    // Count prosecutors with incomplete profiles (no specialist, preferred, or restricted areas)
    const allLawyers = await prisma.lawyer.findMany({
      include: {
        specialistAreas: true,
        preferredAreas: true,
        restrictedAreas: true
      }
    })

    const incompleteProfileCount = allLawyers.filter(lawyer =>
      lawyer.specialistAreas.length === 0 &&
      lawyer.preferredAreas.length === 0 &&
      lawyer.restrictedAreas.length === 0
    ).length

    const needsDGAReviewCount = await prisma.case.count({
      where: {
        dga: {
          outcome: null
        }
      }
    })

    // Count urgent tasks assigned to current user
    const urgentTaskCount = await prisma.task.count({
      where: {
        AND: [
          { completedDate: null },
          { assignedToUserId: currentUser.id },
          { case: { unitId: { in: userUnitIds } } },
          { isUrgent: true }
        ]
      }
    })

    // Fetch tasks assigned to current user
    let tasks = await prisma.task.findMany({
      where: {
        AND: [
          { completedDate: null },
          { assignedToUserId: currentUser.id },
          { case: { unitId: { in: userUnitIds } } }
        ]
      }
    })

    // Calculate severity for each task and group by severity
    const tasksBySeverity = {
      'Critically overdue': [],
      'Overdue': [],
      'Due soon': [],
      'Not due yet': []
    }

    tasks.forEach(task => {
      const severity = getTaskSeverity(task)
      if (tasksBySeverity[severity]) {
        tasksBySeverity[severity].push(task)
      }
    })

    res.render('overview/index', {
      unassignedCaseCount,
      incompleteProfileCount,
      needsDGAReviewCount,
      urgentTaskCount,
      criticallyOverdueTaskCount: tasksBySeverity['Critically overdue'].length,
      overdueTaskCount: tasksBySeverity['Overdue'].length,
      dueSoonTaskCount: tasksBySeverity['Due soon'].length,
      notDueYetTaskCount: tasksBySeverity['Not due yet'].length
    })
  })

}