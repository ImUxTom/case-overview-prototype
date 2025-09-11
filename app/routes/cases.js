const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const types = require('../data/types')
const priorities = require('../data/priorities')
const complexities = require('../data/complexities')
const dgaStatuses = ['Needs review', 'Does not need review']

function resetFilters(req) {
  _.set(req, 'session.data.filters.dga', null)
  _.set(req, 'session.data.filters.priorities', null)
  _.set(req, 'session.data.filters.complexities', null)
  _.set(req, 'session.data.filters.types', null)
  _.set(req, 'session.data.filters.lawyers', null)
}

module.exports = router => {

  router.get('/cases/shortcut/unassigned', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?filters[lawyers][]=Unassigned')
  })

  router.get('/cases/shortcut/dga', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?filters[dga][]=Needs review')
  })

  router.get("/cases", async (req, res) => {
    let selectedDgaFilters = _.get(req.session.data.filters, 'dga', [])
    let selectedPriorityFilters = _.get(req.session.data.filters, 'priorities', [])
    let selectedComplexityFilters = _.get(req.session.data.filters, 'complexities', [])
    let selectedTypeFilters = _.get(req.session.data.filters, 'types', [])
    let selectedLawyerFilters = _.get(req.session.data.filters, 'lawyers', [])

    let selectedFilters = { categories: [] }

    // Priority filter display
    if (selectedDgaFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'DGA' },
        items: selectedDgaFilters.map(function(label) {
          return { text: label, href: '/cases/remove-dga/' + label }
        })
      })
    }

    // Priority filter display
    if (selectedPriorityFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Priority' },
        items: selectedPriorityFilters.map(function(label) {
          return { text: label, href: '/cases/remove-priority/' + label }
        })
      })
    }

    // Type filter display
    if (selectedComplexityFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Complexity' },
        items: selectedComplexityFilters.map(function(label) {
          return { text: label, href: '/cases/remove-complexity/' + label }
        })
      })
    }

    // Type filter display
    if (selectedTypeFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Type' },
        items: selectedTypeFilters.map(function(label) {
          return { text: label, href: '/cases/remove-type/' + label }
        })
      })
    }

    let lawyerIds


    // Lawyer filter display
    if (selectedLawyerFilters?.length) {

      lawyerIds = selectedLawyerFilters.filter(function(l) { return l !== "Unassigned" }).map(Number)

      let fetchedLawyers = []
      if (lawyerIds.length) {
        fetchedLawyers = await prisma.lawyer.findMany({
          where: { id: { in: lawyerIds } },
          select: { id: true, firstName: true, lastName: true }
        })
      }

      let items = selectedLawyerFilters.map(function(selectedLawyer) {
        if (selectedLawyer === "Unassigned") return { text: "Unassigned", href: '/cases/remove-lawyer/' + selectedLawyer }

        let lawyer = fetchedLawyers.find(function(lawyer) { return lawyer.id === Number(selectedLawyer) })
        return { text: lawyer ? lawyer.firstName + " " + lawyer.lastName : selectedLawyer, href: '/cases/remove-lawyer/' + selectedLawyer }
      })

      selectedFilters.categories.push({ heading: { text: 'Lawyer' }, items: items })
    }

    // Build Prisma where clause
    let where = { AND: [] }

    if (selectedDgaFilters?.length) {
      const reviewFilters = []

      if (selectedDgaFilters.includes('Needs review')) {
        reviewFilters.push({ dga: { isNot: null } })
      }

      if (selectedDgaFilters.includes('Does not need review')) {
        reviewFilters.push({ dga: { is: null } })
      }

      if (reviewFilters.length) {
        where.AND.push({ OR: reviewFilters })
      }
    }
  

    if (selectedPriorityFilters?.length) {
      where.AND.push({ priority: { in: selectedPriorityFilters } })
    }
    if (selectedComplexityFilters?.length) {
      where.AND.push({ complexity: { in: selectedComplexityFilters } })
    }
    if (selectedTypeFilters?.length) {
      where.AND.push({ type: { in: selectedTypeFilters } })
    }

    if(selectedLawyerFilters?.length) {
      let lawyerFilters = []

      if (selectedLawyerFilters?.includes("Unassigned")) {
        lawyerFilters.push({ lawyers: { none: {} } })
      }

      if (lawyerIds?.length) {
        lawyerFilters.push({ lawyers: { some: { id: { in: lawyerIds } } } })
      }

      if (lawyerFilters.length) {
        where.AND.push({ OR: lawyerFilters })
      }

    }
    
    if (where.AND.length === 0) {
      where = {}
    }

    let cases = await prisma.case.findMany({
      where: where,
      include: { unit: true, user: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true }
    })

    let keywords = _.get(req.session.data.caseSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      cases = cases.filter(_case => {
        let reference = _case.reference.toLowerCase()
        let defendantName = (_case.defendants[0].firstName + ' ' + _case.defendants[0].lastName).toLowerCase()
        return reference.indexOf(keywords) > -1 || defendantName.indexOf(keywords) > -1
      })
    }

    let dgaItems = dgaStatuses.map(dgaStatus => ({ 
      text: dgaStatus, 
      value: dgaStatus
    }))

    let priorityItems = priorities.map(priority => ({ 
      text: priority, 
      value: priority
    }))

    let complexityItems = complexities.map(complexity => ({ 
      text: complexity, 
      value: complexity
    }))

    let typeItems = types.map(type => ({ 
      text: type, 
      value: type
    }))
    
    let lawyers = await prisma.lawyer.findMany()

    let lawyerItems = [
      { text: 'Unassigned', value: 'Unassigned' },
      ...lawyers.map(lawyer => ({
        text: `${lawyer.firstName} ${lawyer.lastName}`,
        value: `${lawyer.id}`
      }))
    ]

    let totalCases = cases.length
    let pageSize = 25
    let pagination = new Pagination(cases, req.query.page, pageSize)
    cases = pagination.getData()


    res.render('cases/index', {
      totalCases, 
      cases,
      dgaItems,
      priorityItems,
      complexityItems, 
      typeItems, 
      lawyerItems,
      selectedFilters,
      pagination
    })
  })

  router.get('/cases/remove-dga-review/:dgaReviewStatus', (req, res) => {
    _.set(req, 'session.data.filters.dgaReview', _.pull(req.session.data.filters.dgaReview, req.params.dgaReviewStatus))
    res.redirect('/cases')
  })

  router.get('/cases/remove-priority/:priority', (req, res) => {
    _.set(req, 'session.data.filters.priorities', _.pull(req.session.data.filters.priorities, req.params.priority))
    res.redirect('/cases')
  })

  router.get('/cases/remove-complexity/:complexity', (req, res) => {
    _.set(req, 'session.data.filters.complexities', _.pull(req.session.data.filters.complexities, req.params.complexity))
    res.redirect('/cases')
  })

  router.get('/cases/remove-type/:type', (req, res) => {
    _.set(req, 'session.data.filters.types', _.pull(req.session.data.filters.types, req.params.type))
    res.redirect('/cases')
  })

  router.get('/cases/remove-lawyer/:lawyer', (req, res) => {
    _.set(req, 'session.data.filters.lawyers', _.pull(req.session.data.filters.lawyers, req.params.lawyer))
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

}