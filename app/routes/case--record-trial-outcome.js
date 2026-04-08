const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const outcomeStatusMap = {
  'not-guilty': 'Not guilty',
  'found-guilty': 'Waiting for sentencing',
  'pleads-guilty': 'Waiting for sentencing',
}

module.exports = (router) => {
  router.get('/cases/:caseId/record-trial-outcome', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-trial-outcome/index', { _case })
  })

  router.post('/cases/:caseId/record-trial-outcome', async (req, res) => {
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
        title: 'Trial outcome recorded',
        meta: { outcome },
        caseId,
      },
    })

    req.flash('success', 'Trial outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
