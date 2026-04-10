const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = (router) => {
  router.get('/cases/:caseId/mark-trial-concluded', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'Ready to record trial outcome' },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Trial concluded',
        caseId,
      },
    })

    req.flash('success', 'Trial started')
    res.redirect(`/cases/${caseId}`)
  })
}
