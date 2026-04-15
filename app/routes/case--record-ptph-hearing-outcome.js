const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

const outcomeStatusMap = {
  'goes-to-trial': statuses.TRIAL_PREPARATION_NEEDED,
  'pleads-guilty': statuses.WAITING_FOR_SENTENCING,
  'no-further-action': statuses.NO_FURTHER_ACTION,
}

module.exports = (router) => {
  router.get('/cases/:caseId/record-ptph-hearing-outcome', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-ptph-hearing-outcome/index', {
      _case,
      selectedOutcome: req.session.data.recordPtphHearingOutcome?.outcome,
    })
  })

  router.post('/cases/:caseId/record-ptph-hearing-outcome', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.recordPtphHearingOutcome = { outcome: req.body.outcome }
    res.redirect(`/cases/${caseId}/record-ptph-hearing-outcome/check`)
  })

  router.get('/cases/:caseId/record-ptph-hearing-outcome/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/record-ptph-hearing-outcome/check', { _case })
  })

  router.post('/cases/:caseId/record-ptph-hearing-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const outcome = req.session.data.recordPtphHearingOutcome?.outcome
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
        title: 'PTPH hearing outcome recorded',
        meta: { ...req.session.data.recordPtphHearingOutcome },
        caseId,
      },
    })

    delete req.session.data.recordPtphHearingOutcome

    req.flash('success', 'PTPH hearing outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
