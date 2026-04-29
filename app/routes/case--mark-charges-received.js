const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

module.exports = (router) => {
  router.get('/cases/:caseId/mark-charges-received', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    await prisma.defendant.updateMany({
      where: { cases: { some: { id: caseId } } },
      data: { status: statuses.CHARGED },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Charges received',
        caseId,
      },
    })

    res.redirect(req.query.referrer || `/cases/${caseId}`)
  })
}
