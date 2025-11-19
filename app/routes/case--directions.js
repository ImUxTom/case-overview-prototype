const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { groupDirections } = require('../helpers/directionGrouping')

function addCtlInfo(_case) {
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

  return _case
}

module.exports = router => {
  router.get("/cases/:caseId/directions", async (req, res) => {
    let _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        directions: {
          where: { completedDate: null },
          orderBy: [
            { dueDate: 'asc' }
          ],
          include: {
            assignedToUser: true,
            assignedToTeam: {
              include: {
                unit: true
              }
            }
          }
        },
        user: true,
        unit: true,
        lawyers: true,
        defendants: {
          include: {
            charges: true,
            defenceLawyer: true
          }
        },
        hearings: {
          orderBy: {
            startDate: 'asc'
          },
          take: 1
        },
        location: true,
        tasks: true,
        dga: true
      }
    })

    // Add CTL info
    _case = addCtlInfo(_case)

    // Add grouping metadata
    _case.directions = groupDirections(_case.directions)

    // Sort by date group, then by due date
    _case.directions.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      return new Date(a.dueDate) - new Date(b.dueDate)
    })

    res.render("cases/directions/index", { _case })
  })
}
