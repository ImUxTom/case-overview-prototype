const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = (router) => {
  router.get('/cases/:caseId/mark-charges-received', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'First hearing preparation' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'First hearing preparation',
        caseId,
      },
    })

    req.flash('success', 'Charges received')
    res.redirect(`/cases/${caseId}`)
  })
}
