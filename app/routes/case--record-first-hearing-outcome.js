const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

const outcomeStatusMap = {
  'trial-in-magistrates-court': statuses.TRIAL_PREPARATION_NEEDED,
  'pleads-guilty': statuses.WAITING_FOR_SENTENCING,
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

    if (req.body.outcome === 'sent-to-crown-court') {
      res.redirect(`/cases/${caseId}/record-first-hearing-outcome/select-crown-court-unit`)
    } else {
      res.redirect(`/cases/${caseId}/record-first-hearing-outcome/check`)
    }
  })

  router.get('/cases/:caseId/record-first-hearing-outcome/select-crown-court-unit', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    const crownCourtUnits = await prisma.unit.findMany({
      where: { name: { contains: 'Crown Court' } },
      orderBy: { name: 'asc' },
    })

    const crownCourtUnitItems = crownCourtUnits.map(unit => ({
      value: `${unit.id}`,
      text: unit.name,
    }))

    res.render('cases/record-first-hearing-outcome/select-crown-court-unit', {
      _case,
      crownCourtUnitItems,
      selectedUnitId: req.session.data.recordFirstHearingOutcome?.crownCourtUnitId,
    })
  })

  router.post('/cases/:caseId/record-first-hearing-outcome/select-crown-court-unit', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.recordFirstHearingOutcome = {
      ...req.session.data.recordFirstHearingOutcome,
      crownCourtUnitId: req.body.crownCourtUnitId,
    }
    res.redirect(`/cases/${caseId}/record-first-hearing-outcome/check`)
  })

  router.get('/cases/:caseId/record-first-hearing-outcome/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    const outcome = req.session.data.recordFirstHearingOutcome?.outcome
    let crownCourtUnit = null

    if (outcome === 'sent-to-crown-court') {
      const unitId = parseInt(req.session.data.recordFirstHearingOutcome?.crownCourtUnitId)
      crownCourtUnit = await prisma.unit.findUnique({ where: { id: unitId } })
    }

    res.render('cases/record-first-hearing-outcome/check', { _case, crownCourtUnit })
  })

  router.post('/cases/:caseId/record-first-hearing-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const outcome = req.session.data.recordFirstHearingOutcome?.outcome

    if (outcome === 'sent-to-crown-court') {
      const unitId = parseInt(req.session.data.recordFirstHearingOutcome?.crownCourtUnitId)

      await prisma.caseProsecutor.deleteMany({ where: { caseId } })
      await prisma.caseParalegalOfficer.deleteMany({ where: { caseId } })
      await prisma.case.update({
        where: { id: caseId },
        data: { unitId, status: statuses.PROSECUTOR_NEEDED },
      })
    } else {
      const status = outcomeStatusMap[outcome]
      await prisma.case.update({
        where: { id: caseId },
        data: { status },
      })
    }

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
