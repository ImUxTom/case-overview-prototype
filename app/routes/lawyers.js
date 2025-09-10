const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { asyncHandler } = require('../helpers/async-handler')
const Pagination = require('../helpers/pagination')
const types = require('../data/types')

module.exports = router => {

  router.get("/lawyers", async (req, res) => {
    let lawyers = await prisma.lawyer.findMany({
      include: { 
        unit: true,
        specialistAreas: true,
        preferredAreas: true,
        restrictedAreas: true,
        _count: {
          select: {
            cases: true
          }
        }
      },
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" }
      ]
    })

    let keywords = _.get(req.session.data.lawyerSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      lawyers = lawyers.filter(lawyer => {
        let name = (lawyer.firstName + ' ' + lawyer.lastName).toLowerCase()
        return name.indexOf(keywords) > -1
      })
    }

    let totalLawyers = lawyers.length
    let pageSize = 25
    let pagination = new Pagination(lawyers, req.query.page, pageSize)
    lawyers = pagination.getData()


    res.render('lawyers/index', {
      totalLawyers, 
      lawyers,
      pagination
    })
  })

  router.get('/lawyers/clear-search', (req, res) => {
    _.set(req, 'session.data.lawyerSearch.keywords', '')
    res.redirect('/lawyers')
  })

  router.get("/lawyers/:id", asyncHandler(async (req, res) => {
    const { id } = req.params

    const lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(id) },
      include: { 
        unit: true,
        specialistAreas: true,
        preferredAreas: true,
        restrictedAreas: true,
        _count: {
          select: {
            cases: true
          }
        }
      }
    })

    res.render("lawyers/show", { lawyer })
  }))

}