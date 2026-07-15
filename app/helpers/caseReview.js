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

// Evidence and disclosure annotations linked to an element, with enough
// included context to render annotation cards (source document, and every
// element each annotation is linked to).
async function getElementAnnotations(prisma, elementId) {
  const annotationLinks = await prisma.caseReviewAnnotationElement.findMany({
    where: { elementId, annotation: { type: { in: ['evidence', 'disclosure'] } } },
    orderBy: { createdAt: 'asc' },
    include: {
      annotation: {
        include: {
          caseReviewDocument: { include: { document: true } },
          elements: { include: { element: { include: { charge: true } } } }
        }
      }
    }
  })
  return annotationLinks.map(link => link.annotation)
}

// A live review keeps the per-charge charging decisions and the information
// request answer in the session, but seeded in-progress reviews arrive with
// both already made, stored on the review row (decision). Copy them into the
// session the first time the review is opened so the task list and check
// pages reflect the seeded state.
function hydrateSeededReviewSession(req, review, charges) {
  if (review.status !== 'in_progress' || !review.decision) return

  const decisions = req.session.data.chargingDecision?.decisions || {}
  if (charges.length && !charges.some(charge => decisions[charge.id])) {
    req.session.data.chargingDecision = {
      ...req.session.data.chargingDecision,
      decisions: {
        ...decisions,
        ...Object.fromEntries(charges.map(charge => [charge.id, review.decision]))
      }
    }
  }

  if (!req.session.data.reviewInformationRequest) {
    req.session.data.reviewInformationRequest = { wantsInformationRequest: 'no', complete: true, items: [] }
  }
}

// Offences (charges) can be added, changed or removed after the Charging
// decision or Strength assessment tasks have already been marked complete.
// When that happens, the recorded per-charge decisions and element strengths
// no longer reliably reflect the current charges, so drop decisions for
// charges that no longer exist and reset completeness — the task list will
// then show "In progress" or "Not started" based on what's left, rather
// than staying "Completed".
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

  const resets = {}
  if (review.chargingDecisionComplete) resets.chargingDecisionComplete = false
  if (review.strengthAssessmentComplete) resets.strengthAssessmentComplete = false
  if (Object.keys(resets).length) {
    await prisma.caseReview.update({
      where: { id: review.id },
      data: resets,
    })
  }
}

module.exports = {
  findOrCreateReview,
  findOrCreateDocumentReview,
  getEligibleCharges,
  getElementAnnotations,
  hydrateSeededReviewSession,
  syncChargingDecisionAfterOffenceChange,
}
