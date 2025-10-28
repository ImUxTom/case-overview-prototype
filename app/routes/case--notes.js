const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const noteTypes = require('../data/note-types')

function resetFilters(req) {
  _.set(req, 'session.data.noteListFilters.noteTypes', null)
}

module.exports = router => {

  router.get("/cases/:caseId/notes", async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    let selectedNoteTypeFilters = _.get(req.session.data.noteListFilters, 'noteTypes', [])

    let selectedFilters = { categories: [] }

    // Note type filter display
    if (selectedNoteTypeFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Type' },
        items: selectedNoteTypeFilters.map(function(label) {
          return { text: label, href: `/cases/${caseId}/notes/remove-type/${label}` }
        })
      })
    }

    // Build Prisma where clause for notes
    let where = { caseId: caseId, AND: [] }

    if (selectedNoteTypeFilters?.length) {
      where.AND.push({ type: { in: selectedNoteTypeFilters } })
    }

    if (where.AND.length === 0) {
      delete where.AND
    }

    // Fetch case
    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        defendants: true,
        witnesses: true
      }
    })

    // Fetch notes with filters
    let notes = await prisma.note.findMany({
      where: where,
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    })

    // Search by note content
    let keywords = _.get(req.session.data.noteSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      notes = notes.filter(note => {
        let noteContent = note.content.toLowerCase()
        return noteContent.indexOf(keywords) > -1
      })
    }

    // Attach notes to _case for template
    _case.notes = notes

    let noteTypeItems = noteTypes.map(noteType => ({
      text: noteType,
      value: noteType
    }))

    res.render("cases/notes/index", {
      _case,
      noteTypeItems,
      selectedFilters
    })
  })

  router.get('/cases/:caseId/notes/remove-type/:type', (req, res) => {
    const currentFilters = _.get(req, 'session.data.noteListFilters.noteTypes', [])
    _.set(req, 'session.data.noteListFilters.noteTypes', _.pull(currentFilters, req.params.type))
    res.redirect(`/cases/${req.params.caseId}/notes`)
  })

  router.get('/cases/:caseId/notes/clear-filters', (req, res) => {
    resetFilters(req)
    res.redirect(`/cases/${req.params.caseId}/notes`)
  })

  router.get('/cases/:caseId/notes/clear-search', (req, res) => {
    _.set(req, 'session.data.noteSearch.keywords', '')
    res.redirect(`/cases/${req.params.caseId}/notes`)
  })

  router.get("/cases/:caseId/notes/new/type", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true }
    })

    const noteTypeItems = noteTypes.map(type => ({ value: type, text: type }))

    res.render("cases/notes/new/type", { _case, noteTypeItems })
  })

  router.post("/cases/:caseId/notes/new/type", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/notes/new`)
  })

  router.get("/cases/:caseId/notes/new", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true }
    })

    const type = req.session.data.addNote?.type || ''

    res.render("cases/notes/new/index", { _case, type })
  })

  router.post("/cases/:caseId/notes/new", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/notes/new/check`)
  })

  router.get("/cases/:caseId/notes/new/check", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true }
    })

    const type = req.session.data.addNote?.type || ''
    const content = req.session.data.addNote?.content || ''

    res.render("cases/notes/new/check", { _case, type, content })
  })

  router.post("/cases/:caseId/notes/new/check", async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const type = req.session.data.addNote?.type || null
    const content = req.session.data.addNote.content
    const userId = req.session.data.user.id

    const note = await prisma.note.create({
      data: {
        type: type && type.trim() !== '' ? type : null,
        content,
        caseId,
        userId
      }
    })

    // Create activity log entry
    const activityMeta = {
      content: content
    }

    if (type && type.trim() !== '') {
      activityMeta.type = type
    }

    await prisma.activityLog.create({
      data: {
        userId,
        model: 'Note',
        recordId: note.id,
        action: 'CREATE',
        title: 'Note added',
        caseId,
        meta: activityMeta
      }
    })

    delete req.session.data.addNote

    req.flash('success', 'Note added')
    res.redirect(`/cases/${caseId}/notes`)
  })

  router.get("/cases/:caseId/notes/:noteId", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true }
    })

    const note = await prisma.note.findUnique({
      where: { id: parseInt(req.params.noteId) },
      include: { user: true }
    })

    res.render("cases/notes/show", {
      _case,
      note
    })
  })

}
