const _ = require('lodash')
const { DateTime } = require('luxon')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  // Step 1: Decision form (Accept or Reject)
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
    const decision = req.body.decision

    // Store decision in session
    _.set(req, 'session.data.completeCheckNewPcdCase.decision', decision)

    // Conditional redirect based on decision
    if (decision === "Accept") {
      // Start accept flow with review task type
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/review-task-type`)
    } else {
      // Start rejection flow with reasons page
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/reasons`)
    }
  })

  // Accept flow steps

  // Step 2A: Review task type (only shown if Accept)
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
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // reviewTaskType is automatically stored in session via form name
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/transfer-case`)
  })

  // Step 3A: Transfer case (only shown if Accept)
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

    // transferCase is automatically stored in session via form name
    if (data.transferCase === "Yes") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/change-area`)
    } else {
      // Not transferring
      if (data.reviewTaskType === "Early advice") {
        res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/know-prosecutor-name`)
      } else {
        res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
      }
    }
  })

  // Step 4A: Change area (only shown if transferring)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/change-area", async (req, res) => {
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

    // Extract area from unit name (simplified for prototype)
    let area = "Unknown"
    if (_case.unit.name.includes("Wessex")) {
      area = "Wessex"
    } else if (_case.unit.name.includes("Yorkshire") || _case.unit.name.includes("Humberside")) {
      area = "Yorkshire and Humberside"
    }

    res.render("cases/tasks/check-new-pcd-case/change-area", { _case, task, area })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/change-area", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // changeArea is automatically stored in session via form name
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/unit`)
  })

  // Step 5A: Unit (only shown if transferring)
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

    // Get selected unitId from session
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Build unitItems array for select box
    const unitItems = [
      {
        value: "",
        text: "Select a unit",
        selected: !data?.unitId
      }
    ]

    // Add all units as options
    units.forEach(unit => {
      unitItems.push({
        value: unit.id,
        text: unit.name,
        selected: data?.unitId == unit.id
      })
    })

    res.render("cases/tasks/check-new-pcd-case/unit", { _case, task, units, unitItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/unit", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // unitId is automatically stored in session via form name
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/case-type`)
  })

  // Step 6A: Case type (only shown if transferring)
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

    // caseType is automatically stored in session via form name
    if (data.reviewTaskType === "Early advice" && data.caseType === "RASSO") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/assign-to`)
    } else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/know-prosecutor-name`)
    }
  })

  // Step 7A: Assign to (only shown if transferring AND early advice AND RASSO)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/assign-to", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/assign-to", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/assign-to", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // assignTo is automatically stored in session via form name
    if (data.assignTo === "Individual") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/know-person-name`)
    } else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/task-owner`)
    }
  })

  // Step 8A: Know person name (only shown if individual)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-person-name", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    const lastNames = require('../../data/last-names')

    // Get selected personLastName from session
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Build lastNameItems array for select box
    const lastNameItems = [
      {
        value: "",
        text: "Select a last name",
        selected: !data?.personLastName
      }
    ]

    // Add all last names as options
    lastNames.forEach(lastName => {
      lastNameItems.push({
        value: lastName,
        text: lastName,
        selected: data?.personLastName == lastName
      })
    })

    res.render("cases/tasks/check-new-pcd-case/know-person-name", { _case, task, lastNames, lastNameItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-person-name", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // knowPersonName and personLastName (if Yes) are automatically stored in session via form names
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/choose-role`)
  })

  // Step 9A: Choose role (only shown if individual)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/choose-role", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/choose-role", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/choose-role", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // chooseSpecificRole and specificRole (if Yes) are automatically stored in session via form names
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/task-owner`)
  })

  // Step 10A: Task owner (shown for both individual and team in RASSO flow)
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
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // taskOwner is automatically stored in session via form name
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
  })

  // Step 11A: Know prosecutor name (shown for early advice if not transferring OR if transferring but not RASSO)
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

    const prosecutors = await prisma.user.findMany({
      where: { role: 'Prosecutor' },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Get selected prosecutorId from session
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // Build prosecutorItems array for select box
    const prosecutorItems = [
      {
        value: "",
        text: "Select a prosecutor",
        selected: !data?.prosecutorId
      }
    ]

    // Add all prosecutors as options
    prosecutors.forEach(prosecutor => {
      prosecutorItems.push({
        value: prosecutor.id,
        text: `${prosecutor.firstName} ${prosecutor.lastName}`,
        selected: data?.prosecutorId == prosecutor.id
      })
    })

    res.render("cases/tasks/check-new-pcd-case/know-prosecutor-name", { _case, task, prosecutors, prosecutorItems })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/know-prosecutor-name", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId
    const data = _.get(req, 'session.data.completeCheckNewPcdCase')

    // knowProsecutorName and prosecutorId (if Yes) are automatically stored in session via form names
    if (data.knowProsecutorName === "Yes") {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
    } else {
      res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/prosecutor`)
    }
  })

  // Step 12A: Prosecutor (only shown if they don't know the prosecutor name)
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
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // prosecutorId is automatically stored in session via form name
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
  })

  // Reject flow steps

  // Step 2: Reasons for rejection (only shown if Reject)
  router.get("/cases/:caseId/tasks/:taskId/check-new-pcd-case/reasons", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/check-new-pcd-case/reasons", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/check-new-pcd-case/reasons", (req, res) => {
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // GOV.UK checkboxes send "_unchecked" when no items selected
    let rejectionReasons = req.body.completeCheckNewPcdCase?.rejectionReasons || []
    if (Array.isArray(rejectionReasons)) {
      rejectionReasons = rejectionReasons.filter(r => r !== '_unchecked')
    }

    // Store reasons in session (details are automatically stored via form names)
    _.set(req, 'session.data.completeCheckNewPcdCase.rejectionReasons', rejectionReasons)

    // Always go to police response date for reject flow
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/police-response-date`)
  })

  // Step 3: Police response date (always shown for reject flow)
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
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // Date is automatically stored in session via form names
    // Navigate to reminder task creation
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/create-reminder-task`)
  })

  // Step 4: Create reminder task (only shown for reject flow)
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
    const caseId = req.params.caseId
    const taskId = req.params.taskId

    // createReminderTask and reminderDueDate are automatically stored in session
    // Navigate to check answers
    res.redirect(`/cases/${caseId}/tasks/${taskId}/check-new-pcd-case/check`)
  })

  // Step 5: Check answers
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

    // Clear session data
    _.set(req, 'session.data.completeCheckNewPcdCase', null)

    req.flash('success', 'Task completed')
    res.redirect(`/cases/${caseId}/tasks`)
  })
}
