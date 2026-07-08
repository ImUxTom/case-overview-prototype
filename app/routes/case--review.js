const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { generateDocumentContent } = require('../helpers/documentContent')
const statuses = require('../data/case-statuses')
const hearingStatuses = require('../data/hearing-statuses')
const charges = require('../data/charges')
const elementsByChargeCode = require('../data/elements')
const {
  formatSessionDate,
  formatDefendantNames,
  createInformationRequestFromSession,
} = require('../helpers/informationRequest')

// CPS only ever states what the charges should be - it never charges a
// defendant directly. A "Charge" decision here moves the defendant to
// Charges pending; they only become Charged once the police or referring
// agency send back authorised charges.
const decisionStatusMap = {
  'charge': statuses.CHARGES_PENDING,
  'do-not-charge': statuses.NO_FURTHER_ACTION,
}

function parseHearingTime(time) {
  const match = String(time || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!match) return { hour: 10, minute: 0 }

  let hour = parseInt(match[1], 10)
  const minute = match[2] ? parseInt(match[2], 10) : 0
  const meridiem = match[3]?.toLowerCase()

  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0

  return { hour, minute }
}

// A case's review is shared - whoever opens it continues the same review
// rather than getting their own private copy, so document status and
// annotations are visible regardless of who is signed in.
async function findOrCreateReview(caseId, userId) {
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

async function findOrCreateDocumentReview(caseReviewId, documentId) {
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

// Targets the exact paragraph/occurrence the user selected, rather than
// replacing every matching string across the document (mirrors applyRedactions).
function applyMarks(sections, items, markUp) {
  if (!items.length) return sections
  const flatParagraphs = sections.flatMap(s => s.paragraphs)
  items.forEach(item => {
    const paraIdx = item.paragraphIndex
    if (paraIdx < 0 || paraIdx >= flatParagraphs.length) return
    const escaped = item.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    const target = item.occurrenceIndex
    let count = 0
    flatParagraphs[paraIdx] = flatParagraphs[paraIdx].replace(regex, function(match) {
      return count++ === target ? markUp(item) : match
    })
  })
  let flatIdx = 0
  return sections.map(section => ({
    heading: section.heading,
    paragraphs: section.paragraphs.map(() => flatParagraphs[flatIdx++])
  }))
}

function applyHighlights(sections, annotations) {
  return applyMarks(sections, annotations, annotation =>
    `<mark class="app-annotation app-annotation--${annotation.type}" data-annotation-id="${annotation.id}">${annotation.selectedText}</mark>`
  )
}

function applyInadmissibles(sections, inadmissibles) {
  return applyMarks(sections, inadmissibles, item =>
    `<mark class="app-inadmissible" data-inadmissible-id="${item.id}">${item.selectedText}</mark>`
  )
}

function buildElementCheckboxItems(elements, options) {
  const idPrefix = options?.idPrefix || 'reasoning'
  const linkedByElementId = options?.linkedByElementId || {}
  return elements.map(element => {
    const linkedReasoning = linkedByElementId[element.id]
    return {
      value: String(element.id),
      text: element.description,
      checked: linkedReasoning !== undefined,
      conditional: {
        html: `<div class="govuk-form-group govuk-!-margin-bottom-0">
  <label class="govuk-label govuk-label--s" for="${idPrefix}-${element.id}">Reasoning</label>
  <textarea class="govuk-textarea govuk-!-margin-bottom-0 js-annotation-element-reasoning" id="${idPrefix}-${element.id}" name="${idPrefix}-${element.id}" rows="2" data-element-id="${element.id}">${_.escape(linkedReasoning || '')}</textarea>
</div>`
      }
    }
  })
}

function formatTimestamp(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function applyRedactions(sections, redactions) {
  return applyMarks(sections, redactions, redaction =>
    `<mark class="app-redaction" data-redaction-id="${redaction.id}">${redaction.selectedText}</mark>`
  )
}

module.exports = (router) => {
  // Task list
  router.get('/cases/:caseId/review', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true }
    })

    const review = await findOrCreateReview(caseId, userId)

    const documents = await prisma.document.findMany({
      where: { caseId },
      orderBy: { id: 'asc' }
    })

    const documentReviews = await prisma.caseReviewDocument.findMany({
      where: { caseReviewId: review.id },
      include: { annotations: { orderBy: { createdAt: 'asc' } } }
    })

    const docReviewMap = {}
    documentReviews.forEach(dr => { docReviewMap[dr.documentId] = dr })

    const eligibleDefendants = _case.defendants.filter(d => d.status === statuses.NOT_CHARGED && d.needsReview)
    const needsChargingDecision = eligibleDefendants.length > 0
    const chargingDecisionNeedsDefendantSelection = eligibleDefendants.length > 1

    res.render('cases/review/index', { _case, documents, review, docReviewMap, needsChargingDecision, chargingDecisionNeedsDefendantSelection })
  })

  // Document viewer
  router.get('/cases/:caseId/review/documents/:documentId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const [_case, document] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          defendants: {
            include: { charges: { include: { elements: { orderBy: { order: 'asc' } } } } }
          }
        }
      }),
      prisma.document.findUnique({ where: { id: documentId } })
    ])

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)

    if (docReview.status === 'not_started') {
      await prisma.caseReviewDocument.update({
        where: { id: docReview.id },
        data: { status: 'in_progress' }
      })
    }

    const isVideo = document.type === 'MP4'
    const isPhoto = document.type === 'JPG' || document.type === 'PNG'

    const annotations = await prisma.caseReviewAnnotation.findMany({
      where: { caseReviewDocumentId: docReview.id },
      orderBy: { createdAt: 'asc' },
      include: { elements: { include: { element: true } } }
    })

    const [redactions, inadmissibles] = (isVideo || isPhoto) ? [[], []] : await Promise.all([
      prisma.caseReviewRedaction.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.caseReviewInadmissible.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      })
    ])

    const defendantCharges = _case.defendants[0]?.charges || []

    function buildElementRows(elements) {
      return elements.map(element => ({
        key: { text: element.description },
        value: { text: element.strength || 'Not assessed' },
        actions: {
          items: [
            {
              href: `/cases/${caseId}/review/documents/${documentId}/elements/${element.id}/edit`,
              text: 'Change',
              visuallyHiddenText: element.description
            }
          ]
        }
      }))
    }

    // Evidence annotations can link elements from any offence, so each
    // offence gets its own checkbox group in the sidebar rather than one
    // flat list assuming a single offence.
    const offences = defendantCharges.map(charge => ({
      charge,
      elementRows: buildElementRows(charge.elements || []),
      elementCheckboxItems: buildElementCheckboxItems(charge.elements || [], {
        idPrefix: `reasoning-charge-${charge.id}`
      }),
      disclosureElementCheckboxItems: buildElementCheckboxItems(charge.elements || [], {
        idPrefix: `disclosure-reasoning-charge-${charge.id}`
      })
    }))

    const hasElements = offences.some(offence => offence.elementCheckboxItems.length)

    // Each evidence, disclosure or note annotation gets its own copy of the checkbox
    // groups, pre-checked and pre-filled with whatever elements it's already linked
    // to, so "Change" can re-open the same form used when it was first added.
    annotations.forEach(annotation => {
      if (!['evidence', 'disclosure', 'note'].includes(annotation.type)) return
      const linkedByElementId = {}
      annotation.elements.forEach(item => { linkedByElementId[item.elementId] = item.reasoning })
      annotation.editOffences = offences.map(offence => ({
        charge: offence.charge,
        elementCheckboxItems: buildElementCheckboxItems(offence.charge.elements || [], {
          idPrefix: `reasoning-${annotation.id}-charge-${offence.charge.id}`,
          linkedByElementId
        })
      }))
    })

    let sections = []
    if (!isVideo && !isPhoto) {
      const rawSections = generateDocumentContent(document)
      const annotatedSections = applyHighlights(rawSections, annotations)
      const redactedSections = applyRedactions(annotatedSections, redactions)
      sections = applyInadmissibles(redactedSections, inadmissibles)
    }

    let template = 'cases/review/document/index'
    if (isVideo) template = 'cases/review/video/index'
    if (isPhoto) template = 'cases/review/photo/index'

    res.render(template, {
      _case,
      document,
      offences,
      hasElements,
      sections,
      annotations,
      redactions,
      inadmissibles,
      isVideo,
      isPhoto,
      videoUrl: isVideo ? '/public/videos/cctv-placeholder.mp4' : null,
      photoUrl: isPhoto ? '/public/images/evidence-photo-placeholder.jpg' : null,
      caseId,
      documentId,
      docReviewId: docReview.id,
      user: req.session.data.user,
      isReviewMode: true
    })
  })

  // Element — edit strength
  router.get('/cases/:caseId/review/documents/:documentId/elements/:elementId/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const elementId = parseInt(req.params.elementId)

    const [_case, element] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.element.findUnique({ where: { id: elementId } })
    ])

    res.render('cases/review/elements/edit', { _case, element, caseId, documentId })
  })

  router.post('/cases/:caseId/review/documents/:documentId/elements/:elementId/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const elementId = parseInt(req.params.elementId)

    await prisma.element.update({
      where: { id: elementId },
      data: { strength: req.body.strength }
    })

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Add offence — select offence
  router.get('/cases/:caseId/review/documents/:documentId/add-offence', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: { include: { charges: true } } }
    })

    const existingChargeCodes = (_case.defendants[0]?.charges || []).map(c => c.chargeCode)

    if (req.query.reset || !req.session.data.addOffence) {
      req.session.data.addOffence = { chargeCodes: [] }
    }

    const offenceItems = charges
      .filter(c => !existingChargeCodes.includes(c.code))
      .map(c => ({
        value: c.code,
        text: c.description
      }))

    res.render('cases/review/add-offence/index', { _case, caseId, documentId, offenceItems })
  })

  router.post('/cases/:caseId/review/documents/:documentId/add-offence', (req, res) => {
    const caseId = req.params.caseId
    const documentId = req.params.documentId

    const chargeCodes = req.body.addOffence?.chargeCodes
    req.session.data.addOffence = {
      ...req.session.data.addOffence,
      chargeCodes: chargeCodes ? [].concat(chargeCodes) : []
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}/add-offence/check`)
  })

  // Add offence — check answers
  router.get('/cases/:caseId/review/documents/:documentId/add-offence/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)

    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    const addOffence = req.session.data.addOffence || {}
    const selectedCharges = charges.filter(c => (addOffence.chargeCodes || []).includes(c.code))

    res.render('cases/review/add-offence/check', { _case, caseId, documentId, addOffence, selectedCharges })
  })

  router.post('/cases/:caseId/review/documents/:documentId/add-offence/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true }
    })
    const defendant = _case.defendants[0]

    const addOffence = req.session.data.addOffence || {}
    const selectedCharges = charges.filter(c => (addOffence.chargeCodes || []).includes(c.code))

    for (const selectedCharge of selectedCharges) {
      const charge = await prisma.charge.create({
        data: {
          chargeCode: selectedCharge.code,
          description: selectedCharge.description,
          status: 'Under review',
          offenceDate: new Date(),
          isCount: false,
          defendantId: defendant.id
        }
      })

      const elementDescriptions = elementsByChargeCode[selectedCharge.code] || []
      await prisma.element.createMany({
        data: elementDescriptions.map((description, index) => ({
          description,
          order: index,
          chargeId: charge.id
        }))
      })

      await prisma.activityLog.create({
        data: {
          userId,
          model: 'Case',
          recordId: caseId,
          action: 'CREATE',
          title: 'Offence added',
          meta: { documentId, description: selectedCharge.description },
          caseId
        }
      })
    }

    delete req.session.data.addOffence

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Change offence — select offence
  router.get('/cases/:caseId/review/documents/:documentId/change-offence', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: { include: { charges: true } } }
    })

    const existingChargeCodes = (_case.defendants[0]?.charges || []).map(c => c.chargeCode)

    if (req.query.reset || !req.session.data.changeOffence) {
      req.session.data.changeOffence = { chargeCodes: existingChargeCodes }
    }

    const offenceItems = charges.map(c => ({
      value: c.code,
      text: c.description
    }))

    res.render('cases/review/change-offence/index', { _case, caseId, documentId, offenceItems })
  })

  router.post('/cases/:caseId/review/documents/:documentId/change-offence', (req, res) => {
    const caseId = req.params.caseId
    const documentId = req.params.documentId

    const chargeCodes = req.body.changeOffence?.chargeCodes
    req.session.data.changeOffence = {
      ...req.session.data.changeOffence,
      chargeCodes: chargeCodes ? [].concat(chargeCodes) : []
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}/change-offence/check`)
  })

  // Change offence — check answers
  router.get('/cases/:caseId/review/documents/:documentId/change-offence/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)

    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    const changeOffence = req.session.data.changeOffence || {}
    const selectedCharges = charges.filter(c => (changeOffence.chargeCodes || []).includes(c.code))

    res.render('cases/review/change-offence/check', { _case, caseId, documentId, changeOffence, selectedCharges })
  })

  router.post('/cases/:caseId/review/documents/:documentId/change-offence/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: { include: { charges: { include: { elements: true } } } } }
    })
    const defendant = _case.defendants[0]

    const changeOffence = req.session.data.changeOffence || {}
    const selectedCharges = charges.filter(c => (changeOffence.chargeCodes || []).includes(c.code))

    const existingChargeIds = defendant.charges.map(c => c.id)
    const existingElementIds = defendant.charges.flatMap(c => c.elements.map(e => e.id))

    await prisma.caseReviewAnnotationElement.deleteMany({ where: { elementId: { in: existingElementIds } } })
    await prisma.element.deleteMany({ where: { chargeId: { in: existingChargeIds } } })
    await prisma.charge.deleteMany({ where: { id: { in: existingChargeIds } } })

    for (const selectedCharge of selectedCharges) {
      const charge = await prisma.charge.create({
        data: {
          chargeCode: selectedCharge.code,
          description: selectedCharge.description,
          status: 'Under review',
          offenceDate: new Date(),
          isCount: false,
          defendantId: defendant.id
        }
      })

      const elementDescriptions = elementsByChargeCode[selectedCharge.code] || []
      await prisma.element.createMany({
        data: elementDescriptions.map((description, index) => ({
          description,
          order: index,
          chargeId: charge.id
        }))
      })

      await prisma.activityLog.create({
        data: {
          userId,
          model: 'Case',
          recordId: caseId,
          action: 'UPDATE',
          title: 'Offence changed',
          meta: { documentId, description: selectedCharge.description },
          caseId
        }
      })
    }

    delete req.session.data.changeOffence

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Remove offence — confirm GET
  router.get('/cases/:caseId/review/documents/:documentId/offences/:chargeId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const chargeId = parseInt(req.params.chargeId)

    const [_case, document, charge] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } }),
      prisma.charge.findUnique({ where: { id: chargeId }, include: { elements: true } })
    ])

    const elementIds = charge.elements.map(e => e.id)
    const linkedAnnotations = elementIds.length
      ? await prisma.caseReviewAnnotationElement.findMany({
          where: { elementId: { in: elementIds } },
          distinct: ['annotationId']
        })
      : []

    res.render('cases/review/offence/remove', {
      _case,
      document,
      charge,
      caseId,
      documentId,
      linkedAnnotationCount: linkedAnnotations.length
    })
  })

  // Remove offence — POST
  router.post('/cases/:caseId/review/documents/:documentId/offences/:chargeId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const chargeId = parseInt(req.params.chargeId)
    const userId = req.session.data.user.id

    const charge = await prisma.charge.findUnique({
      where: { id: chargeId },
      include: { elements: true }
    })
    const elementIds = charge.elements.map(e => e.id)

    await prisma.caseReviewAnnotationElement.deleteMany({ where: { elementId: { in: elementIds } } })
    await prisma.element.deleteMany({ where: { chargeId } })
    await prisma.charge.delete({ where: { id: chargeId } })

    await prisma.activityLog.create({
      data: {
        userId,
        model: 'Case',
        recordId: caseId,
        action: 'DELETE',
        title: 'Offence removed',
        meta: { documentId, description: charge.description },
        caseId
      }
    })

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Add annotation
  router.post('/cases/:caseId/review/documents/:documentId/annotations/add', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)

    const { type } = req.body
    const timestampSeconds = req.body.timestampSeconds !== undefined && req.body.timestampSeconds !== ''
      ? parseFloat(req.body.timestampSeconds)
      : null
    const selectedText = timestampSeconds !== null ? formatTimestamp(timestampSeconds) : req.body.selectedText
    const paragraphIndex = parseInt(req.body.paragraphIndex) || 0
    const occurrenceIndex = parseInt(req.body.occurrenceIndex) || 0

    const reasoningByElementId = req.body.elements || {}
    const elementIds = Object.keys(reasoningByElementId)
      .filter(id => reasoningByElementId[id])
      .map(id => parseInt(id))

    // Evidence and disclosure are only linked to elements when some are selected —
    // if none exist yet (no offence added) they fall back to a plain note, same
    // as information-request, and can be linked later.
    if ((type === 'evidence' || type === 'disclosure') && selectedText && elementIds.length) {
      const elements = await prisma.element.findMany({
        where: { id: { in: elementIds } }
      })

      const note = elements
        .map(element => `${element.description}: ${reasoningByElementId[element.id]}`)
        .join('; ')

      const annotation = await prisma.caseReviewAnnotation.create({
        data: { caseReviewDocumentId: docReview.id, type, selectedText, paragraphIndex, occurrenceIndex, note, timestampSeconds }
      })

      await prisma.caseReviewAnnotationElement.createMany({
        data: elements.map(element => ({
          annotationId: annotation.id,
          elementId: element.id,
          reasoning: reasoningByElementId[element.id]
        }))
      })
    } else {
      const { note } = req.body
      if (selectedText && type && note) {
        await prisma.caseReviewAnnotation.create({
          data: { caseReviewDocumentId: docReview.id, type, selectedText, paragraphIndex, occurrenceIndex, note, timestampSeconds }
        })
      }
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Edit annotation — POST
  router.post('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    const reasoningByElementId = req.body.elements || {}
    const elementIds = Object.keys(reasoningByElementId)
      .filter(id => reasoningByElementId[id])
      .map(id => parseInt(id))

    if (elementIds.length) {
      const elements = await prisma.element.findMany({
        where: { id: { in: elementIds } }
      })

      const note = elements
        .map(element => `${element.description}: ${reasoningByElementId[element.id]}`)
        .join('; ')

      await prisma.caseReviewAnnotationElement.deleteMany({ where: { annotationId } })
      await prisma.caseReviewAnnotationElement.createMany({
        data: elements.map(element => ({
          annotationId,
          elementId: element.id,
          reasoning: reasoningByElementId[element.id]
        }))
      })

      await prisma.caseReviewAnnotation.update({
        where: { id: annotationId },
        data: { note }
      })
    } else {
      const { note } = req.body
      await prisma.caseReviewAnnotation.update({
        where: { id: annotationId },
        data: { note }
      })
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Remove annotation — confirm GET
  router.get('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    const [_case, document, annotation] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } }),
      prisma.caseReviewAnnotation.findUnique({ where: { id: annotationId } })
    ])

    const from = req.query.from || 'list'

    res.render('cases/review/annotations/remove', { _case, document, annotation, caseId, documentId, from })
  })

  // Remove annotation — POST
  router.post('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    await prisma.caseReviewAnnotationElement.deleteMany({ where: { annotationId } })
    await prisma.caseReviewAnnotation.delete({ where: { id: annotationId } })

    const from = req.body.from
    if (from === 'document') {
      res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
    } else if (from === 'check') {
      res.redirect(`/cases/${caseId}/review/check`)
    } else {
      res.redirect(`/cases/${caseId}/review`)
    }
  })

  // Add redaction
  router.post('/cases/:caseId/review/documents/:documentId/redactions/add', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)

    const { selectedText, paragraphIndex, occurrenceIndex } = req.body
    if (selectedText) {
      await prisma.caseReviewRedaction.create({
        data: {
          caseReviewDocumentId: docReview.id,
          selectedText,
          paragraphIndex: parseInt(paragraphIndex) || 0,
          occurrenceIndex: parseInt(occurrenceIndex) || 0
        }
      })
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Remove redaction
  router.post('/cases/:caseId/review/documents/:documentId/redactions/:redactionId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const redactionId = parseInt(req.params.redactionId)

    await prisma.caseReviewRedaction.delete({ where: { id: redactionId } })

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Add inadmissible
  router.post('/cases/:caseId/review/documents/:documentId/inadmissibles/add', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)

    const { selectedText } = req.body
    if (selectedText) {
      await prisma.caseReviewInadmissible.create({
        data: {
          caseReviewDocumentId: docReview.id,
          selectedText,
          paragraphIndex: parseInt(req.body.paragraphIndex) || 0,
          occurrenceIndex: parseInt(req.body.occurrenceIndex) || 0
        }
      })
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Remove inadmissible
  router.post('/cases/:caseId/review/documents/:documentId/inadmissibles/:inadmissibleId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const inadmissibleId = parseInt(req.params.inadmissibleId)

    await prisma.caseReviewInadmissible.delete({ where: { id: inadmissibleId } })

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Mark document as reviewed
  router.post('/cases/:caseId/review/documents/:documentId/mark-reviewed', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)
    await prisma.caseReviewDocument.update({
      where: { id: docReview.id },
      data: { status: 'reviewed' }
    })

    res.redirect(`/cases/${caseId}/review`)
  })

  // Save document progress (in progress)
  router.post('/cases/:caseId/review/documents/:documentId/save-progress', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)
    await prisma.caseReviewDocument.update({
      where: { id: docReview.id },
      data: { status: 'in_progress' }
    })

    res.redirect(`/cases/${caseId}/review`)
  })

  // Return confirmation — GET
  router.get('/cases/:caseId/review/documents/:documentId/return', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)

    const [_case, document] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } })
    ])

    res.render('cases/review/document-return', { _case, document, caseId, documentId })
  })

  // Return confirmation — POST
  router.post('/cases/:caseId/review/documents/:documentId/return', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    if (req.body.markAsReviewed === 'yes') {
      const review = await findOrCreateReview(caseId, userId)
      const docReview = await findOrCreateDocumentReview(review.id, documentId)
      await prisma.caseReviewDocument.update({
        where: { id: docReview.id },
        data: { status: 'reviewed' }
      })
    }

    res.redirect(`/cases/${caseId}/review`)
  })

  // Check page
  router.get('/cases/:caseId/review/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true }
    })

    const review = await findOrCreateReview(caseId, userId)

    const documents = await prisma.document.findMany({
      where: { caseId },
      orderBy: { id: 'asc' }
    })

    const documentReviews = await prisma.caseReviewDocument.findMany({
      where: { caseReviewId: review.id },
      include: { annotations: { orderBy: { createdAt: 'asc' } } }
    })

    const docReviewMap = {}
    documentReviews.forEach(dr => { docReviewMap[dr.documentId] = dr })

    const needsChargingDecision = _case.defendants.some(d => d.status === statuses.NOT_CHARGED && d.needsReview)

    res.render('cases/review/check', { _case, documents, review, docReviewMap, needsChargingDecision })
  })

  // Summary form — GET
  router.get('/cases/:caseId/review/summary', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    const review = await findOrCreateReview(caseId, userId)

    res.render('cases/review/summary/index', { _case, caseId, summary: review.summary || '' })
  })

  // Summary form — POST
  router.post('/cases/:caseId/review/summary', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    await prisma.caseReview.update({
      where: { id: review.id },
      data: { summary: req.body.summary || '' }
    })

    res.redirect(`/cases/${caseId}/review/summary/check`)
  })

  // Summary — check answers
  router.get('/cases/:caseId/review/summary/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    const review = await findOrCreateReview(caseId, userId)

    res.render('cases/review/summary/check', { _case, caseId, review })
  })

  router.post('/cases/:caseId/review/summary/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    await prisma.caseReview.update({
      where: { id: review.id },
      data: { summaryComplete: req.body.complete === 'yes' }
    })

    res.redirect(`/cases/${caseId}/review`)
  })

  // Action plan — check answers (the information request itself isn't
  // created until the review is submitted, see /review/submit)
  router.get('/cases/:caseId/review/action-plan/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const sessionData = req.session.data.newInformationRequest

    if (!sessionData) {
      return res.redirect(`/cases/${caseId}/information-requests/new?context=review`)
    }

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true },
    })

    const formattedSentDate = new Date(sessionData.sentDate)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const formattedItems = sessionData.items.map((item) => ({
      ...item,
      formattedDueDate: formatSessionDate(item.dueDate),
      defendantNames: formatDefendantNames(item.defendants, _case.defendants),
    }))

    res.render('cases/review/action-plan/check', {
      _case,
      informationRequest: { ...sessionData, formattedSentDate, items: formattedItems },
    })
  })

  router.post('/cases/:caseId/review/action-plan/check', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.newInformationRequest.complete = req.body.complete === 'yes'
    res.redirect(`/cases/${caseId}/review`)
  })

  // First hearing details — start empty, CPS has to find out and enter the real details
  function buildEmptyFirstHearing() {
    return {
      hearingDate: { day: '', month: '', year: '' },
      time: '',
      venue: '',
    }
  }

  function buildDateHintExample() {
    const exampleDate = new Date()
    exampleDate.setMonth(exampleDate.getMonth() + 6)
    return `${exampleDate.getDate()} ${exampleDate.getMonth() + 1} ${exampleDate.getFullYear()}`
  }

  router.get('/cases/:caseId/review/first-hearing', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await prisma.case.findUnique({ where: { id: caseId } })

    if (!req.session.data.reviewFirstHearing) {
      req.session.data.reviewFirstHearing = buildEmptyFirstHearing()
    }
    res.locals.data.reviewFirstHearing = req.session.data.reviewFirstHearing

    res.render('cases/review/first-hearing/index', { _case, dateHintExample: buildDateHintExample() })
  })

  router.post('/cases/:caseId/review/first-hearing', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewFirstHearing = {
      ...req.session.data.reviewFirstHearing,
      hearingDate: req.body.reviewFirstHearing?.hearingDate,
    }
    res.redirect(`/cases/${caseId}/review/first-hearing/time`)
  })

  // First hearing details — time
  router.get('/cases/:caseId/review/first-hearing/time', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    res.render('cases/review/first-hearing/time', { _case })
  })

  router.post('/cases/:caseId/review/first-hearing/time', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewFirstHearing = {
      ...req.session.data.reviewFirstHearing,
      time: req.body.reviewFirstHearing?.time,
    }
    res.redirect(`/cases/${caseId}/review/first-hearing/venue`)
  })

  // First hearing details — venue
  router.get('/cases/:caseId/review/first-hearing/venue', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    res.render('cases/review/first-hearing/venue', { _case })
  })

  router.post('/cases/:caseId/review/first-hearing/venue', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewFirstHearing = {
      ...req.session.data.reviewFirstHearing,
      venue: req.body.reviewFirstHearing?.venue,
    }
    res.redirect(`/cases/${caseId}/review/first-hearing/check`)
  })

  // First hearing details — check answers
  router.get('/cases/:caseId/review/first-hearing/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await prisma.case.findUnique({ where: { id: caseId } })
    res.render('cases/review/first-hearing/check', { _case })
  })

  router.post('/cases/:caseId/review/first-hearing/check', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewFirstHearing.confirmed = req.body.complete === 'yes'
    res.redirect(`/cases/${caseId}/review`)
  })

  // Submit review
  router.post('/cases/:caseId/review/submit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const userId = req.session.data.user.id
    const decision = req.session.data.chargingDecision?.decision
    const defendantIds = req.session.data.chargingDecision?.defendantIds

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true },
    })
    const reviewedDefendantIds = defendantIds?.length
      ? defendantIds.map(id => parseInt(id))
      : _case.defendants.map(d => d.id)

    const status = decisionStatusMap[decision]
    if (status) {
      await prisma.defendant.updateMany({
        where: { id: { in: reviewedDefendantIds } },
        data: { status },
      })
    }

    await prisma.defendant.updateMany({
      where: { id: { in: reviewedDefendantIds } },
      data: { needsReview: false },
    })

    const reviewFirstHearing = req.session.data.reviewFirstHearing
    const hasFirstHearing = (await prisma.hearing.count({
      where: { caseId, type: 'First hearing' },
    })) > 0

    if (!hasFirstHearing && reviewFirstHearing?.confirmed) {
      const { hearingDate, time, venue } = reviewFirstHearing
      const { hour, minute } = parseHearingTime(time)
      const startDate = new Date(hearingDate.year, hearingDate.month - 1, hearingDate.day, hour, minute, 0)

      const hearing = await prisma.hearing.create({
        data: {
          caseId,
          startDate,
          status: hearingStatuses.PREPARATION_NEEDED,
          type: 'First hearing',
          venue,
          defendants: {
            connect: reviewedDefendantIds.map(id => ({ id })),
          },
        },
      })

      const selectedDefendants = _case.defendants
        .filter(d => reviewedDefendantIds.includes(d.id))
        .map(d => ({ firstName: d.firstName, lastName: d.lastName }))

      await prisma.activityLog.create({
        data: {
          userId,
          model: 'Case',
          recordId: caseId,
          action: 'UPDATE',
          title: 'First hearing added',
          meta: {
            hearingEventType: 'added',
            hearingType: 'First hearing',
            hearingDate: hearing.startDate,
            venue,
            defendants: selectedDefendants,
          },
          caseId,
        },
      })
    }

    const newInformationRequest = req.session.data.newInformationRequest
    if (newInformationRequest?.complete) {
      await createInformationRequestFromSession(prisma, caseId, newInformationRequest, userId)
    }

    const review = await prisma.caseReview.findFirst({
      where: { caseId, status: 'in_progress' }
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
    delete req.session.data.reviewFirstHearing
    delete req.session.data.newInformationRequest

    req.flash('success', 'Review submitted')
    res.redirect(referrer || `/cases/${caseId}`)
  })
}
