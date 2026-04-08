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

  router.post('/cases/:caseId/add-first-hearing', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const day = parseInt(req.body['hearingDate-day'])
    const month = parseInt(req.body['hearingDate-month'])
    const year = parseInt(req.body['hearingDate-year'])
    const startDate = new Date(year, month - 1, day)
    const venue = req.body.venue

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
      data: { status: 'Waiting on first hearing' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'First hearing added',
        caseId,
      },
    })

    req.flash('success', 'First hearing added')
    res.redirect(`/cases/${caseId}`)
  })
}
