const _ = require('lodash')
const { DateTime } = require('luxon')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { getAreaForUnit, filterUnitsByArea } = require('../helpers/unitAreaMapping')

module.exports = router => {
  
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/index", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case", (req, res) => {
    if (req.session.data.completeCheckNewPcdCase.decision === "Accept") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/review-task-type`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/reasons-for-rejection`)
    }
  })

  // 
  //
  // Accept flow
  //
  //

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/review-task-type", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/review-task-type", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/review-task-type", (req, res) => {
    if(req.session.data.completeCheckNewPcdCase.decision == "Accept") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/transfer-case`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/police-response-date`)
    }
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/transfer-case", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/transfer-case", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/transfer-case", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // If transferring then go to area
    if (data.transferCase === "Yes") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/area`)
    } else {
      
      // If task type is Early Advice go to prosecutor
      if (data.reviewTaskType === "Early advice") {
        res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/know-prosecutor-name`)
      } else {
        res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
      }
    }
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/area", async (req, res) => {
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

    const area = getAreaForUnit(task.case.unit.name)

    res.render("cases/tasks/check-new-pcd-case/area", { task, area })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/area", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/unit`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/unit", async (req, res) => {
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

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Determine which area to use for filtering
    let areaToFilterBy
    if (data.changeArea === "Yes" && data.selectedArea) {
      // User changed the area - use the selected area
      areaToFilterBy = data.selectedArea
    } else {
      // User didn't change the area - use the current case's unit's area
      areaToFilterBy = getAreaForUnit(task.case.unit.name)
    }

    // Get all units and filter by area
    let units = await prisma.unit.findMany({
      orderBy: { name: 'asc' }
    })

    units = filterUnitsByArea(units, areaToFilterBy)

    const unitItems = [
      {
        value: "",
        text: "Select unit"
      },
      ...units.map(unit => ({
        value: unit.id,
        text: unit.name
      }))
    ]

    res.render("cases/tasks/check-new-pcd-case/unit", { task, unitItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/unit", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/case-type`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/case-type", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/case-type", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/case-type", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Reject => check answers
    if (data.decision === "Reject") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
    }
    // Accept + Early advice + RASSO => user type
    else if (data.reviewTaskType === "Early advice" && data.caseType === "RASSO") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/user-type`)
    }
    // Accept + Early advice + NOT RASSO => prosecutor
    else if (data.reviewTaskType === "Early advice") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/know-prosecutor-name`)
    }
    // Accesspt + NOT Early advice (within 5/28 calendar days)
    else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
    }
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/user-type", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/user-type", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/user-type", (req, res) => {
    if (req.session.data.completeCheckNewPcdCase.assignTo === "Individual") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/person-name`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/task-owner`)
    }
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/person-name", async (req, res) => {
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

    const lastNames = require('../data/last-names')

    const lastNameItems = lastNames.map(lastName => ({
      value: lastName,
      text: lastName
    }))

    res.render("cases/tasks/check-new-pcd-case/person-name", { task, lastNameItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/person-name", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/role`)
  })

  // Role (only shown if individual)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/role", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/role", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/role", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/task-owner`)
  })

  // Task owner (shown for both individual and team in RASSO flow)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/task-owner", async (req, res) => {
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

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Determine unit ID to filter by
    const unitId = data.transferCase === "Yes" && data.unitId
      ? parseInt(data.unitId)
      : task.case.unitId

    let ownerItems = []

    if (data.assignTo === "Individual") {
      const users = await prisma.user.findMany({
        where: {
          units: {
            some: { unitId: unitId }
          }
        },
        include: {
          units: {
            include: { unit: true }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      })

      ownerItems = users.map(user => ({
        value: `user-${user.id}`,
        text: `${user.firstName} ${user.lastName}`
      }))
    } else {
      const teams = await prisma.team.findMany({
        where: { unitId: unitId },
        include: {
          unit: true
        },
        orderBy: { name: 'asc' }
      })

      ownerItems = teams.map(team => ({
        value: `team-${team.id}`,
        text: `${team.name} (${team.unit.name})`
      }))
    }

    res.render("cases/tasks/check-new-pcd-case/task-owner", { task, ownerItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/task-owner", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/check`)
  })

  // Know prosecutor name (shown for early advice if not transferring OR if transferring but not RASSO)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-prosecutor-name", async (req, res) => {
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

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Determine unit ID to filter by
    const unitId = data.transferCase === "Yes" && data.unitId
      ? parseInt(data.unitId)
      : task.case.unitId

    const prosecutors = await prisma.user.findMany({
      where: {
        role: 'Prosecutor',
        units: {
          some: { unitId: unitId }
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

    res.render("cases/tasks/check-new-pcd-case/know-prosecutor-name", { task, prosecutorItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-prosecutor-name", (req, res) => {
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // TODO: check this.
    if (data.knowProsecutorName === "Yes") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/check`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/prosecutor`)
    }
  })

  // Prosecutor (only shown if they don't know the prosecutor name)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/prosecutor", async (req, res) => {
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

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Determine unit ID to filter by
    const unitId = data.transferCase === "Yes" && data.unitId
      ? parseInt(data.unitId)
      : task.case.unitId

    const prosecutors = await prisma.user.findMany({
      where: {
        role: 'Prosecutor',
        units: {
          some: { unitId: unitId }
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

    res.render("cases/tasks/check-new-pcd-case/prosecutor", { task, prosecutorItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/prosecutor", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/check`)
  })

  //
  // 
  // Reject flow
  //
  //

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/reasons-for-rejection", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/reasons-for-rejection", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/reasons-for-rejection", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/review-task-type`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/police-response-date", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/police-response-date", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/police-response-date", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/create-reminder-task`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/create-reminder-task", async (req, res) => {
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

    res.render("cases/tasks/check-new-pcd-case/create-reminder-task", { task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/create-reminder-task", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/case-type`)
  })

  //
  //
  // All routes lead to here
  //
  //

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/check", async (req, res) => {
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

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Load additional data needed for accept flow display on check answers
    const units = await prisma.unit.findMany({
      orderBy: { name: 'asc' }
    })

    const users = await prisma.user.findMany({
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    const teams = await prisma.team.findMany({
      include: {
        unit: true
      },
      orderBy: { name: 'asc' }
    })

    const prosecutors = await prisma.user.findMany({
      where: { role: 'Prosecutor' },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    res.render("cases/tasks/check-new-pcd-case/check", { task, data, units, users, teams, prosecutors })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/check", async (req, res) => {
    const taskId = parseInt(req.params.taskId)
    const caseId = parseInt(req.params.caseId)

    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

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

    // Build activity log meta with conditional rejection data
    const activityLogMeta = {
      task: {
        id: task.id,
        name: task.name,
        reminderType: task.reminderType
      },
      decision: data.decision,
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

    // Add accept-specific data if decision was Accept
    if (data.decision === 'Accept') {
      if (data.reviewTaskType) {
        activityLogMeta.reviewTaskType = data.reviewTaskType
      }
      if (data.transferCase) {
        activityLogMeta.transferCase = data.transferCase
      }
      if (data.changeArea) {
        activityLogMeta.changeArea = data.changeArea
      }
      if (data.selectedArea) {
        activityLogMeta.selectedArea = data.selectedArea
      }
      if (data.unitId) {
        activityLogMeta.unitId = data.unitId
      }
      if (data.caseType) {
        activityLogMeta.caseType = data.caseType
      }
      if (data.assignTo) {
        activityLogMeta.assignTo = data.assignTo
      }
      if (data.knowPersonName) {
        activityLogMeta.knowPersonName = data.knowPersonName
      }
      if (data.personLastName) {
        activityLogMeta.personLastName = data.personLastName
      }
      if (data.chooseSpecificRole) {
        activityLogMeta.chooseSpecificRole = data.chooseSpecificRole
      }
      if (data.specificRole) {
        activityLogMeta.specificRole = data.specificRole
      }
      if (data.taskOwner) {
        activityLogMeta.taskOwner = data.taskOwner
      }
      if (data.knowProsecutorName) {
        activityLogMeta.knowProsecutorName = data.knowProsecutorName
      }
      if (data.prosecutorId) {
        activityLogMeta.prosecutorId = data.prosecutorId
      }
    }

    // Add rejection-specific data if decision was Reject
    if (data.decision === 'Reject') {
      activityLogMeta.rejectionReasons = data.rejectionReasons || []
      activityLogMeta.rejectionDetails = data.rejectionDetails || {}

      // Convert police response date to ISO string if exists
      if (data.policeResponseDate?.day && data.policeResponseDate?.month && data.policeResponseDate?.year) {
        activityLogMeta.policeResponseDate = DateTime.fromObject({
          day: data.policeResponseDate.day,
          month: data.policeResponseDate.month,
          year: data.policeResponseDate.year
        }).toISO()
      }

      activityLogMeta.createReminderTask = data.createReminderTask || 'No'

      // Convert reminder due date to ISO string if exists
      if (data.createReminderTask === 'Yes' && data.reminderDueDate?.day && data.reminderDueDate?.month && data.reminderDueDate?.year) {
        activityLogMeta.reminderDueDate = DateTime.fromObject({
          day: data.reminderDueDate.day,
          month: data.reminderDueDate.month,
          year: data.reminderDueDate.year
        }).toISO()
      }

      // Add case type for reject flow
      if (data.caseType) {
        activityLogMeta.caseType = data.caseType
      }
    }

    // Create activity log entry with decision
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Task',
        recordId: task.id,
        action: 'UPDATE',
        title: 'Task completed: Check New PCD case',
        caseId: caseId,
        meta: activityLogMeta
      }
    })

    delete req.session.data.completeCheckNewPcdCase

    req.flash('success', 'Task completed')
    res.redirect(`/cases/${caseId}/tasks`)
  })
}
