const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const outcomeStatusMap = {
  'trial-in-magistrates-court': 'Ready to prepare for trial',
  'sent-to-crown-court': 'Sent to crown court',
  'pleads-guilty': 'Waiting for sentencing',
}

module.exports = (router) => {
  router.get('/cases/:caseId/record-first-hearing-outcome', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-first-hearing-outcome/index', { _case })
  })

  router.post('/cases/:caseId/record-first-hearing-outcome', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const outcome = req.body.outcome
    const status = outcomeStatusMap[outcome]

    await prisma.case.update({
      where: { id: caseId },
      data: { status },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'First hearing outcome recorded',
        meta: { outcome },
        caseId,
      },
    })

    req.flash('success', 'First hearing outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
