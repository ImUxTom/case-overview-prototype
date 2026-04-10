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

    res.render('cases/record-trial-outcome/index', {
      _case,
      selectedOutcome: req.session.data.recordTrialOutcome?.outcome,
    })
  })

  router.post('/cases/:caseId/record-trial-outcome', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.recordTrialOutcome = { outcome: req.body.outcome }
    res.redirect(`/cases/${caseId}/record-trial-outcome/check`)
  })

  router.get('/cases/:caseId/record-trial-outcome/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-trial-outcome/check', { _case })
  })

  router.post('/cases/:caseId/record-trial-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const outcome = req.session.data.recordTrialOutcome?.outcome
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
        meta: { ...req.session.data.recordTrialOutcome },
        caseId,
      },
    })

    delete req.session.data.recordTrialOutcome

    req.flash('success', 'Trial outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
