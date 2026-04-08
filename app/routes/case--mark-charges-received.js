const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = (router) => {
  router.get('/cases/:caseId/mark-charges-received', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/mark-charges-received/index', { _case })
  })

  router.post('/cases/:caseId/mark-charges-received', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Authorised charges received' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Authorised charges received',
        caseId,
      },
    })

    req.flash('success', 'Authorised charges marked as received')
    res.redirect(`/cases/${caseId}`)
  })
}
