const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

module.exports = (router) => {
  router.get('/cases/:caseId/request-more-information', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/request-more-information/index', { _case })
  })

  router.post('/cases/:caseId/request-more-information', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.defendant.updateMany({
      where: { cases: { some: { id: caseId } } },
      data: { status: statuses.POLICE_CHARGING_INFORMATION_PENDING },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Further information requested',
        caseId,
      },
    })

    req.flash('success', 'More information requested')
    res.redirect(`/cases/${caseId}`)
  })

  router.get('/cases/:caseId/mark-information-received', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.defendant.updateMany({
      where: { cases: { some: { id: caseId } } },
      data: { status: statuses.CHARGING_DECISION_NEEDED },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Further information received',
        caseId,
      },
    })

    res.redirect(req.query.referrer || `/cases/${caseId}`)
  })
}
