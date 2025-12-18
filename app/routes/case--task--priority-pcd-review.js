const _ = require('lodash')
const { DateTime } = require('luxon')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { getAreaForUnit, getAllAreas, getUnitsForArea } = require('../helpers/unitAreaMapping')

module.exports = router => {

  // Step 1: Decision
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/index", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/priority-pcd-review/case-type`)
  })

  // Step 2: Case type
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/case-type", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/case-type", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/case-type", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // Route based on decision
    if (data.decision === "NFS non-compliant") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/nfs-reasons`)
    } else if (data.decision === "Priority / Red rejection") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/priority-reasons`)
    } else {
      // NFS compliant - go to CPSD question
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/cpsd`)
    }
  })

  // Step 3a: NFS non-compliant reasons (conditional)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/nfs-reasons", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/nfs-reasons", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/nfs-reasons", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/priority-pcd-review/cpsd`)
  })

  // Step 3b: Priority rejection reasons (conditional)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/priority-reasons", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/priority-reasons", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/priority-reasons", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/priority-pcd-review/cpsd`)
  })

  // Step 4: Are you CPSD?
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/cpsd", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/cpsd", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/cpsd", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // If not CPSD AND accepting (NFS compliant), go to transfer question
    if (data.cpsd === "No" && data.decision === "NFS compliant") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/transfer-case`)
    }
    // If NFS non-compliant or Priority rejection, go to action plan date
    else if (data.decision === "NFS non-compliant" || data.decision === "Priority / Red rejection") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/action-plan-date`)
    }
    // Otherwise (NFS compliant + CPSD Yes) go to check answers
    else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/check`)
    }
  })

  // Step 5: Transfer case (conditional - only if CPSD = No)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/transfer-case", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/transfer-case", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/transfer-case", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // If transferring, go to area selection
    if (data.transferCase === "Yes") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/area`)
    }
    // If NFS non-compliant or Priority rejection, go to action plan date
    else if (data.decision === "NFS non-compliant" || data.decision === "Priority / Red rejection") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/action-plan-date`)
    }
    // Otherwise go to check answers
    else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/check`)
    }
  })

  // Step 6a: Area (conditional - if transferring)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/area", async (req, res) => {
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

    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // Fetch all areas from database
    const areas = await getAllAreas(prisma)

    // Get current area for the case's unit
    const currentAreaName = await getAreaForUnit(prisma, task.case.unitId)

    // Format areas for select component
    const areaItems = areas.map(area => ({
      value: area.name,
      text: area.name,
      selected: area.name === data.area
    }))

    res.render("cases/tasks/priority-pcd-review/area", { task, areaItems, area: currentAreaName })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/area", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/priority-pcd-review/unit`)
  })

  // Step 6b: Unit (conditional - if transferring)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/unit", async (req, res) => {
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

    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // Determine which area to use for filtering
    let areaToFilterBy
    if (data.changeArea === "Yes" && data.area) {
      // User changed the area - use the selected area
      areaToFilterBy = data.area
    } else {
      // User didn't change the area - use the current case's unit's area
      areaToFilterBy = await getAreaForUnit(prisma, task.case.unitId)
    }

    // Get units filtered by area
    const units = await getUnitsForArea(prisma, areaToFilterBy)

    const unitItems = units.map(unit => ({
      value: unit.id,
      text: unit.name
    }))

    res.render("cases/tasks/priority-pcd-review/unit", { task, unitItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/unit", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // If NFS non-compliant or Priority rejection, go to action plan date
    if (data.decision === "NFS non-compliant" || data.decision === "Priority / Red rejection") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/action-plan-date`)
    }
    // Otherwise go to check answers
    else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/priority-pcd-review/check`)
    }
  })

  // Step 7: Action plan date (conditional - only if NFS non-compliant or Priority rejection)
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/action-plan-date", async (req, res) => {
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

    res.render("cases/tasks/priority-pcd-review/action-plan-date", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/action-plan-date", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/priority-pcd-review/check`)
  })

  // Step 8: Check answers
  router.get("/cases/:caseId/tasks/:taskId/priority-pcd-review/check", async (req, res) => {
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

    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // Load additional data needed for display on check answers
    const units = await prisma.unit.findMany({
      orderBy: { name: 'asc' }
    })

    res.render("cases/tasks/priority-pcd-review/check", { task, data, units })
  })

  // Step 9: Completion
  router.post("/cases/:caseId/tasks/:taskId/priority-pcd-review/check", async (req, res) => {
    const taskId = parseInt(req.params.taskId)
    const caseId = parseInt(req.params.caseId)

    const data = _.get(req, 'session.data.completePriorityPcdReview')

    // Update task as completed
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { completedDate: new Date() },
      include: {
        assignedToUser: true,
        assignedToTeam: {
          include: {
            unit: true
          }
        }
      }
    })

    // Build activity log meta
    const activityLogMeta = {
      task: {
        id: task.id,
        name: task.name,
        reminderType: task.reminderType
      },
      decision: data.decision,
      caseType: data.caseType,
      assignedToUser: task.assignedToUser ? {
        id: task.assignedToUser.id,
        firstName: task.assignedToUser.firstName,
        lastName: task.assignedToUser.lastName
      } : null,
      assignedToTeam: task.assignedToTeam ? {
        id: task.assignedToTeam.id,
        name: task.assignedToTeam.name,
        unit: {
          name: task.assignedToTeam.unit.name
        }
      } : null
    }

    // Add NFS non-compliant reasons if applicable
    if (data.decision === "NFS non-compliant" && data.nfsReasons) {
      activityLogMeta.nfsReasons = data.nfsReasons
    }

    // Add Priority rejection reason if applicable
    if (data.decision === "Priority / Red rejection" && data.priorityReason) {
      activityLogMeta.priorityReason = data.priorityReason
    }

    // Add rejection details if they exist
    if (data.rejectionDetails) {
      activityLogMeta.rejectionDetails = data.rejectionDetails
    }

    // Add CPSD answer
    if (data.cpsd) {
      activityLogMeta.cpsd = data.cpsd
    }

    // Add transfer data if applicable
    if (data.cpsd === "No" && data.transferCase) {
      activityLogMeta.transferCase = data.transferCase

      if (data.transferCase === "Yes") {
        if (data.changeArea) {
          activityLogMeta.changeArea = data.changeArea
        }
        if (data.area) {
          activityLogMeta.area = data.area
        }
        if (data.unitId) {
          // Resolve unit name
          const unit = await prisma.unit.findUnique({
            where: { id: parseInt(data.unitId) }
          })
          activityLogMeta.unit = unit ? { id: unit.id, name: unit.name } : null
        }
      }
    }

    // Add police response date if applicable
    if ((data.decision === "NFS non-compliant" || data.decision === "Priority / Red rejection") &&
        data.policeResponseDate?.day && data.policeResponseDate?.month && data.policeResponseDate?.year) {
      activityLogMeta.policeResponseDate = DateTime.fromObject({
        day: parseInt(data.policeResponseDate.day),
        month: parseInt(data.policeResponseDate.month),
        year: parseInt(data.policeResponseDate.year)
      }).toISO()
    }

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Task',
        recordId: task.id,
        action: 'UPDATE',
        title: 'Task completed: Priority PCD review',
        caseId: caseId,
        meta: activityLogMeta
      }
    })

    delete req.session.data.completePriorityPcdReview

    req.flash('success', 'Task completed')
    res.redirect(`/cases/${caseId}/tasks`)
  })
}
