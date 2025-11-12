const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { getTaskSeverity } = require('../helpers/taskState')

module.exports = router => {
  router.get("/cases/:caseId/tasks/:taskId", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        user: true,
        unit: true,
        lawyers: true,
        defendants: {
          include: {
            charges: true,
            defenceLawyer: true
          }
        },
        hearing: true,
        location: true,
        tasks: true,
        dga: true
      },
    })

    // Add CTL information to the case
    let allCtlDates = []
    _case.defendants.forEach(defendant => {
      defendant.charges.forEach(charge => {
        if (charge.custodyTimeLimit) {
          allCtlDates.push(new Date(charge.custodyTimeLimit))
        }
      })
    })

    _case.hasCTL = allCtlDates.length > 0
    _case.soonestCTL = allCtlDates.length > 0 ? new Date(Math.min(...allCtlDates)) : null
    _case.ctlCount = allCtlDates.length

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) },
      include: {
        case: {
          include: {
            defendants: {
              include: {
                charges: true,
                defenceLawyer: true
              }
            },
            unit: true
          }
        },
        assignedToUser: true,
        assignedToTeam: {
          include: {
            unit: true
          }
        }
      }
    })

    // Add severity information to the task
    task.severity = getTaskSeverity(task)

    res.render("cases/tasks/show", { _case, task })
  })

  router.get("/cases/:caseId/tasks/:taskId/complete", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        defendants: true
      }
    })

    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.taskId) }
    })

    res.render("cases/tasks/complete/index", { _case, task })
  })

  router.post("/cases/:caseId/tasks/:taskId/complete", async (req, res) => {
    const taskId = parseInt(req.params.taskId)
    const caseId = parseInt(req.params.caseId)

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

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Task',
        recordId: task.id,
        action: 'UPDATE',
        title: 'Task completed',
        caseId: caseId,
        meta: {
          task: {
            id: task.id,
            name: task.name,
            type: task.type
          },
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
      }
    })

    req.flash('success', 'Task completed')
    res.redirect(`/cases/${caseId}/tasks`)
  })

}
