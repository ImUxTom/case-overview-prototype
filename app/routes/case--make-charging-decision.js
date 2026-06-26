const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const statuses = require('../data/case-statuses')

// CPS only ever states what the charges should be - it never charges a
// defendant directly. A "Charge" decision here moves the defendant to
// Charges pending; they only become Charged once the police or referring
// agency send back authorised charges.
const decisionStatusMap = {
  'charge': statuses.CHARGES_PENDING,
  'do-not-charge': statuses.NO_FURTHER_ACTION,
}

const decisionFlashMap = {
  'charge': 'Charges stated',
  'do-not-charge': 'Case marked as do not charge',
}

module.exports = (router) => {
  router.get('/cases/:caseId/make-charging-decision', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    if (req.query.referrer) {
      req.session.data.chargingDecision = { ...req.session.data.chargingDecision, referrer: req.query.referrer }
    }

    res.render('cases/make-charging-decision/index', {
      _case,
      selectedDecision: req.session.data.chargingDecision?.decision,
    })
  })

  router.post('/cases/:caseId/make-charging-decision', async (req, res) => {
    const caseId = req.params.caseId
    req.session.data.chargingDecision = {
      referrer: req.session.data.chargingDecision?.referrer,
      decision: req.body.decision,
    }

    const _case = await prisma.case.findUnique({
      where: { id: parseInt(caseId) },
      include: { defendants: true },
    })
    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.NOT_CHARGED && d.needsReview)

    if (eligibleDefendants.length > 1) {
      res.redirect(`/cases/${caseId}/make-charging-decision/defendants`)
    } else {
      res.redirect(`/cases/${caseId}/review`)
    }
  })

  router.get('/cases/:caseId/make-charging-decision/defendants', async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true },
    })

    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.NOT_CHARGED && d.needsReview)
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
    res.redirect(`/cases/${caseId}/review`)
  })

  router.get('/cases/:caseId/make-charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true },
    })

    const { defendantIds } = req.session.data.chargingDecision || {}
    const selectedDefendants = defendantIds
      ? _case.defendants.filter(d => defendantIds.includes(String(d.id)))
      : null

    const review = await prisma.caseReview.findFirst({
      where: { caseId, userId, status: 'in_progress' },
      include: {
        documents: {
          include: {
            document: true,
            annotations: { orderBy: { createdAt: 'asc' } }
          }
        }
      }
    })

    res.render('cases/make-charging-decision/check', { _case, selectedDefendants, review })
  })

  router.post('/cases/:caseId/make-charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id
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

    // Mark review as submitted
    const review = await prisma.caseReview.findFirst({
      where: { caseId, userId, status: 'in_progress' }
    })

    if (review) {
      await prisma.caseReview.update({
        where: { id: review.id },
        data: { status: 'submitted', decision }
      })
    }

    await prisma.activityLog.create({
      data: {
        userId,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Charging decision made',
        meta: {
          ...req.session.data.chargingDecision,
          caseReviewId: review?.id
        },
        caseId,
      },
    })

    const referrer = req.session.data.chargingDecision?.referrer
    delete req.session.data.chargingDecision

    req.flash('success', decisionFlashMap[decision] || 'Charging decision recorded')
    res.redirect(referrer || `/cases/${caseId}`)
  })
}
