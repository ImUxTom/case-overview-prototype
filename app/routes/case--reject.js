const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

module.exports = (router) => {
  router.get('/cases/:caseId/reject', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/reject/index', { _case })
  })

  router.post('/cases/:caseId/reject', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.defendant.updateMany({
      where: { cases: { some: { id: caseId } } },
      data: { status: statuses.POLICE_RESUBMISSION_PENDING },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Case rejected',
        caseId,
      },
    })

    req.flash('success', 'Case rejected')
    res.redirect(`/cases/${caseId}`)
  })

  router.get('/cases/:caseId/accept-resubmission', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.defendant.updateMany({
      where: { cases: { some: { id: caseId } } },
      data: { status: statuses.TRIAGE_NEEDED },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Resubmission accepted',
        caseId,
      },
    })

    res.redirect(req.query.referrer || `/cases/${caseId}`)
  })
}
