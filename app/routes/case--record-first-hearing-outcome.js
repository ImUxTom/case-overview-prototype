const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const outcomeStatusMap = {
  'trial-in-magistrates-court': 'Trial preparation',
  'sent-to-crown-court': 'Sent to crown court',
  'pleads-guilty': 'Waiting for sentencing',
}

module.exports = (router) => {
  router.get('/cases/:caseId/record-first-hearing-outcome', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-first-hearing-outcome/index', {
      _case,
      selectedOutcome: req.session.data.recordFirstHearingOutcome?.outcome,
    })
  })

  router.post('/cases/:caseId/record-first-hearing-outcome', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.recordFirstHearingOutcome = { outcome: req.body.outcome }
    res.redirect(`/cases/${caseId}/record-first-hearing-outcome/check`)
  })

  router.get('/cases/:caseId/record-first-hearing-outcome/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-first-hearing-outcome/check', { _case })
  })

  router.post('/cases/:caseId/record-first-hearing-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const outcome = req.session.data.recordFirstHearingOutcome?.outcome
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
        meta: { ...req.session.data.recordFirstHearingOutcome },
        caseId,
      },
    })

    delete req.session.data.recordFirstHearingOutcome

    req.flash('success', 'First hearing outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
