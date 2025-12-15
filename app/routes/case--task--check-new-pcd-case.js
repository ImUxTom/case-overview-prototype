const _ = require('lodash')
const { DateTime } = require('luxon')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/index", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    
    if (req.session.data.completeCheckNewPcdCase.decision === "Accept") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/review-task-type`)
    } else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/reasons-for-rejection`)
    }
  })

  // 
  //
  // Accept flow
  //
  //

  // TODO: should this be shown regardless?
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/review-task-type", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/review-task-type", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/review-task-type", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/transfer-case`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/transfer-case", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true,
        unit: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/transfer-case", { _case, task })
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
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true,
        unit: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    // TODO: add areas to schema/seed data and then pull from that
    let area = "Unknown"
    if (_case.unit.name.includes("Wessex")) {
      area = "Wessex"
    } else if (_case.unit.name.includes("Yorkshire") || _case.unit.name.includes("Humberside")) {
      area = "Yorkshire and Humberside"
    }

    res.render("cases/tasks/check-new-pcd-case/area", { _case, task, area })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/area", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/unit`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/unit", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true,
        unit: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    const units = await prisma.unit.findMany({
      orderBy: { name: 'asc' }
    })

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

    res.render("cases/tasks/check-new-pcd-case/unit", { _case, task, unitItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/unit", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/case-type`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/case-type", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/case-type", { _case, task })
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
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/user-type", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/user-type", (req, res) => {
    if (data.assignTo === "Individual") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/person-name`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/task-owner`)
    }
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/person-name", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    const lastNames = require('../data/last-names')

    const lastNameItems = lastNames.map(lastName => ({
      value: lastName,
      text: lastName
    }))

    res.render("cases/tasks/check-new-pcd-case/person-name", { _case, task, lastNameItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/person-name", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/role`)
  })

  // Role (only shown if individual)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/role", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/role", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/role", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/task-owner`)
  })

  // Task owner (shown for both individual and team in RASSO flow)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/task-owner", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    // TODO: show only teams or only users

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

    res.render("cases/tasks/check-new-pcd-case/task-owner", { _case, task, users, teams })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/task-owner", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/check`)
  })

  // Know prosecutor name (shown for early advice if not transferring OR if transferring but not RASSO)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-prosecutor-name", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    // TODO: only show prosecutors within the unit - either current unit or selected unit if transferring
    const prosecutors = await prisma.user.findMany({
      where: { role: 'Prosecutor' },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    const prosecutorItems = prosecutors.map(prosecutor => ({
      value: prosecutor.id,
      text: `${prosecutor.firstName} ${prosecutor.lastName}`
    }))

    res.render("cases/tasks/check-new-pcd-case/know-prosecutor-name", { _case, task, prosecutorItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-prosecutor-name", (req, res) => {
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // TODO: check because this is filter, not actually selecting the user?
    if (data.knowProsecutorName === "Yes") {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/check`)
    } else {
      res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/prosecutor`)
    }
  })

  // Prosecutor (only shown if they don't know the prosecutor name)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/prosecutor", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    // TODO: only show prosecutors within the unit - either current unit or selected unit if transferring

    const prosecutors = await prisma.user.findMany({
      where: { role: 'Prosecutor' },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    res.render("cases/tasks/check-new-pcd-case/prosecutor", { _case, task, prosecutors })
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
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/reasons-for-rejection", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/reasons-for-rejection", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/police-response-date`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/police-response-date", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/police-response-date", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/police-response-date", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/tasks/${req.params.taskId}/check-new-pcd-case/create-reminder-task`)
  })

  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/create-reminder-task", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/create-reminder-task", { _case, task })
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
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true,
        unit: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
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

    res.render("cases/tasks/check-new-pcd-case/check", { _case, task, data, units, users, teams, prosecutors })
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

      activityLogMeta.createReminderTask = data.createReminderTask || 'no'

      // Convert reminder due date to ISO string if exists
      if (data.createReminderTask === 'yes' && data.reminderDueDate?.day && data.reminderDueDate?.month && data.reminderDueDate?.year) {
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
