const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

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

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Waiting for information for charging decision' },
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

    req.flash('success', 'Further information requested')
    res.redirect(`/cases/${caseId}`)
  })

  router.get('/cases/:caseId/mark-information-received', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Ready to make charging decision' },
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

    req.flash('success', 'Information received')
    res.redirect(`/cases/${caseId}`)
  })
}
