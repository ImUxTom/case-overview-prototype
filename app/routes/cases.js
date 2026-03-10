const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const types = require('../data/types')
const complexities = require('../data/complexities')
const { addTimeLimitDates } = require('../helpers/timeLimit')
const Validator = require('../helpers/validator')
const rules = require('../helpers/rules')
const dgaStatuses = ['Awaiting DGA dispute outcome', 'DGA dispute outcome recorded']

function resetFilters(req) {
  _.set(req, 'session.data.caseListFilters.dga', null)
  _.set(req, 'session.data.caseListFilters.isCTL', null)
  _.set(req, 'session.data.caseListFilters.unit', null)
  _.set(req, 'session.data.caseListFilters.policeUnit', null)
  _.set(req, 'session.data.caseListFilters.complexities', null)
  _.set(req, 'session.data.caseListFilters.types', null)
  _.set(req, 'session.data.caseListFilters.prosecutors', null)
  _.set(req, 'session.data.caseListFilters.paralegalOfficers', null)
}

module.exports = (router) => {
  router.get('/cases/shortcut/unassigned', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[prosecutors][]=Unassigned')
  })

  router.get('/cases/shortcut/dga', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[dga][]=Awaiting DGA dispute outcome')
  })

  router.get('/cases/shortcut/dga-police-unit/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['Awaiting DGA dispute outcome'])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga-police-unit-recorded/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['DGA dispute outcome recorded'])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases', async (req, res) => {
    const currentUser = req.session.data.user

    // Get user's unit IDs for filtering
    const userUnitIds = currentUser?.units?.map((uu) => uu.unitId) || []

    // Track if this is the first visit (filters object doesn't exist)
    const isFirstVisit = !req.session.data.caseListFilters

    // Ensure caseListFilters object exists
    if (!req.session.data.caseListFilters) {
      req.session.data.caseListFilters = {}
    }

    // Only set default prosecutor filter to current user on first visit if they're a prosecutor
    if (isFirstVisit && currentUser.role === 'Prosecutor') {
      _.set(req.session.data.caseListFilters, 'prosecutors', [currentUser.id.toString()])
    }

    // Only set default paralegal officer filter to current user on first visit if they're a paralegal officer
    if (isFirstVisit && currentUser.role === 'Paralegal officer') {
      _.set(req.session.data.caseListFilters, 'paralegalOfficers', [currentUser.id.toString()])
    }

    let selectedDgaFilters = _.get(req.session.data.caseListFilters, 'dga', [])
    let selectedCtlFilters = _.get(req.session.data.caseListFilters, 'isCTL', [])
    let selectedUnitFilters = _.get(req.session.data.caseListFilters, 'unit', [])
    let selectedPoliceUnitFilters = _.get(req.session.data.caseListFilters, 'policeUnit', [])
    let selectedComplexityFilters = _.get(req.session.data.caseListFilters, 'complexities', [])
    let selectedTypeFilters = _.get(req.session.data.caseListFilters, 'types', [])
    let selectedProsecutorFilters = _.get(req.session.data.caseListFilters, 'prosecutors', [])
    let selectedParalegalOfficerFilters = _.get(
      req.session.data.caseListFilters,
      'paralegalOfficers',
      [],
    )

    let selectedFilters = { categories: [] }
    let selectedProsecutorItems = []
    let selectedParalegalOfficerItems = []

    let prosecutorIds

    // Prosecutor filter display
    if (selectedProsecutorFilters?.length) {
      prosecutorIds = selectedProsecutorFilters
        .filter(function (l) {
          return l !== 'Unassigned'
        })
        .map(Number)

      let fetchedProsecutors = []
      if (prosecutorIds.length) {
        fetchedProsecutors = await prisma.user.findMany({
          where: {
            id: { in: prosecutorIds },
            role: 'Prosecutor',
          },
          select: { id: true, firstName: true, lastName: true },
        })
      }

      selectedProsecutorItems = selectedProsecutorFilters.map(function (selectedProsecutor) {
        if (selectedProsecutor === 'Unassigned')
          return { text: 'Unassigned', href: '/cases/remove-prosecutor/' + selectedProsecutor }

        let prosecutor = fetchedProsecutors.find(function (prosecutor) {
          return prosecutor.id === Number(selectedProsecutor)
        })
        let displayText = prosecutor
          ? prosecutor.firstName + ' ' + prosecutor.lastName
          : selectedProsecutor

        if (currentUser && prosecutor && prosecutor.id === currentUser.id) {
          displayText += ' (you)'
        }

        return { text: displayText, href: '/cases/remove-prosecutor/' + selectedProsecutor }
      })

      selectedFilters.categories.push({
        heading: { text: 'Prosecutor' },
        items: selectedProsecutorItems,
      })
    }

    // Paralegal officer filter display
    if (selectedParalegalOfficerFilters?.length) {
      const paralegalOfficerIds = selectedParalegalOfficerFilters
        .filter(function (po) {
          return po !== 'Unassigned'
        })
        .map(Number)

      let fetchedParalegalOfficers = []
      if (paralegalOfficerIds.length) {
        fetchedParalegalOfficers = await prisma.user.findMany({
          where: {
            id: { in: paralegalOfficerIds },
            role: 'Paralegal officer',
          },
          select: { id: true, firstName: true, lastName: true },
        })
      }

      selectedParalegalOfficerItems = selectedParalegalOfficerFilters.map(
        function (selectedParalegalOfficer) {
          if (selectedParalegalOfficer === 'Unassigned')
            return {
              text: 'Unassigned',
              href: '/cases/remove-paralegal-officer/' + selectedParalegalOfficer,
            }

          let paralegalOfficer = fetchedParalegalOfficers.find(function (po) {
            return po.id === Number(selectedParalegalOfficer)
          })
          let displayText = paralegalOfficer
            ? paralegalOfficer.firstName + ' ' + paralegalOfficer.lastName
            : selectedParalegalOfficer

          if (currentUser && paralegalOfficer && paralegalOfficer.id === currentUser.id) {
            displayText += ' (you)'
          }

          return {
            text: displayText,
            href: '/cases/remove-paralegal-officer/' + selectedParalegalOfficer,
          }
        },
      )

      selectedFilters.categories.push({
        heading: { text: 'Paralegal officer' },
        items: selectedParalegalOfficerItems,
      })
    }

    // Priority filter display
    if (selectedDgaFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'DGA' },
        items: selectedDgaFilters.map(function (label) {
          return { text: label, href: '/cases/remove-dga/' + label }
        }),
      })
    }

    // CTL filter display
    if (selectedCtlFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Custody time limit' },
        items: selectedCtlFilters.map(function (label) {
          return { text: label, href: '/cases/remove-ctl/' + label }
        }),
      })
    }

    if (selectedUnitFilters?.length) {
      const unitIds = selectedUnitFilters.map(Number)

      let fetchedUnits = await prisma.unit.findMany({
        where: { id: { in: unitIds } },
      })

      let items = selectedUnitFilters.map(function (selectedUnit) {
        let unit = fetchedUnits.find((u) => u.id === Number(selectedUnit))
        return { text: unit ? unit.name : selectedUnit, href: '/cases/remove-unit/' + selectedUnit }
      })

      selectedFilters.categories.push({ heading: { text: 'Unit' }, items })
    }

    if (selectedPoliceUnitFilters?.length) {
      const policeUnitIds = selectedPoliceUnitFilters.map(Number)

      let fetchedPoliceUnits = await prisma.policeUnit.findMany({
        where: { id: { in: policeUnitIds } },
      })

      let items = selectedPoliceUnitFilters.map(function (selectedPoliceUnit) {
        let policeUnit = fetchedPoliceUnits.find((pu) => pu.id === Number(selectedPoliceUnit))
        return {
          text: policeUnit ? policeUnit.name : selectedPoliceUnit,
          href: '/cases/remove-police-unit/' + selectedPoliceUnit,
        }
      })

      selectedFilters.categories.push({ heading: { text: 'Police unit' }, items })
    }

    // Type filter display
    if (selectedComplexityFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Complexity' },
        items: selectedComplexityFilters.map(function (label) {
          return { text: label, href: '/cases/remove-complexity/' + label }
        }),
      })
    }

    // Type filter display
    if (selectedTypeFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Hearing type' },
        items: selectedTypeFilters.map(function (label) {
          return { text: label, href: '/cases/remove-type/' + label }
        }),
      })
    }

    // Build Prisma where clause
    let where = { AND: [] }

    // MANDATORY: Restrict to cases in user's units only
    // If specific units are selected, use those (they're already a subset of user's units)
    // Otherwise, use all of the user's units
    if (selectedUnitFilters?.length) {
      const unitIds = selectedUnitFilters.map(Number)
      where.AND.push({ unitId: { in: unitIds } })
    } else if (userUnitIds.length) {
      where.AND.push({ unitId: { in: userUnitIds } })
    }

    if (selectedPoliceUnitFilters?.length) {
      const policeUnitIds = selectedPoliceUnitFilters.map(Number)
      where.AND.push({ policeUnitId: { in: policeUnitIds } })
    }

    if (selectedDgaFilters?.length) {
      const reviewFilters = []

      if (selectedDgaFilters.includes('Awaiting DGA dispute outcome')) {
        reviewFilters.push({ dga: { failureReasons: { some: { disputed: null } } } })
      }

      if (selectedDgaFilters.includes('DGA dispute outcome recorded')) {
        reviewFilters.push({ NOT: { dga: { failureReasons: { some: { disputed: null } } } } })
      }

      if (reviewFilters.length) {
        where.AND.push({ OR: reviewFilters })
      }
    }

    if (selectedCtlFilters?.length) {
      const ctlFilters = []

      if (selectedCtlFilters.includes('Has custody time limit')) {
        ctlFilters.push({
          defendants: {
            some: {
              charges: {
                some: {
                  custodyTimeLimit: { not: null },
                },
              },
            },
          },
        })
      }

      if (selectedCtlFilters.includes('Does not have custody time limit')) {
        ctlFilters.push({
          defendants: {
            every: {
              charges: {
                every: {
                  custodyTimeLimit: null,
                },
              },
            },
          },
        })
      }

      if (ctlFilters.length) {
        where.AND.push({ OR: ctlFilters })
      }
    }

    if (selectedComplexityFilters?.length) {
      where.AND.push({ complexity: { in: selectedComplexityFilters } })
    }
    if (selectedTypeFilters?.length) {
      where.AND.push({ type: { in: selectedTypeFilters } })
    }

    if (selectedProsecutorFilters?.length) {
      let prosecutorFilters = []

      if (selectedProsecutorFilters?.includes('Unassigned')) {
        prosecutorFilters.push({ prosecutors: { none: {} } })
      }

      if (prosecutorIds?.length) {
        prosecutorFilters.push({ prosecutors: { some: { userId: { in: prosecutorIds } } } })
      }

      if (prosecutorFilters.length) {
        where.AND.push({ OR: prosecutorFilters })
      }
    }

    if (selectedParalegalOfficerFilters?.length) {
      const paralegalOfficerIds = selectedParalegalOfficerFilters
        .filter(function (po) {
          return po !== 'Unassigned'
        })
        .map(Number)
      let paralegalFilters = []

      if (selectedParalegalOfficerFilters?.includes('Unassigned')) {
        paralegalFilters.push({ paralegalOfficers: { none: {} } })
      }

      if (paralegalOfficerIds?.length) {
        paralegalFilters.push({
          paralegalOfficers: { some: { userId: { in: paralegalOfficerIds } } },
        })
      }

      if (paralegalFilters.length) {
        where.AND.push({ OR: paralegalFilters })
      }
    }

    if (where.AND.length === 0) {
      where = {}
    }

    let cases = await prisma.case.findMany({
      where: where,
      include: {
        unit: true,
        prosecutors: {
          include: {
            user: true,
          },
          orderBy: {
            isLead: 'desc',
          },
        },
        paralegalOfficers: {
          include: {
            user: true,
          },
        },
        defendants: {
          include: {
            charges: true,
            defenceLawyer: true,
          },
        },
        hearings: {
          orderBy: {
            startDate: 'asc',
          },
          take: 1,
        },
        location: true,
        tasks: true,
        dga: { include: { failureReasons: true } },
      },
    })

    cases = cases.map((c) => ({
      ...addTimeLimitDates(c),
      needsDgaOutcome: c.dga?.failureReasons?.some((fr) => fr.disputed === null) ?? false,
    }))

    // Sort: CTL cases first (by soonest date), then non-CTL cases
    cases.sort((a, b) => {
      if (a.custodyTimeLimit && !b.custodyTimeLimit) return -1
      if (!a.custodyTimeLimit && b.custodyTimeLimit) return 1
      if (a.custodyTimeLimit && b.custodyTimeLimit) {
        return a.custodyTimeLimit - b.custodyTimeLimit
      }
      return 0
    })

    let keywords = _.get(req.session.data.caseSearch, 'keywords')

    if (keywords) {
      keywords = keywords.toLowerCase()
      cases = cases.filter((_case) => {
        let reference = _case.reference.toLowerCase()
        let defendantName = (
          _case.defendants[0].firstName +
          ' ' +
          _case.defendants[0].lastName
        ).toLowerCase()
        return reference.indexOf(keywords) > -1 || defendantName.indexOf(keywords) > -1
      })
    }

    let dgaItems = dgaStatuses.map((dgaStatus) => ({
      text: dgaStatus,
      value: dgaStatus,
    }))

    let ctlItems = ['Has custody time limit', 'Does not have custody time limit'].map((ctl) => ({
      text: ctl,
      value: ctl,
    }))

    let complexityItems = complexities.map((complexity) => ({
      text: complexity,
      value: complexity,
    }))

    let typeItems = types.map((type) => ({
      text: type,
      value: type,
    }))

    // Fetch only user's units for the filter
    let units = await prisma.unit.findMany({
      where: { id: { in: userUnitIds } },
    })

    let unitItems = units.map((unit) => ({
      text: `${unit.name}`,
      value: `${unit.id}`,
    }))

    let policeUnits = await prisma.policeUnit.findMany({ orderBy: { name: 'asc' } })

    let policeUnitItems = policeUnits.map((pu) => ({
      text: pu.name,
      value: `${pu.id}`,
    }))

    // Fetch only prosecutors from user's units
    let prosecutors = await prisma.user.findMany({
      where: {
        role: 'Prosecutor',
        units: {
          some: {
            unitId: { in: userUnitIds },
          },
        },
      },
    })

    let prosecutorItems = prosecutors.map((prosecutor) => {
      let text = `${prosecutor.firstName} ${prosecutor.lastName}`
      if (currentUser && prosecutor.id === currentUser.id) {
        text += ' (you)'
      }
      return {
        text: text,
        value: `${prosecutor.id}`,
      }
    })

    // Sort to put current user first
    prosecutorItems.sort((a, b) => {
      if (a.text.includes('(you)')) return -1
      if (b.text.includes('(you)')) return 1
      return 0
    })

    // Add Unassigned at the beginning
    prosecutorItems.unshift({ text: 'Unassigned', value: 'Unassigned' })

    // Fetch only paralegal officers from user's units
    let paralegalOfficers = await prisma.user.findMany({
      where: {
        role: 'Paralegal officer',
        units: {
          some: {
            unitId: { in: userUnitIds },
          },
        },
      },
    })

    let paralegalOfficerItems = paralegalOfficers.map((po) => {
      let text = `${po.firstName} ${po.lastName}`
      if (currentUser && po.id === currentUser.id) {
        text += ' (you)'
      }
      return {
        text: text,
        value: `${po.id}`,
      }
    })

    // Sort to put current user first
    paralegalOfficerItems.sort((a, b) => {
      if (a.text.includes('(you)')) return -1
      if (b.text.includes('(you)')) return 1
      return 0
    })

    // Add Unassigned at the beginning
    paralegalOfficerItems.unshift({ text: 'Unassigned', value: 'Unassigned' })

    const currentFilterKey = JSON.stringify(req.session.data.caseListFilters || {}) + (_.get(req.session.data.caseSearch, 'keywords') || '')
    if (currentFilterKey !== req.session.data.caseListFilterKey) {
      req.session.data.applyAction = {}
      req.session.data.caseListFilterKey = currentFilterKey
    }

    let totalCases = cases.length
    req.session.data.caseListAllIds = cases.map(c => c.id.toString())
    let pageSize = 25
    let pagination = new Pagination(cases, req.query.page, pageSize)
    cases = pagination.getData()
    req.session.data.caseListPageIds = cases.map(c => c.id.toString())

    const showMarkAsNotDisputed = cases.some((c) =>
      c.dga?.failureReasons?.some((fr) => fr.disputed === null),
    )

    res.render('cases/index', {
      totalCases,
      cases,
      dgaItems,
      ctlItems,
      unitItems,
      policeUnitItems,
      complexityItems,
      typeItems,
      prosecutorItems,
      selectedProsecutorFilters,
      selectedProsecutorItems,
      paralegalOfficerItems,
      selectedParalegalOfficerFilters,
      selectedParalegalOfficerItems,
      selectedFilters,
      pagination,
      showMarkAsNotDisputed,
    })
  })

  router.get('/cases/remove-dga/:dga', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.dga', [])
    _.set(req, 'session.data.caseListFilters.dga', _.pull(currentFilters, req.params.dga))
    res.redirect('/cases')
  })

  router.get('/cases/remove-ctl/:ctl', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.isCTL', [])
    _.set(req, 'session.data.caseListFilters.isCTL', _.pull(currentFilters, req.params.ctl))
    res.redirect('/cases')
  })

  router.get('/cases/remove-unit/:unit', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.unit', [])
    _.set(req, 'session.data.caseListFilters.unit', _.pull(currentFilters, req.params.unit))
    res.redirect('/cases')
  })

  router.get('/cases/remove-police-unit/:policeUnit', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.policeUnit', [])
    _.set(
      req,
      'session.data.caseListFilters.policeUnit',
      _.pull(currentFilters, req.params.policeUnit),
    )
    res.redirect('/cases')
  })

  router.get('/cases/remove-complexity/:complexity', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.complexities', [])
    _.set(
      req,
      'session.data.caseListFilters.complexities',
      _.pull(currentFilters, req.params.complexity),
    )
    res.redirect('/cases')
  })

  router.get('/cases/remove-type/:type', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.types', [])
    _.set(req, 'session.data.caseListFilters.types', _.pull(currentFilters, req.params.type))
    res.redirect('/cases')
  })

  router.get('/cases/remove-prosecutor/:prosecutor', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.prosecutors', [])
    _.set(
      req,
      'session.data.caseListFilters.prosecutors',
      _.pull(currentFilters, req.params.prosecutor),
    )
    res.redirect('/cases')
  })

  router.get('/cases/remove-paralegal-officer/:paralegalOfficer', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.paralegalOfficers', [])
    _.set(
      req,
      'session.data.caseListFilters.paralegalOfficers',
      _.pull(currentFilters, req.params.paralegalOfficer),
    )
    res.redirect('/cases')
  })

  router.get('/cases/clear-filters', (req, res) => {
    resetFilters(req)
    res.redirect('/cases')
  })

  router.get('/cases/clear-search', (req, res) => {
    _.set(req, 'session.data.caseSearch.keywords', '')
    res.redirect('/cases')
  })

  router.get('/cases/select-all', (req, res) => {
    req.session.data.applyAction = { cases: req.session.data.caseListAllIds || [] }
    res.redirect('/cases?page=' + (req.query.page || 1))
  })

  router.get('/cases/deselect-all', (req, res) => {
    req.session.data.applyAction = {}
    res.redirect('/cases?page=' + (req.query.page || 1))
  })

  router.post('/cases', async (req, res) => {
    const action = req.body.action

    const errorMessages = {
      'record-dga-dispute-outcomes-as-not-disputed': 'Select a case to record DGA dispute outcomes as not disputed',
      'add-prosecutor': 'Select a case to add a prosecutor to',
    }

    let selectedCases = req.body.applyAction?.cases || []
    if (!Array.isArray(selectedCases)) selectedCases = [selectedCases]
    selectedCases = selectedCases.filter((v) => v !== '_unchecked')

    const validator = new Validator(req, res)

    validator.add({
      name: 'applyAction.cases',
      rules: [{ fn: rules.checkboxSelected, message: errorMessages[action] || 'Select a case' }]
    })

    if (action === 'record-dga-dispute-outcomes-as-not-disputed') {
      let hasUnresolved = true
      if (selectedCases.length) {
        const cases = await prisma.case.findMany({
          where: { id: { in: selectedCases.map(Number) } },
          include: { dga: { include: { failureReasons: true } } }
        })
        hasUnresolved = cases.some(c => c.dga?.failureReasons?.some(fr => fr.disputed === null))
      }

      validator.add({
        name: 'applyAction.cases',
        rules: [{
          fn: (value, params) => params.hasUnresolved,
          params: { hasUnresolved },
          message: 'Selected cases must have a DGA dispute outcome that needs recording'
        }]
      })
    }

    if (!validator.validate()) {
      req.flash('error', {
        errorSummary: validator.getErrorSummary(),
        inlineErrors: validator.getInlineErrors(),
      })
      return res.redirect('/cases')
    }

    if (action === 'record-dga-dispute-outcomes-as-not-disputed') {
      req.session.data.applyAction = { cases: selectedCases }
      return res.redirect('/cases/record-dga-dispute-outcomes-as-not-disputed')
    }

    res.redirect('/cases')
  })
}
