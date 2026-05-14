const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { generateDocumentContent } = require('../helpers/documentContent')
const statuses = require('../data/case-statuses')

const decisionStatusMap = {
  'charge': statuses.POLICE_AUTHORISED_CHARGE_PENDING,
  'do-not-charge': statuses.NO_FURTHER_ACTION,
}

const decisionFlashMap = {
  'charge': 'Case charged',
  'do-not-charge': 'Case marked as do not charge',
}

async function findOrCreateReview(caseId, userId) {
  let review = await prisma.caseReview.findFirst({
    where: { caseId, userId, status: 'in_progress' }
  })
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

function applyRedactions(sections, redactions) {
  if (!redactions.length) return sections
  const sorted = [...redactions].sort((a, b) => b.selectedText.length - a.selectedText.length)
  return sections.map(section => ({
    heading: section.heading,
    paragraphs: section.paragraphs.map(para => {
      let result = para
      sorted.forEach(redaction => {
        const escaped = redaction.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'g')
        result = result.replace(
          regex,
          `<mark class="app-redaction" data-redaction-id="${redaction.id}">${redaction.selectedText}</mark>`
        )
      })
      return result
    })
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
      take: 5,
      orderBy: { id: 'asc' }
    })

    const documentReviews = await prisma.caseReviewDocument.findMany({
      where: { caseReviewId: review.id },
      include: { annotations: { orderBy: { createdAt: 'asc' } } }
    })

    const docReviewMap = {}
    documentReviews.forEach(dr => { docReviewMap[dr.documentId] = dr })

    res.render('cases/review/index', { _case, documents, review, docReviewMap })
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

    const [annotations, redactions] = await Promise.all([
      prisma.caseReviewAnnotation.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.caseReviewRedaction.findMany({
        where: { caseReviewDocumentId: docReview.id },
        orderBy: { createdAt: 'asc' }
      })
    ])

    const rawSections = generateDocumentContent(document)
    const annotatedSections = applyHighlights(rawSections, annotations)
    const sections = applyRedactions(annotatedSections, redactions)

    res.render('cases/review/document', {
      _case,
      document,
      sections,
      annotations,
      redactions,
      caseId,
      documentId,
      docReviewId: docReview.id,
      user: req.session.data.user
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

    const [_case, document, annotation] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } }),
      prisma.caseReviewAnnotation.findUnique({ where: { id: annotationId } })
    ])

    const from = req.query.from || 'list'
    res.render('cases/review/annotation-remove', { _case, document, annotation, caseId, documentId, from })
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

    const { selectedText } = req.body
    if (selectedText) {
      await prisma.caseReviewRedaction.create({
        data: { caseReviewDocumentId: docReview.id, selectedText }
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
      take: 5,
      orderBy: { id: 'asc' }
    })

    const documentReviews = await prisma.caseReviewDocument.findMany({
      where: { caseReviewId: review.id },
      include: { annotations: { orderBy: { createdAt: 'asc' } } }
    })

    const docReviewMap = {}
    documentReviews.forEach(dr => { docReviewMap[dr.documentId] = dr })

    res.render('cases/review/check', { _case, documents, review, docReviewMap })
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

  // Submit review
  router.post('/cases/:caseId/review/submit', async (req, res) => {
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
