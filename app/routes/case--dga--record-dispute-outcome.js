const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { calculateLegacyOutcome, isFinalFailure } = require('../helpers/dgaLegacyOutcome')

async function fetchCase(caseId, failureReasonId) {
  return prisma.case.findUnique({
    where: { id: caseId },
    include: {
      dga: {
        include: {
          failureReasons: failureReasonId
            ? { where: { id: failureReasonId } }
            : true
        }
      }
    }
  })
}

module.exports = router => {

  // Step 1: Did the police dispute this failure?
  router.get('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)
    const caseData = await fetchCase(caseId, failureReasonId)

    res.render('cases/dga/record-dispute-outcome/index', {
      case: caseData,
      failureReason: caseData.dga.failureReasons[0],
      selectedDisputed: req.session.data.recordOutcome?.disputed
    })
  })

  router.post('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome', (req, res) => {
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId
    const disputed = req.body.recordOutcome?.disputed

    _.set(req, 'session.data.recordOutcome.disputed', disputed)

    if (disputed === 'No') {
      _.set(req, 'session.data.recordOutcome.cpsAccepted', null)
      _.set(req, 'session.data.recordOutcome.explanation', null)
      _.set(req, 'session.data.recordOutcome.methods', null)
      return res.redirect(`/cases/${caseId}/dga/${failureReasonId}/record-dispute-outcome/check`)
    }

    res.redirect(`/cases/${caseId}/dga/${failureReasonId}/record-dispute-outcome/cps-accepted`)
  })

  // Step 1b: Did CPS accept the dispute?
  router.get('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/cps-accepted', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)
    const caseData = await fetchCase(caseId, failureReasonId)

    res.render('cases/dga/record-dispute-outcome/cps-accepted', {
      case: caseData,
      failureReason: caseData.dga.failureReasons[0],
      selectedCpsAccepted: req.session.data.recordOutcome?.cpsAccepted
    })
  })

  router.post('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/cps-accepted', (req, res) => {
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId

    _.set(req, 'session.data.recordOutcome.cpsAccepted', req.body.recordOutcome?.cpsAccepted)

    res.redirect(`/cases/${caseId}/dga/${failureReasonId}/record-dispute-outcome/reason`)
  })

  // Step 2a: Reason for outcome
  router.get('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/reason', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)
    const caseData = await fetchCase(caseId, failureReasonId)

    res.render('cases/dga/record-dispute-outcome/reason', {
      case: caseData,
      failureReason: caseData.dga.failureReasons[0],
      details: req.session.data.recordOutcome?.explanation
    })
  })

  router.post('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/reason', (req, res) => {
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId

    _.set(req, 'session.data.recordOutcome.explanation', req.body.recordOutcome?.explanation)

    res.redirect(`/cases/${caseId}/dga/${failureReasonId}/record-dispute-outcome/method`)
  })

  // Step 2b: Methods
  router.get('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/method', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)
    const caseData = await fetchCase(caseId, failureReasonId)

    res.render('cases/dga/record-dispute-outcome/method', {
      case: caseData,
      failureReason: caseData.dga.failureReasons[0],
      selectedMethods: req.session.data.recordOutcome?.methods || []
    })
  })

  router.post('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/method', (req, res) => {
    const caseId = req.params.caseId
    const failureReasonId = req.params.failureReasonId
    let methods = req.body.recordOutcome?.methods

    if (!methods) {
      methods = []
    } else if (!Array.isArray(methods)) {
      methods = [methods]
    }
    methods = methods.filter(m => m !== '_unchecked')

    _.set(req, 'session.data.recordOutcome.methods', methods)

    res.redirect(`/cases/${caseId}/dga/${failureReasonId}/record-dispute-outcome/check`)
  })

  // Step 3: Check answers
  router.get('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { dga: { include: { failureReasons: true } } }
    })

    const failureReason = caseData.dga.failureReasons.find(fr => fr.id === failureReasonId)
    const allFailureReasons = caseData.dga.failureReasons

    let legacyOutcome = null
    if (isFinalFailure(allFailureReasons)) {
      const simulatedReasons = allFailureReasons.map(fr => {
        if (fr.id === failureReasonId) {
          return {
            ...fr,
            disputed: req.session.data.recordOutcome?.disputed,
            cpsAccepted: req.session.data.recordOutcome?.cpsAccepted
          }
        }
        return fr
      })
      legacyOutcome = calculateLegacyOutcome(simulatedReasons)
    }

    res.render('cases/dga/record-dispute-outcome/check', {
      case: caseData,
      failureReason,
      legacyOutcome
    })
  })

  router.post('/cases/:caseId/dga/:failureReasonId/record-dispute-outcome/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const failureReasonId = parseInt(req.params.failureReasonId)

    const disputed = req.session.data.recordOutcome?.disputed
    const cpsAccepted = req.session.data.recordOutcome?.cpsAccepted
    const details = req.session.data.recordOutcome?.explanation
    const methods = req.session.data.recordOutcome?.methods

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        policeUnit: true,
        dga: { include: { failureReasons: true } }
      }
    })

    await prisma.dGAFailureReason.update({
      where: { id: failureReasonId },
      data: {
        disputed,
        cpsAccepted,
        details,
        methods: methods ? methods.join(', ') : null
      }
    })

    const failureReason = caseData.dga.failureReasons.find(fr => fr.id === failureReasonId)

    // Derive month name for activity log
    const date = new Date(caseData.dga.reviewDate)
    const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const meta = {
      failureReason: failureReason.reason,
      policeUnit: caseData.policeUnit?.name || 'Not specified',
      monthName,
      ...req.session.data.recordOutcome
    }

    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'DGAFailureReason',
        recordId: failureReasonId,
        action: 'UPDATE',
        title: 'DGA outcome recorded',
        caseId,
        meta
      }
    })

    delete req.session.data.recordOutcome

    req.flash('success', 'Outcome recorded')

    res.redirect(`/cases/${caseId}/dga`)
  })

}
