const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const hearingStatuses = require('../data/hearing-statuses')
const statuses = require('../data/case-statuses')

const outcomesByHearingType = {
  'First hearing': [
    { value: 'trial-in-mags', text: 'Trial in Magistrates Court' },
    { value: 'trial-in-crown-court', text: 'Trial in Crown Court' },
    { value: 'sentencing-hearing', text: 'Sentencing hearing' },
  ],
  'PTPH': [
    { value: 'goes-to-trial', text: 'Goes to trial' },
    { value: 'pleads-guilty', text: 'Pleads guilty' },
    { value: 'no-further-action', text: 'No further action' },
  ],
  'Trial': [
    { value: 'not-guilty', text: 'Not guilty' },
    { value: 'found-guilty', text: 'Found guilty' },
    { value: 'pleads-guilty', text: 'Pleads guilty' },
  ],
  'Sentencing': [
    { value: 'sentenced', text: 'Sentenced' },
    { value: 'adjourned', text: 'Adjourned' },
  ],
}

const nextHearingTypeMap = {
  'trial-in-mags': 'Trial',
  'trial-in-crown-court': 'PTPH',
  'sentencing-hearing': 'Sentencing',
  'goes-to-trial': 'Trial',
  'pleads-guilty': 'Sentencing',
  'found-guilty': 'Sentencing',
  'adjourned': 'Sentencing',
}

const outcomeLabelMap = {
  'trial-in-mags': 'Trial in Magistrates Court',
  'trial-in-crown-court': 'Trial in Crown Court',
  'sentencing-hearing': 'Sentencing hearing',
  'goes-to-trial': 'Goes to trial',
  'pleads-guilty': 'Pleads guilty',
  'no-further-action': 'No further action',
  'not-guilty': 'Not guilty',
  'found-guilty': 'Found guilty',
  'sentenced': 'Sentenced',
  'adjourned': 'Adjourned',
}

const defendantStatusMap = {
  'not-guilty': statuses.NOT_GUILTY,
  'no-further-action': statuses.NO_FURTHER_ACTION,
  'sentenced': statuses.SENTENCED,
}

