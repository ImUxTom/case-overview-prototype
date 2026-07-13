const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { getEligibleCharges, findOrCreateReview } = require('../helpers/caseReview')

module.exports = (router) => {
  // Entry point — send the reviewer to the first charge that still needs a decision
  router.get('/cases/:caseId/review/charging-decision', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    if (req.query.referrer) {
      req.session.data.chargingDecision = { ...req.session.data.chargingDecision, referrer: req.query.referrer }
    }

    const { charges } = await getEligibleCharges(prisma, caseId)
    if (!charges.length) {
      return res.redirect(`/cases/${caseId}/review`)
    }

    const decisions = req.session.data.chargingDecision?.decisions || {}
    const nextCharge = charges.find(charge => !decisions[charge.id]) || charges[0]
    res.redirect(`/cases/${caseId}/review/charging-decision/${nextCharge.id}`)
  })

  // Charging decision — check answers
  // Registered before the /:chargeId routes below so "check" isn't matched as a chargeId.
  router.get('/cases/:caseId/review/charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id
    const { _case, eligibleDefendants, charges } = await getEligibleCharges(prisma, caseId)
    const review = await findOrCreateReview(prisma, caseId, userId)

    const decisions = req.session.data.chargingDecision?.decisions || {}
    const chargeRows = charges.map(charge => ({
      ...charge,
      decision: decisions[charge.id],
    }))

    res.render('cases/review/charging-decision/check', {
      _case,
      review,
      charges: chargeRows,
      showDefendantName: eligibleDefendants.length > 1,
    })
  })

  router.post('/cases/:caseId/review/charging-decision/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id
    const review = await findOrCreateReview(prisma, caseId, userId)

    await prisma.caseReview.update({
      where: { id: review.id },
      data: { chargingDecisionComplete: req.body.complete === 'yes' },
    })

    res.redirect(`/cases/${caseId}/review`)
  })

  // Charge decision — one charge per page
  router.get('/cases/:caseId/review/charging-decision/:chargeId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const chargeId = parseInt(req.params.chargeId)
    const { _case, eligibleDefendants, charges } = await getEligibleCharges(prisma, caseId)

    const chargeIndex = charges.findIndex(charge => charge.id === chargeId)
    if (chargeIndex === -1) {
      return res.redirect(`/cases/${caseId}/review/charging-decision`)
    }

    const charge = charges[chargeIndex]
    const elementRows = (charge.elements || []).map(element => ({
      key: { text: element.description },
      value: {
        html: _.escape(element.strength || 'Not assessed') +
          (element.strengthReasoning
            ? `<br><span class="govuk-hint govuk-!-margin-bottom-0">${_.escape(element.strengthReasoning)}</span>`
            : '')
      }
    }))

    res.render('cases/review/charging-decision/index', {
      _case,
      charge,
      elementRows,
      chargeNumber: chargeIndex + 1,
      totalCharges: charges.length,
      showDefendantName: eligibleDefendants.length > 1,
      selectedDecision: req.session.data.chargingDecision?.decisions?.[chargeId],
      isFirstCharge: chargeIndex === 0,
      from: req.query.from,
    })
  })

  router.post('/cases/:caseId/review/charging-decision/:chargeId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const chargeId = parseInt(req.params.chargeId)

    req.session.data.chargingDecision = {
      ...req.session.data.chargingDecision,
      decisions: {
        ...req.session.data.chargingDecision?.decisions,
        [chargeId]: req.body.decision,
      },
    }

    if (req.body.from === 'check') {
      return res.redirect(`/cases/${caseId}/review/charging-decision/check`)
    }

    const { charges } = await getEligibleCharges(prisma, caseId)
    const chargeIndex = charges.findIndex(charge => charge.id === chargeId)
    const nextCharge = charges[chargeIndex + 1]

    if (nextCharge) {
      res.redirect(`/cases/${caseId}/review/charging-decision/${nextCharge.id}`)
    } else {
      res.redirect(`/cases/${caseId}/review/charging-decision/check`)
    }
  })
}
