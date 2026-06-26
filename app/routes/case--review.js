const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { generateDocumentContent } = require('../helpers/documentContent')
const statuses = require('../data/case-statuses')
const hearingStatuses = require('../data/hearing-statuses')

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

async function findOrCreateReview(caseId, userId) {
  let review = await prisma.caseReview.findFirst({
    where: { caseId, userId, status: 'in_progress' }
  })
  if (!review) {
    review = await prisma.caseReview.findFirst({
      where: { caseId, userId },
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

function applyHighlights(sections, annotations) {
  if (!annotations.length) return sections
  const sorted = [...annotations].sort((a, b) => b.selectedText.length - a.selectedText.length)
  return sections.map(section => ({
    heading: section.heading,
    paragraphs: section.paragraphs.map(para => {
      let result = para
      sorted.forEach(annotation => {
        const escaped = annotation.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'g')
        const cls = `app-annotation app-annotation--${annotation.type}`
        result = result.replace(
          regex,
          `<mark class="${cls}" data-annotation-id="${annotation.id}">${annotation.selectedText}</mark>`
        )
      })
      return result
    })
  }))
}

function applyInadmissibles(sections, inadmissibles) {
  if (!inadmissibles.length) return sections
  const sorted = [...inadmissibles].sort((a, b) => b.selectedText.length - a.selectedText.length)
  return sections.map(section => ({
    heading: section.heading,
    paragraphs: section.paragraphs.map(para => {
      let result = para
      sorted.forEach(item => {
        const escaped = item.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'g')
        result = result.replace(
          regex,
          `<mark class="app-inadmissible" data-inadmissible-id="${item.id}">${item.selectedText}</mark>`
        )
      })
      return result
    })
  }))
}

function applyRedactions(sections, redactions) {
  if (!redactions.length) return sections
  const flatParagraphs = sections.flatMap(s => s.paragraphs)
  redactions.forEach(redaction => {
    const paraIdx = redaction.paragraphIndex
    if (paraIdx < 0 || paraIdx >= flatParagraphs.length) return
    const escaped = redaction.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    const target = redaction.occurrenceIndex
    let count = 0
    flatParagraphs[paraIdx] = flatParagraphs[paraIdx].replace(regex, function(match) {
      if (count++ === target) {
        return `<mark class="app-redaction" data-redaction-id="${redaction.id}">${redaction.selectedText}</mark>`
      }
      return match
    })
  })
  let flatIdx = 0
  return sections.map(section => ({
    heading: section.heading,
    paragraphs: section.paragraphs.map(() => flatParagraphs[flatIdx++])
  }))
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

    const needsChargingDecision = _case.defendants.some(d => d.status === statuses.NOT_CHARGED && d.needsReview)

    res.render('cases/review/index', { _case, documents, review, docReviewMap, needsChargingDecision })
  })

  // Document viewer
  router.get('/cases/:caseId/review/documents/:documentId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const [_case, document] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
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

    const [annotations, redactions, inadmissibles] = await Promise.all([
      prisma.caseReviewAnnotation.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.caseReviewRedaction.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.caseReviewInadmissible.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      })
    ])

    const rawSections = generateDocumentContent(document)
    const annotatedSections = applyHighlights(rawSections, annotations)
    const redactedSections = applyRedactions(annotatedSections, redactions)
    const sections = applyInadmissibles(redactedSections, inadmissibles)

    res.render('cases/review/document', {
      _case,
      document,
      sections,
      annotations,
      redactions,
      inadmissibles,
      caseId,
      documentId,
      docReviewId: docReview.id,
      user: req.session.data.user,
      isReviewMode: true
    })
  })

  // Add annotation
  router.post('/cases/:caseId/review/documents/:documentId/annotations/add', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const review = await findOrCreateReview(caseId, userId)
    const docReview = await findOrCreateDocumentReview(review.id, documentId)

    const { selectedText, type, note } = req.body
    if (selectedText && type && note) {
      await prisma.caseReviewAnnotation.create({
        data: {
          caseReviewDocumentId: docReview.id,
          type,
          selectedText,
          note
        }
      })
    }

    res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
  })

  // Edit annotation — GET
  router.get('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    const [_case, document, annotation] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } }),
      prisma.caseReviewAnnotation.findUnique({ where: { id: annotationId } })
    ])

    res.render('cases/review/annotation-edit', { _case, document, annotation, caseId, documentId })
  })

  // Edit annotation — POST
  router.post('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    const { type, note } = req.body
    await prisma.caseReviewAnnotation.update({
      where: { id: annotationId },
      data: { type, note }
    })

    res.redirect(`/cases/${caseId}/review`)
  })

  // Remove annotation — confirm GET
  router.get('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    await prisma.caseReviewAnnotation.delete({ where: { id: annotationId } })

    const from = req.query.from || 'list'
    if (from === 'document') {
      res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
    } else {
      res.redirect(`/cases/${caseId}/review`)
    }
  })

  // Remove annotation — POST
  router.post('/cases/:caseId/review/documents/:documentId/annotations/:annotationId/remove', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const annotationId = parseInt(req.params.annotationId)

    await prisma.caseReviewAnnotation.delete({ where: { id: annotationId } })

    const from = req.body.from
    if (from === 'document') {
      res.redirect(`/cases/${caseId}/review/documents/${documentId}`)
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
        data: { caseReviewDocumentId: docReview.id, selectedText }
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

    res.render('cases/review/summary', { _case, caseId, summary: review.summary || '' })
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

    res.render('cases/review/first-hearing', { _case, dateHintExample: buildDateHintExample() })
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
    res.render('cases/review/first-hearing-time', { _case })
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
    res.render('cases/review/first-hearing-venue', { _case })
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
    res.render('cases/review/first-hearing-check', { _case })
  })

  router.post('/cases/:caseId/review/first-hearing/check', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewFirstHearing.confirmed = true
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
    delete req.session.data.reviewFirstHearing

    req.flash('success', 'Review submitted')
    res.redirect(referrer || `/cases/${caseId}`)
  })
}
