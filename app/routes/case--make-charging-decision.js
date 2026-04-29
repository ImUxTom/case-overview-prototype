const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

const decisionStatusMap = {
  'charge': statuses.POLICE_AUTHORISED_CHARGE_PENDING,
  'no-further-action': statuses.NO_FURTHER_ACTION,
}

const decisionFlashMap = {
  'charge': 'Case charged',
  'no-further-action': 'Case marked as no further action',
}

module.exports = (router) => {
  router.get('/cases/:caseId/make-charging-decision', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    res.render('cases/make-charging-decision/index', {
      _case,
      selectedDecision: req.session.data.chargingDecision?.decision,
    })
  })

  router.post('/cases/:caseId/make-charging-decision', async (req, res) => {
    const caseId = req.params.caseId
    req.session.data.chargingDecision = { decision: req.body.decision }

    const _case = await prisma.case.findUnique({
      where: { id: parseInt(caseId) },
      include: { defendants: true },
    })
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.CHARGING_DECISION_NEEDED)

    if (eligibleDefendants.length > 1) {
      res.redirect(`/cases/${caseId}/make-charging-decision/defendants`)
    } else {
      res.redirect(`/cases/${caseId}/make-charging-decision/check`)
    }
  })

  router.get('/cases/:caseId/make-charging-decision/defendants', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.CHARGING_DECISION_NEEDED)
    const selectedDefendantIds = req.session.data.chargingDecision?.defendantIds || eligibleDefendants.map(d => String(d.id))
    const defendantItems = eligibleDefendants.map(d => ({ value: String(d.id), text: `${d.firstName} ${d.lastName}` }))
    res.render('cases/make-charging-decision/defendants', { _case, defendantItems, selectedDefendantIds })
  })

  router.post('/cases/:caseId/make-charging-decision/defendants', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.chargingDecision = {
      ...req.session.data.chargingDecision,
      defendantIds: [].concat(req.body.chargingDecision?.defendants || []).filter(id => id !== '_unchecked'),
    }
    res.redirect(`/cases/${caseId}/make-charging-decision/check`)
  })

  router.get('/cases/:caseId/make-charging-decision/check', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })
    const { defendantIds } = req.session.data.chargingDecision || {}
    const selectedDefendants = defendantIds
      ? _case.defendants.filter(d => defendantIds.includes(String(d.id)))
      : null
    res.render('cases/make-charging-decision/check', { _case, selectedDefendants })
  })

  router.post('/cases/:caseId/make-charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
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
        await prisma.defendant.updateMany({
          where: { cases: { some: { id: caseId } } },
          data: { status },
        })
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Charging decision made',
        meta: { ...req.session.data.chargingDecision },
        caseId,
      },
    })

    delete req.session.data.chargingDecision

    req.flash('success', decisionFlashMap[decision] || 'Charging decision recorded')
    res.redirect(`/cases/${caseId}`)
  })
}
