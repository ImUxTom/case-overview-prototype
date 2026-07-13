const statuses = require('../data/case-statuses')

// A case's review is shared - whoever opens it continues the same review
// rather than getting their own private copy, so document status and
// annotations are visible regardless of who is signed in.
async function findOrCreateReview(prisma, caseId, userId) {
  let review = await prisma.caseReview.findFirst({
    where: { caseId, status: 'in_progress' }
  })
  if (!review) {
    review = await prisma.caseReview.findFirst({
      where: { caseId },
      orderBy: { updatedAt: 'desc' }
    })
  }
  if (!review) {
    review = await prisma.caseReview.create({
      data: { caseId, userId }
    })
  }
  return review
}

async function findOrCreateDocumentReview(prisma, caseReviewId, documentId) {
  let docReview = await prisma.caseReviewDocument.findFirst({
    where: { caseReviewId, documentId }
  })
  if (!docReview) {
    docReview = await prisma.caseReviewDocument.create({
      data: { caseReviewId, documentId }
    })
  }
  return docReview
}

// Charges belonging to defendants who are still awaiting a charging decision
// this review, in a stable order (defendant order, then charge order).
async function getEligibleCharges(prisma, caseId) {
  const _case = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      defendants: {
        include: { charges: { include: { elements: { orderBy: { order: 'asc' } } } } }
      }
    },
  })

  const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.NOT_CHARGED && d.needsReview)
  const charges = eligibleDefendants.flatMap(d => d.charges.map(charge => ({ ...charge, defendant: d })))

  return { _case, eligibleDefendants, charges }
}

// Offences (charges) can be added, changed or removed after a Charging
// decision has already been marked complete. When that happens, the
// recorded per-charge decisions no longer reliably reflect the current
// charges, so drop decisions for charges that no longer exist and reset
// completeness — the task list will then show "In progress" or "Not
// started" based on what's left, rather than staying "Completed".
async function syncChargingDecisionAfterOffenceChange(prisma, req, caseId, defendantId) {
  const userId = req.session.data.user.id
  const review = await findOrCreateReview(prisma, caseId, userId)

  const currentCharges = await prisma.charge.findMany({ where: { defendantId }, select: { id: true } })
  const currentChargeIds = currentCharges.map(c => c.id)

  const decisions = req.session.data.chargingDecision?.decisions || {}
  const prunedDecisions = Object.fromEntries(
    Object.entries(decisions).filter(([chargeId]) => currentChargeIds.includes(Number(chargeId)))
  )
  req.session.data.chargingDecision = { ...req.session.data.chargingDecision, decisions: prunedDecisions }

  if (review.chargingDecisionComplete) {
    await prisma.caseReview.update({
      where: { id: review.id },
      data: { chargingDecisionComplete: false },
    })
  }
}

module.exports = {
  findOrCreateReview,
  findOrCreateDocumentReview,
  getEligibleCharges,
  syncChargingDecisionAfterOffenceChange,
}
