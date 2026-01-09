const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {

  // Step 1: Select outcome
  router.get('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome', async (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = parseInt(req.params.policeUnitId)
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dga: {
          include: {
            failureReasons: {
              where: { id: failureReasonId }
            }
          }
        }
      }
    })

    const failureReason = caseData.dga.failureReasons[0]

    res.render('dga-reviews/record-dispute-outcome/index', {
      case: caseData,
      failureReason: failureReason,
      selectedOutcome: req.session.data.recordOutcome?.outcome,
      monthKey,
      policeUnitId
    })
  })

  router.post('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome', (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = req.params.policeUnitId
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId
    const outcome = req.body.recordOutcome?.outcome

    // Store in session
    _.set(req, 'session.data.recordOutcome.outcome', outcome)

    // If "Not disputed", skip to check answers
    if (outcome === 'Not disputed') {
      _.set(req, 'session.data.recordOutcome.explanation', null)
      _.set(req, 'session.data.recordOutcome.methods', null)
      return res.redirect(`/dga-reviews/${monthKey}/${policeUnitId}/${caseId}/${failureReasonId}/record-dispute-outcome/check`)
    }

    // Otherwise go to details page
    res.redirect(`/dga-reviews/${monthKey}/${policeUnitId}/${caseId}/${failureReasonId}/record-dispute-outcome/explanation`)
  })

  // Step 2a: Add details (only if disputed)
  router.get('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/explanation', async (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = parseInt(req.params.policeUnitId)
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dga: {
          include: {
            failureReasons: {
              where: { id: failureReasonId }
            }
          }
        }
      }
    })

    const failureReason = caseData.dga.failureReasons[0]

    res.render('dga-reviews/record-dispute-outcome/explanation', {
      case: caseData,
      failureReason: failureReason,
      details: req.session.data.recordOutcome?.explanation,
      monthKey,
      policeUnitId
    })
  })

  router.post('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/explanation', (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = req.params.policeUnitId
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId
    const details = req.body.recordOutcome?.explanation

    _.set(req, 'session.data.recordOutcome.explanation', details)

    res.redirect(`/dga-reviews/${monthKey}/${policeUnitId}/${caseId}/${failureReasonId}/record-dispute-outcome/method`)
  })

  // Step 2b: Select methods (only if disputed)
  router.get('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/method', async (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = parseInt(req.params.policeUnitId)
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dga: {
          include: {
            failureReasons: {
              where: { id: failureReasonId }
            }
          }
        }
      }
    })

    const failureReason = caseData.dga.failureReasons[0]

    res.render('dga-reviews/record-dispute-outcome/method', {
      case: caseData,
      failureReason: failureReason,
      selectedMethods: req.session.data.recordOutcome?.methods || [],
      monthKey,
      policeUnitId
    })
  })

  router.post('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/method', (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = req.params.policeUnitId
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId
    let methods = req.body.recordOutcome?.methods

    // Ensure methods is always an array
    if (!methods) {
      methods = []
    } else if (!Array.isArray(methods)) {
      methods = [methods]
    }

    // Filter out the _unchecked value added by GOV.UK Frontend
    methods = methods.filter(method => method !== '_unchecked')

    _.set(req, 'session.data.recordOutcome.methods', methods)

    res.redirect(`/dga-reviews/${monthKey}/${policeUnitId}/${caseId}/${failureReasonId}/record-dispute-outcome/check`)
  })

  // Step 3: Check answers
  router.get('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/check', async (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = parseInt(req.params.policeUnitId)
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dga: {
          include: {
            failureReasons: {
              where: { id: failureReasonId }
            }
          }
        }
      }
    })

    const failureReason = caseData.dga.failureReasons[0]
    const outcome = req.session.data.recordOutcome?.outcome
    const details = req.session.data.recordOutcome?.explanation
    const methods = req.session.data.recordOutcome?.methods || []

    res.render('dga-reviews/record-dispute-outcome/check', {
      case: caseData,
      failureReason: failureReason,
      outcome: outcome,
      details: details,
      methods: methods,
      monthKey,
      policeUnitId
    })
  })

  router.post('/dga-reviews/:month/:policeUnitId/:caseId/:failureReasonId/record-dispute-outcome/check', async (req, res) => {
    const monthKey = req.params.month
    const policeUnitId = parseInt(req.params.policeUnitId)
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const outcome = req.session.data.recordOutcome?.outcome
    const details = req.session.data.recordOutcome?.explanation
    const methods = req.session.data.recordOutcome?.methods

    // Get case data for redirect
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        policeUnit: true,
        dga: {
          include: {
            failureReasons: true
          }
        }
      }
    })

    // Update the failure reason with the outcome, details, and methods
    await prisma.dGAFailureReason.update({
      where: { id: failureReasonId },
      data: {
        outcome: outcome,
        details: details,
        methods: methods ? methods.join(', ') : null
      }
    })

    // Get the failure reason for activity log
    const failureReason = caseData.dga.failureReasons.find(fr => fr.id === failureReasonId)

    // Calculate month name for activity log
    const [year, month] = monthKey.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    // Build meta object for activity log
    const meta = {
      failureReason: failureReason.reason,
      policeUnit: caseData.policeUnit?.name || 'Not specified',
      monthName,
      monthKey,
      policeUnitId: caseData.policeUnitId,
      ...req.session.data.recordOutcome
    }

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'DGAFailureReason',
        recordId: failureReasonId,
        action: 'UPDATE',
        title: 'DGA dispute outcome recorded',
        caseId: caseId,
        meta: meta
      }
    })

    delete req.session.data.recordOutcome

    req.flash('success', 'Decision recorded')

    res.redirect(`/dga-reviews/${monthKey}/${policeUnitId}/${caseId}`)
  })

}
