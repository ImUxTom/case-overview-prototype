const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { addTimeLimitDates } = require('../helpers/timeLimit')
const { addCaseStatus } = require('../helpers/caseStatus')
const statuses = require('../data/case-statuses')

const SIMULATE_TRANSITIONS = {
  [statuses.POLICE_RESUBMISSION_PENDING]: statuses.TRIAGE_NEEDED,
  [statuses.POLICE_CHARGING_INFORMATION_PENDING]: statuses.CHARGING_DECISION_NEEDED,
  [statuses.POLICE_AUTHORISED_CHARGE_PENDING]: statuses.CHARGED,
}

async function getCaseForDefendant(caseId) {
  return prisma.case.findUnique({
    where: { id: caseId },
    include: {
      unit: true,
      prosecutors: { include: { user: true } },
      paralegalOfficers: { include: { user: true } },
      defendants: { include: { charges: true, defenceLawyer: true } },
      location: true,
      tasks: true,
      dga: true
    }
  })
}

module.exports = router => {
  router.get('/cases/:caseId/defendants/:defendantId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)

    let _case = await getCaseForDefendant(caseId)
    _case = addTimeLimitDates(_case)
    addCaseStatus(_case)

    const defendant = _case.defendants.find(d => d.id === defendantId)
    if (!defendant) return res.status(404).send('Defendant not found')

    res.render('cases/defendants/show', { _case, defendant })
  })

  async function getDefendant(caseId, defendantId) {
    const _case = await getCaseForDefendant(caseId)
    const defendant = _case.defendants.find(d => d.id === defendantId)
    addTimeLimitDates(_case)
    addCaseStatus(_case)
    return { _case, defendant }
  }

  function buildDefendantItems(defendants) {
    return defendants.map(d => ({ value: String(d.id), text: `${d.firstName} ${d.lastName}` }))
  }

  // --- Accept case ---

  router.get('/cases/:caseId/defendants/:defendantId/accept', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.TRIAGE_NEEDED)
    if (eligibleDefendants.length > 1) {
      const selectedDefendantIds = req.session.data.acceptCase?.defendantIds || eligibleDefendants.map(d => String(d.id))
      res.render('cases/defendants/accept', { _case, defendant, eligibleDefendants, defendantItems: buildDefendantItems(eligibleDefendants), selectedDefendantIds })
    } else {
      res.render('cases/defendants/accept', { _case, defendant })
    }
  })

  router.post('/cases/:caseId/defendants/:defendantId/accept', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    if (req.body.acceptCase?.defendants) {
      req.session.data.acceptCase = { defendantIds: [].concat(req.body.acceptCase.defendants).filter(id => id !== '_unchecked') }
      res.redirect(`/cases/${caseId}/defendants/${defendantId}/accept/check`)
    } else {
      await prisma.defendant.update({ where: { id: defendantId }, data: { status: statuses.CHARGING_DECISION_NEEDED } })
      req.flash('success', 'Case accepted')
      res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
    }
  })

  router.get('/cases/:caseId/defendants/:defendantId/accept/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const { defendantIds } = req.session.data.acceptCase || {}
    const selectedDefendants = _case.defendants.filter(d => defendantIds?.includes(String(d.id)))
    res.render('cases/defendants/accept-check', { _case, defendant, selectedDefendants })
  })

  router.post('/cases/:caseId/defendants/:defendantId/accept/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const { defendantIds } = req.session.data.acceptCase || {}
    await prisma.defendant.updateMany({
      where: { id: { in: defendantIds.map(id => parseInt(id)) } },
      data: { status: statuses.CHARGING_DECISION_NEEDED },
    })
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Case accepted',
        meta: { ...req.session.data.acceptCase },
        caseId,
      },
    })
    delete req.session.data.acceptCase
    req.flash('success', 'Case accepted')
    res.redirect(`/cases/${caseId}/defendants`)
  })

  // --- Reject case ---

  router.get('/cases/:caseId/defendants/:defendantId/reject', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.TRIAGE_NEEDED)
    if (eligibleDefendants.length > 1) {
      const selectedDefendantIds = req.session.data.rejectCase?.defendantIds || eligibleDefendants.map(d => String(d.id))
      res.render('cases/defendants/reject', { _case, defendant, eligibleDefendants, defendantItems: buildDefendantItems(eligibleDefendants), selectedDefendantIds })
    } else {
      res.render('cases/defendants/reject', { _case, defendant })
    }
  })

  router.post('/cases/:caseId/defendants/:defendantId/reject', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    if (req.body.rejectCase?.defendants) {
      req.session.data.rejectCase = { defendantIds: [].concat(req.body.rejectCase.defendants).filter(id => id !== '_unchecked') }
      res.redirect(`/cases/${caseId}/defendants/${defendantId}/reject/check`)
    } else {
      await prisma.defendant.update({ where: { id: defendantId }, data: { status: statuses.POLICE_RESUBMISSION_PENDING } })
      req.flash('success', 'Case rejected')
      res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
    }
  })

  router.get('/cases/:caseId/defendants/:defendantId/reject/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const { defendantIds } = req.session.data.rejectCase || {}
    const selectedDefendants = _case.defendants.filter(d => defendantIds?.includes(String(d.id)))
    res.render('cases/defendants/reject-check', { _case, defendant, selectedDefendants })
  })

  router.post('/cases/:caseId/defendants/:defendantId/reject/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const { defendantIds } = req.session.data.rejectCase || {}
    await prisma.defendant.updateMany({
      where: { id: { in: defendantIds.map(id => parseInt(id)) } },
      data: { status: statuses.POLICE_RESUBMISSION_PENDING },
    })
    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Case rejected',
        meta: { ...req.session.data.rejectCase },
        caseId,
      },
    })
    delete req.session.data.rejectCase
    req.flash('success', 'Case rejected')
    res.redirect(`/cases/${caseId}/defendants`)
  })

  // --- Simulate advance ---

  router.get('/cases/:caseId/defendants/:defendantId/simulate-advance', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const eligibleDefendants = _case.defendants.filter(d => d.status === defendant.status)
    if (eligibleDefendants.length > 1) {
      const selectedDefendantIds = req.session.data.simulateAdvance?.defendantIds || eligibleDefendants.map(d => String(d.id))
      res.render('cases/defendants/simulate-advance', { _case, defendant, eligibleDefendants, defendantItems: buildDefendantItems(eligibleDefendants), selectedDefendantIds })
    } else {
      res.render('cases/defendants/simulate-advance', { _case, defendant })
    }
  })

  router.post('/cases/:caseId/defendants/:defendantId/simulate-advance', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    if (req.body.simulateAdvance?.defendants) {
      const defendant = await prisma.defendant.findUnique({ where: { id: defendantId } })
      req.session.data.simulateAdvance = {
        defendantIds: [].concat(req.body.simulateAdvance.defendants).filter(id => id !== '_unchecked'),
        currentStatus: defendant.status,
      }
      res.redirect(`/cases/${caseId}/defendants/${defendantId}/simulate-advance/check`)
    } else {
      const defendant = await prisma.defendant.findUnique({ where: { id: defendantId } })
      const nextStatus = SIMULATE_TRANSITIONS[defendant.status]
      if (nextStatus) {
        await prisma.defendant.update({ where: { id: defendantId }, data: { status: nextStatus } })
      }
      req.flash('success', 'Status updated')
      res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
    }
  })

  router.get('/cases/:caseId/defendants/:defendantId/simulate-advance/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const { defendantIds } = req.session.data.simulateAdvance || {}
    const selectedDefendants = _case.defendants.filter(d => defendantIds?.includes(String(d.id)))
    res.render('cases/defendants/simulate-advance-check', { _case, defendant, selectedDefendants })
  })

  router.post('/cases/:caseId/defendants/:defendantId/simulate-advance/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { defendantIds, currentStatus } = req.session.data.simulateAdvance || {}
    const nextStatus = SIMULATE_TRANSITIONS[currentStatus]
    if (nextStatus) {
      await prisma.defendant.updateMany({
        where: { id: { in: defendantIds.map(id => parseInt(id)) } },
        data: { status: nextStatus },
      })
    }
    delete req.session.data.simulateAdvance
    req.flash('success', 'Status updated')
    res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
  })

  router.get('/cases/:caseId/defendants/:defendantId/request-more-information', async (req, res) => {
    const { _case, defendant } = await getDefendant(parseInt(req.params.caseId), parseInt(req.params.defendantId))
    res.render('cases/defendants/request-more-information', { _case, defendant })
  })

  router.post('/cases/:caseId/defendants/:defendantId/request-more-information', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    await prisma.defendant.update({ where: { id: defendantId }, data: { status: statuses.POLICE_CHARGING_INFORMATION_PENDING } })
    req.flash('success', 'More information requested')
    res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
  })

  // --- Make charging decision (per-defendant) ---

  const decisionStatusMap = {
    'charge': statuses.POLICE_AUTHORISED_CHARGE_PENDING,
    'no-further-action': statuses.NO_FURTHER_ACTION,
  }

  const decisionFlashMap = {
    'charge': 'Case charged',
    'no-further-action': 'Case marked as no further action',
  }

  router.get('/cases/:caseId/defendants/:defendantId/make-charging-decision', async (req, res) => {
    const { _case, defendant } = await getDefendant(parseInt(req.params.caseId), parseInt(req.params.defendantId))
    res.render('cases/defendants/make-charging-decision', { _case, defendant })
  })

  router.post('/cases/:caseId/defendants/:defendantId/make-charging-decision', async (req, res) => {
    const { caseId, defendantId } = req.params
    req.session.data.chargingDecision = { decision: req.body.decision }
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(caseId) },
      include: { defendants: true },
    })
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.CHARGING_DECISION_NEEDED)
    if (eligibleDefendants.length > 1) {
      res.redirect(`/cases/${caseId}/defendants/${defendantId}/make-charging-decision/defendants`)
    } else {
      res.redirect(`/cases/${caseId}/defendants/${defendantId}/make-charging-decision/check`)
    }
  })

  router.get('/cases/:caseId/defendants/:defendantId/make-charging-decision/defendants', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.CHARGING_DECISION_NEEDED)
    const selectedDefendantIds = req.session.data.chargingDecision?.defendantIds || eligibleDefendants.map(d => String(d.id))
    res.render('cases/defendants/make-charging-decision-defendants', { _case, defendant, defendantItems: buildDefendantItems(eligibleDefendants), selectedDefendantIds })
  })

  router.post('/cases/:caseId/defendants/:defendantId/make-charging-decision/defendants', (req, res) => {
    const { caseId, defendantId } = req.params
    req.session.data.chargingDecision = {
      ...req.session.data.chargingDecision,
      defendantIds: [].concat(req.body.chargingDecision?.defendants || []).filter(id => id !== '_unchecked'),
    }
    res.redirect(`/cases/${caseId}/defendants/${defendantId}/make-charging-decision/check`)
  })

  router.get('/cases/:caseId/defendants/:defendantId/make-charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const { _case, defendant } = await getDefendant(caseId, defendantId)
    const { defendantIds } = req.session.data.chargingDecision || {}
    const selectedDefendants = defendantIds
      ? _case.defendants.filter(d => defendantIds.includes(String(d.id)))
      : null
    res.render('cases/defendants/make-charging-decision-check', { _case, defendant, selectedDefendants })
  })

  router.post('/cases/:caseId/defendants/:defendantId/make-charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    const decision = req.session.data.chargingDecision?.decision
    const defendantIds = req.session.data.chargingDecision?.defendantIds
    const status = decisionStatusMap[decision]
    if (status) {
      if (defendantIds?.length) {
        await prisma.defendant.updateMany({
          where: { id: { in: defendantIds.map(id => parseInt(id)) } },
          data: { status },
        })
      } else {
        await prisma.defendant.update({ where: { id: defendantId }, data: { status } })
      }
    }
    delete req.session.data.chargingDecision
    req.flash('success', decisionFlashMap[decision] || 'Charging decision recorded')
    res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
  })

  router.get('/cases/:caseId/defendants/:defendantId/no-further-action', async (req, res) => {
    const { _case, defendant } = await getDefendant(parseInt(req.params.caseId), parseInt(req.params.defendantId))
    res.render('cases/defendants/no-further-action', { _case, defendant })
  })

  router.post('/cases/:caseId/defendants/:defendantId/no-further-action', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const defendantId = parseInt(req.params.defendantId)
    await prisma.defendant.update({ where: { id: defendantId }, data: { status: statuses.NO_FURTHER_ACTION } })
    req.flash('success', 'Marked as no further action')
    res.redirect(`/cases/${caseId}/defendants/${defendantId}`)
  })

  router.get('/cases/:caseId/defendants', async (req, res) => {
    let _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        witnesses: true,
        prosecutors: { include: { user: true } },
        paralegalOfficers: { include: { user: true } },
        defendants: { include: { charges: true, defenceLawyer: true } },
        location: true,
        tasks: true,
        dga: true
      }
    })

    _case = addTimeLimitDates(_case)
    addCaseStatus(_case)

    res.render('cases/defendants/index', { _case })
  })
}