module.exports = (router) => {
  router.post('/cases/:caseId/hearings/:hearingId/mark-preparation-complete', async (req, res) => {
    const hearingId = parseInt(req.params.hearingId)
    const caseId = parseInt(req.params.caseId)

    await prisma.hearing.update({
      where: { id: hearingId },
      data: { status: hearingStatuses.PENDING },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Hearing preparation marked as complete',
        caseId,
      },
    })

    req.flash('success', 'Hearing preparation marked as complete')
    res.redirect(`/cases/${caseId}/hearings/${hearingId}`)
  })

  router.post('/cases/:caseId/hearings/:hearingId/mark-as-happened', async (req, res) => {
    const hearingId = parseInt(req.params.hearingId)
    const caseId = parseInt(req.params.caseId)

    await prisma.hearing.update({
      where: { id: hearingId },
      data: { status: hearingStatuses.OUTCOME_NEEDED },
    })

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Hearing marked as happened',
        caseId,
      },
    })

    req.flash('success', 'Hearing marked as happened')
    res.redirect(`/cases/${caseId}/hearings/${hearingId}`)
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
      include: { defendants: true },
    })

    const outcomeItems = outcomesByHearingType[hearing.type] || []

    res.render('cases/hearings/record-outcome/index', {
      _case,
      hearing,
      outcomeItems,
      selectedOutcome: req.session.data.recordHearingOutcome?.outcome,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome', async (req, res) => {
    const { caseId, hearingId } = req.params
    req.session.data.recordHearingOutcome = { outcome: req.body.outcome }

    if (req.body.outcome === 'trial-in-crown-court') {
      const _case = await prisma.case.findUnique({
        where: { id: parseInt(caseId) },
        include: { unit: true },
      })
      if (_case.unit.name.includes('Magistrates')) {
        return res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/select-unit`)
      } else {
        return res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/change-unit`)
      }
    }

    const nextHearingType = nextHearingTypeMap[req.body.outcome]
    if (nextHearingType) {
      res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/next-hearing-date`)
    } else {
      res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/check`)
    }
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome/change-unit', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { unit: true },
    })
    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
    })
    res.render('cases/hearings/record-outcome/change-unit', {
      _case,
      hearing,
      selectedChangeUnit: req.session.data.recordHearingOutcome?.changeUnit,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome/change-unit', (req, res) => {
    const { caseId, hearingId } = req.params
    req.session.data.recordHearingOutcome = {
      ...req.session.data.recordHearingOutcome,
      changeUnit: req.body.changeUnit,
    }
    if (req.body.changeUnit === 'Yes') {
      res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/select-unit`)
    } else {
      res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/next-hearing-date`)
    }
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome/select-unit', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { unit: true },
    })
    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
    })
    const units = await prisma.unit.findMany({
      where: { NOT: { name: { contains: 'Magistrates' } } },
      orderBy: { name: 'asc' },
    })
    const unitItems = units.map(u => ({ value: String(u.id), text: u.name }))
    res.render('cases/hearings/record-outcome/select-unit', {
      _case,
      hearing,
      unitItems,
      selectedUnitId: req.session.data.recordHearingOutcome?.unitId,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome/select-unit', (req, res) => {
    const { caseId, hearingId } = req.params
    req.session.data.recordHearingOutcome = {
      ...req.session.data.recordHearingOutcome,
      unitId: req.body.unitId,
    }
    res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/next-hearing-date`)
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome/next-hearing-date', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
    })

    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
    })

    const outcome = req.session.data.recordHearingOutcome?.outcome
    const nextHearingType = nextHearingTypeMap[outcome]

    res.render('cases/hearings/record-outcome/next-hearing-date', {
      _case,
      hearing,
      nextHearingType,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome/next-hearing-date', (req, res) => {
    const { caseId, hearingId } = req.params
    req.session.data.recordHearingOutcome = {
      ...req.session.data.recordHearingOutcome,
      nextHearingDate: req.body.recordHearingOutcome?.nextHearingDate,
    }
    res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/next-hearing-venue`)
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome/next-hearing-venue', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
    })

    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
    })

    const outcome = req.session.data.recordHearingOutcome?.outcome
    const nextHearingType = nextHearingTypeMap[outcome]

    res.render('cases/hearings/record-outcome/next-hearing-venue', {
      _case,
      hearing,
      nextHearingType,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome/next-hearing-venue', (req, res) => {
    const { caseId, hearingId } = req.params
    req.session.data.recordHearingOutcome = {
      ...req.session.data.recordHearingOutcome,
      nextHearingVenue: req.body.recordHearingOutcome?.nextHearingVenue,
    }
    res.redirect(`/cases/${caseId}/hearings/${hearingId}/record-outcome/check`)
  })

  router.get('/cases/:caseId/hearings/:hearingId/record-outcome/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, unit: true },
    })

    const hearing = await prisma.hearing.findUnique({
      where: { id: parseInt(req.params.hearingId) },
    })

    const outcome = req.session.data.recordHearingOutcome?.outcome
    const nextHearingType = nextHearingTypeMap[outcome]
    const outcomeLabel = outcomeLabelMap[outcome]

    let newUnit = null
    const unitId = req.session.data.recordHearingOutcome?.unitId
    if (unitId) {
      newUnit = await prisma.unit.findUnique({ where: { id: parseInt(unitId) } })
    }

    res.render('cases/hearings/record-outcome/check', {
      _case,
      hearing,
      nextHearingType,
      outcomeLabel,
      newUnit,
    })
  })

  router.post('/cases/:caseId/hearings/:hearingId/record-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const hearingId = parseInt(req.params.hearingId)
    const { outcome, nextHearingDate, nextHearingVenue, unitId, changeUnit } = req.session.data.recordHearingOutcome

    await prisma.hearing.update({
      where: { id: hearingId },
      data: { status: hearingStatuses.COMPLETE },
    })

    const newDefendantStatus = defendantStatusMap[outcome]
    if (newDefendantStatus) {
      const hearing = await prisma.hearing.findUnique({
        where: { id: hearingId },
        include: { defendants: true },
      })
      const defendantIds = hearing.defendants.map(d => d.id)
      await prisma.defendant.updateMany({
        where: { id: { in: defendantIds } },
        data: { status: newDefendantStatus },
      })
    }

    if (outcome === 'trial-in-crown-court' && changeUnit !== 'No' && unitId) {
      await prisma.caseProsecutor.deleteMany({ where: { caseId } })
      await prisma.caseParalegalOfficer.deleteMany({ where: { caseId } })
      await prisma.case.update({
        where: { id: caseId },
        data: { unitId: parseInt(unitId) },
      })
    }

    const nextHearingType = nextHearingTypeMap[outcome]
    if (nextHearingType && nextHearingDate) {
      const startDate = new Date(nextHearingDate.year, nextHearingDate.month - 1, nextHearingDate.day)
      await prisma.hearing.create({
        data: {
          caseId,
          startDate,
          status: hearingStatuses.PREPARATION_NEEDED,
          type: nextHearingType,
          venue: nextHearingVenue,
        },
      })
    }

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Hearing outcome recorded',
        meta: { ...req.session.data.recordHearingOutcome },
        caseId,
      },
    })

    delete req.session.data.recordHearingOutcome

    req.flash('success', 'Hearing outcome recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
