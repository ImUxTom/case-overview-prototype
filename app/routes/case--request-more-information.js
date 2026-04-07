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

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'More information requested',
        caseId,
      },
    })

    req.flash('success', 'More information requested')
    res.redirect(`/cases/${caseId}`)
  })
}
