const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const {
  ITEM_CATEGORIES,
  ordinal,
  buildDefendantItems,
  formatSessionDate,
  cleanDefendantIds,
  formatDefendantNames,
} = require('../helpers/informationRequest')

const ITEM_CATEGORY_RADIO_ITEMS = ITEM_CATEGORIES.map((c) => ({ value: c, text: c }))

async function fetchCase(caseId) {
  return prisma.case.findUnique({
    where: { id: caseId },
    include: { defendants: true },
  })
}

module.exports = (router) => {
  // ─── Step 0 — do you want to request information? ───────────────────────────

  router.get('/cases/:caseId/review/information-request', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await fetchCase(caseId)
    res.render('cases/review/information-request/index', { _case })
  })

  router.post('/cases/:caseId/review/information-request', (req, res) => {
    const caseId = req.params.caseId
    const wantsInformationRequest = req.body.wantsInformationRequest
    req.session.data.reviewInformationRequest = {
      ...req.session.data.reviewInformationRequest,
      wantsInformationRequest,
      items: req.session.data.reviewInformationRequest?.items || [],
    }
    if (wantsInformationRequest === 'yes') {
      res.redirect(`/cases/${caseId}/review/information-request/description`)
    } else {
      res.redirect(`/cases/${caseId}/review/information-request/check`)
    }
  })

  // ─── Step 1 — description ──────────────────────────────────────────────────

  router.get('/cases/:caseId/review/information-request/description', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await fetchCase(caseId)
    res.render('cases/review/information-request/description', { _case })
  })

  router.post('/cases/:caseId/review/information-request/description', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewInformationRequest = {
      ...req.session.data.reviewInformationRequest,
      description: req.body.reviewInformationRequest?.description || '',
      sentDate: new Date().toISOString(),
      items: req.session.data.reviewInformationRequest?.items || [],
    }
    res.redirect(`/cases/${caseId}/review/information-request/item`)
  })

  // ─── Step 2 — add item ──────────────────────────────────────────────────────

  router.get('/cases/:caseId/review/information-request/item', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await fetchCase(caseId)
    const items = req.session.data.reviewInformationRequest?.items || []
    res.render('cases/review/information-request/item', {
      _case,
      itemNumber: ordinal(items.length + 1),
      itemCategoryItems: ITEM_CATEGORY_RADIO_ITEMS,
      defendantItems: buildDefendantItems(_case.defendants),
    })
  })

  router.post('/cases/:caseId/review/information-request/item', (req, res) => {
    const caseId = req.params.caseId
    if (!req.session.data.reviewInformationRequest) req.session.data.reviewInformationRequest = { items: [] }
    req.session.data.reviewInformationRequest.items.push(req.body.reviewInformationRequestItem)
    res.redirect(`/cases/${caseId}/review/information-request/items`)
  })

  // ─── Step 3 — add another / item list ──────────────────────────────────────

  router.get('/cases/:caseId/review/information-request/items', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const _case = await fetchCase(caseId)
    const items = req.session.data.reviewInformationRequest?.items || []

    if (items.length === 0) {
      return res.redirect(`/cases/${caseId}/review/information-request/item`)
    }

    const formattedItems = items.map((item) => ({
      ...item,
      formattedDueDate: formatSessionDate(item.dueDate),
      defendantNames: formatDefendantNames(item.defendants, _case.defendants),
    }))

    res.render('cases/review/information-request/items', { _case, items: formattedItems })
  })

  router.post('/cases/:caseId/review/information-request/items', (req, res) => {
    const caseId = req.params.caseId
    if (req.body.addAnother === 'yes') {
      res.redirect(`/cases/${caseId}/review/information-request/item`)
    } else {
      res.redirect(`/cases/${caseId}/review/information-request/check`)
    }
  })

  // ─── Edit item ──────────────────────────────────────────────────────────────

  router.get('/cases/:caseId/review/information-request/items/:index/edit', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const index = parseInt(req.params.index)
    const _case = await fetchCase(caseId)
    const item = req.session.data.reviewInformationRequest.items[index]
    res.render('cases/review/information-request/item-edit', {
      _case,
      item,
      index,
      itemNumber: ordinal(index + 1),
      itemCategoryItems: ITEM_CATEGORY_RADIO_ITEMS,
      defendantItems: buildDefendantItems(_case.defendants),
      selectedDefendantIds: cleanDefendantIds(item.defendants),
    })
  })

  router.post('/cases/:caseId/review/information-request/items/:index/edit', (req, res) => {
    const caseId = req.params.caseId
    const index = parseInt(req.params.index)
    req.session.data.reviewInformationRequest.items[index] = req.body.reviewInformationRequestItem
    res.redirect(`/cases/${caseId}/review/information-request/items`)
  })

  // ─── Delete item ────────────────────────────────────────────────────────────

  router.get('/cases/:caseId/review/information-request/items/:index/delete', (req, res) => {
    const caseId = req.params.caseId
    const index = parseInt(req.params.index)
    req.session.data.reviewInformationRequest.items.splice(index, 1)
    res.redirect(`/cases/${caseId}/review/information-request/items`)
  })

  // ─── Check answers ──────────────────────────────────────────────────────────
  // The information request itself isn't created until the review is
  // submitted, see /review/submit.

  router.get('/cases/:caseId/review/information-request/check', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const sessionData = req.session.data.reviewInformationRequest

    if (!sessionData) {
      return res.redirect(`/cases/${caseId}/review/information-request`)
    }

    const _case = await fetchCase(caseId)

    const formattedSentDate = new Date(sessionData.sentDate)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const formattedItems = sessionData.items.map((item) => ({
      ...item,
      formattedDueDate: formatSessionDate(item.dueDate),
      defendantNames: formatDefendantNames(item.defendants, _case.defendants),
    }))

    res.render('cases/review/information-request/check', {
      _case,
      informationRequest: { ...sessionData, formattedSentDate, items: formattedItems },
    })
  })

  router.post('/cases/:caseId/review/information-request/check', (req, res) => {
    const caseId = req.params.caseId
    req.session.data.reviewInformationRequest.complete = req.body.complete === 'yes'
    res.redirect(`/cases/${caseId}/review`)
  })
}
