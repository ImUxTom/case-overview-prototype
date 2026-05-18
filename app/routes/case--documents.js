const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const documentTypes = require('../data/document-types')
const { addTimeLimitDates } = require('../helpers/timeLimit')
const { addCaseStatus } = require('../helpers/caseStatus')
const { generateDocumentContent } = require('../helpers/documentContent')

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
        result = result.replace(regex, `<mark class="${cls}" data-annotation-id="${annotation.id}">${annotation.selectedText}</mark>`)
      })
      return result
    })
  }))
}

function resetFilters(req) {
  _.set(req, 'session.data.documentListFilters.documentTypes', null)
}

module.exports = router => {
  router.get("/cases/:caseId/documents", async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    let selectedDocumentTypeFilters = _.get(req.session.data.documentListFilters, 'documentTypes', [])

    let selectedFilters = { categories: [] }

    // Document type filter display
    if (selectedDocumentTypeFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Type' },
        items: selectedDocumentTypeFilters.map(function(label) {
          return { text: label, href: `/cases/${caseId}/documents/remove-type/${label}` }
        })
      })
    }

    // Build Prisma where clause for documents
    let where = { caseId: caseId, AND: [] }

    if (selectedDocumentTypeFilters?.length) {
      where.AND.push({ type: { in: selectedDocumentTypeFilters } })
    }

    if (where.AND.length === 0) {
      delete where.AND
    }

    // Fetch case
    let _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        witnesses: { include: { statements: true } },
        prosecutors: {
          include: {
            user: true
          }
        },
        paralegalOfficers: {
          include: {
            user: true
          }
        },
        defendants: { include: { charges: true } },
        hearings: true,
        location: true,
        tasks: true,
        dga: true
      }
    })

    addTimeLimitDates(_case)
    addCaseStatus(_case)

    // Fetch documents with filters
    let documents = await prisma.document.findMany({
      where: where
    })

    // Search by document name
    let keywords = _.get(req.session.data.documentSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      documents = documents.filter(document => {
        let documentName = document.name.toLowerCase()
        return documentName.indexOf(keywords) > -1
      })
    }

    let documentTypeItems = documentTypes.map(docType => ({
      text: docType,
      value: docType
    }))

    res.render("cases/documents/index", {
      _case,
      documents,
      documentTypeItems,
      selectedFilters
    })
  })

  router.get('/cases/:caseId/documents/remove-type/:type', (req, res) => {
    _.set(req, 'session.data.documentListFilters.documentTypes', _.pull(req.session.data.documentListFilters.documentTypes, req.params.type))
    res.redirect(`/cases/${req.params.caseId}/documents`)
  })

  router.get('/cases/:caseId/documents/clear-filters', (req, res) => {
    resetFilters(req)
    res.redirect(`/cases/${req.params.caseId}/documents`)
  })

  router.get('/cases/:caseId/documents/clear-search', (req, res) => {
    _.set(req, 'session.data.documentSearch.keywords', '')
    res.redirect(`/cases/${req.params.caseId}/documents`)
  })

  router.get('/cases/:caseId/documents/:documentId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const documentId = parseInt(req.params.documentId)
    const userId = req.session.data.user.id

    const [_case, document] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.document.findUnique({ where: { id: documentId } })
    ])

    const review = await prisma.caseReview.findFirst({
      where: { caseId, userId },
      orderBy: { updatedAt: 'desc' }
    })

    let annotations = []
    if (review) {
      const docReview = await prisma.caseReviewDocument.findFirst({
        where: { caseReviewId: review.id, documentId }
      })
      if (docReview) {
        annotations = await prisma.caseReviewAnnotation.findMany({
          where: { caseReviewDocumentId: docReview.id },
          orderBy: { createdAt: 'asc' }
        })
      }
    }

    const sections = applyHighlights(generateDocumentContent(document), annotations)

    res.render('cases/review/document', {
      _case,
      document,
      sections,
      annotations,
      caseId,
      documentId,
      user: req.session.data.user,
      isReviewMode: false
    })
  })

}