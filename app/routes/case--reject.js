const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

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

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Waiting for resubmission' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Case returned to police',
        caseId,
      },
    })

    req.flash('success', 'Case returned to police')
    res.redirect(`/cases/${caseId}`)
  })

  router.get('/cases/:caseId/accept-resubmission', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Ready for triage' },
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

    req.flash('success', 'Resubmitted')
    res.redirect(`/cases/${caseId}`)
  })
}
