const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { asyncHandler } = require('../helpers/async-handler')
const Pagination = require('../helpers/pagination')
const types = require('../data/types')
const priorities = require('../data/priorities')
const complexities = require('../data/complexities')

module.exports = router => {

  router.get("/overview", async (req, res) => {
    const unassignedCaseCount = await prisma.case.count({
      where: {
        lawyers: {
          none: {}   // means no related lawyers
        }
      }
    })

    const needsDGAReviewCount = await prisma.case.count({
      where: {
        dga: {
          isNot: null
        }
      }
    })

    res.render('overview/index', {
      unassignedCaseCount,
      needsDGAReviewCount
    })
  })

}