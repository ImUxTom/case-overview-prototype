const _ = require('lodash')
const { DateTime } = require('luxon')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {

  // Entry point - Decision page
  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      }
    })

    res.render("cases/tasks/early-advice-manager-triage/index", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage", (req, res) => {
    if (req.session.data.completeEarlyAdviceManagerTriage.decision === "Accept") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/prosecutor`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/reasons-for-rejection`)
    }
  })

  //
  //
  // Accept flow
  //
  //

  // Prosecutor (shown for accept flow only)
  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/prosecutor", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      }
    })

    // Filter prosecutors by case's current unit
    const prosecutors = await prisma.user.findMany({
      where: {
        role: 'Prosecutor',
        units: {
          some: { unitId: task.case.unitId }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    const prosecutorItems = prosecutors.map(prosecutor => ({
      value: prosecutor.id,
      text: `${prosecutor.firstName} ${prosecutor.lastName}`
    }))

    res.render("cases/tasks/early-advice-manager-triage/prosecutor", { task, prosecutorItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/prosecutor", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/check`)
  })

  //
  //
  // Reject flow
  //
  //

  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/reasons-for-rejection", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      }
    })

    res.render("cases/tasks/early-advice-manager-triage/reasons-for-rejection", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/reasons-for-rejection", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/police-response-date`)
  })

  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/police-response-date", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      }
    })

    res.render("cases/tasks/early-advice-manager-triage/police-response-date", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/police-response-date", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/create-reminder-task`)
  })

  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/create-reminder-task", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      }
    })

    res.render("cases/tasks/early-advice-manager-triage/create-reminder-task", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/create-reminder-task", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/early-advice-manager-triage/check`)
  })

  //
  //
  // All routes lead to here
  //
  //

  router.get("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/check", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: true,
            unit: true
          }
        }
      }
    })

    const data = _.get(req, 'session.data.completeEarlyAdviceManagerTriage')

    // Load prosecutors for display on check answers page
    const prosecutors = await prisma.user.findMany({
      where: { role: 'Prosecutor' },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    res.render("cases/tasks/early-advice-manager-triage/check", { task, data, prosecutors })
  })

  router.post("/cases/:caseId/tasks/:taskId/early-advice-manager-triage/check", async (req, res) => {
    const taskId = parseInt(req.params.taskId)
    const caseId = parseInt(req.params.caseId)

    const data = _.get(req, 'session.data.completeEarlyAdviceManagerTriage')

    // Update task as completed
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { completedDate: new Date() }
    })

    // Build activity log meta
    const activityLogMeta = {
      task: {
        id: task.id,
        name: task.name,
        reminderType: task.reminderType
      },
      decision: data.decision
    }

    // Add accept-specific data if decision was Accept
    if (data.decision === 'Accept') {
      if (data.prosecutorId) {
        // Resolve prosecutor name
        const prosecutor = await prisma.user.findUnique({
          where: { id: parseInt(data.prosecutorId) }
        })
        activityLogMeta.prosecutor = prosecutor ? {
          id: prosecutor.id,
          firstName: prosecutor.firstName,
          lastName: prosecutor.lastName
        } : null

        // Create CaseProsecutor record to assign prosecutor to case
        await prisma.caseProsecutor.create({
          data: {
            caseId: caseId,
            userId: parseInt(data.prosecutorId)
          }
        })
      }
    }

    // Add rejection-specific data if decision was Reject
    if (data.decision === 'Reject') {
      activityLogMeta.rejectionReasons = data.rejectionReasons || []
      activityLogMeta.rejectionDetails = data.rejectionDetails || {}

      // Convert police response date to ISO string if exists
      if (data.policeResponseDate?.day && data.policeResponseDate?.month && data.policeResponseDate?.year) {
        activityLogMeta.policeResponseDate = DateTime.fromObject({
          day: parseInt(data.policeResponseDate.day),
          month: parseInt(data.policeResponseDate.month),
          year: parseInt(data.policeResponseDate.year)
        }).toISO()
      }

      activityLogMeta.createReminderTask = data.createReminderTask || 'No'

      // Convert reminder due date to ISO string if exists
      if (data.createReminderTask === 'Yes' && data.reminderDueDate?.day && data.reminderDueDate?.month && data.reminderDueDate?.year) {
        activityLogMeta.reminderDueDate = DateTime.fromObject({
          day: parseInt(data.reminderDueDate.day),
          month: parseInt(data.reminderDueDate.month),
          year: parseInt(data.reminderDueDate.year)
        }).toISO()
      }
    }

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Task',
        recordId: task.id,
        action: 'UPDATE',
        title: 'Task completed: Early advice manager triage',
        caseId: caseId,
        meta: activityLogMeta
      }
    })

    delete req.session.data.completeEarlyAdviceManagerTriage

    req.flash('success', 'Task completed')
    res.redirect(`/cases/${caseId}/tasks`)
  })
}
