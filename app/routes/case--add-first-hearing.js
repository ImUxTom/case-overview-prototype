const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = (router) => {
  router.get('/cases/:caseId/add-first-hearing', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/add-first-hearing/index', { _case })
  })

  router.post('/cases/:caseId/add-first-hearing', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.addFirstHearing = {
      ...req.session.data.addFirstHearing,
      hearingDate: req.body.addFirstHearing?.hearingDate,
    }
    res.redirect(`/cases/${caseId}/add-first-hearing/venue`)
  })

  router.get('/cases/:caseId/add-first-hearing/venue', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/add-first-hearing/venue', { _case })
  })

  router.post('/cases/:caseId/add-first-hearing/venue', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.addFirstHearing = {
      ...req.session.data.addFirstHearing,
      venue: req.body.addFirstHearing?.venue,
    }
    res.redirect(`/cases/${caseId}/add-first-hearing/check`)
  })

  router.get('/cases/:caseId/add-first-hearing/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/add-first-hearing/check', { _case })
  })

  router.post('/cases/:caseId/add-first-hearing/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const { hearingDate, venue } = req.session.data.addFirstHearing
    const startDate = new Date(hearingDate.year, hearingDate.month - 1, hearingDate.day)

    await prisma.hearing.create({
      data: {
        caseId,
        startDate,
        status: 'Scheduled',
        type: 'First hearing',
        venue,
      },
    })

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Waiting for first hearing' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'First hearing added',
        meta: { ...req.session.data.addFirstHearing },
        caseId,
      },
    })

    delete req.session.data.addFirstHearing

    req.flash('success', 'First hearing added')
    res.redirect(`/cases/${caseId}`)
  })
}
