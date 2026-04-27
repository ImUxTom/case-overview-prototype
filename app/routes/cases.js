const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const types = require('../data/types')
const complexities = require('../data/complexities')
const { addTimeLimitDates } = require('../helpers/timeLimit')
const Validator = require('../helpers/validator')
const rules = require('../helpers/rules')
const statuses = require('../data/case-statuses')
const dgaStatuses = ['Awaiting outcome', 'Outcome recorded']

const caseStatuses = [
  statuses.TRIAGE_NEEDED,
  statuses.POLICE_RESUBMISSION_PENDING,
  statuses.CHARGING_DECISION_NEEDED,
  statuses.POLICE_CHARGING_INFORMATION_PENDING,
  statuses.POLICE_AUTHORISED_CHARGE_PENDING,
  statuses.CHARGED,
  statuses.NOT_GUILTY,
  statuses.NO_FURTHER_ACTION,
  statuses.SENTENCED,
]

function resetFilters(req) {
  _.set(req, 'session.data.caseListFilters.dga', null)
  _.set(req, 'session.data.caseListFilters.dgaMonth', null)
  _.set(req, 'session.data.caseListFilters.isCTL', null)
  _.set(req, 'session.data.caseListFilters.unit', null)
  _.set(req, 'session.data.caseListFilters.policeUnit', null)
  _.set(req, 'session.data.caseListFilters.complexities', null)
  _.set(req, 'session.data.caseListFilters.types', null)
  _.set(req, 'session.data.caseListFilters.prosecutors', null)
  _.set(req, 'session.data.caseListFilters.paralegalOfficers', null)
  _.set(req, 'session.data.caseListFilters.statuses', null)
  _.set(req, 'session.data.caseListFilters.defendants', null)
  _.set(req, 'session.data.caseListFilters.firstHearing', null)
  _.set(req, 'session.data.caseListFilters.hearingStatuses', null)
}

module.exports = (router) => {
  router.get('/cases/shortcut/unassigned', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[prosecutors][]=Unassigned')
  })

  router.get('/cases/shortcut/triage', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[statuses][]=Triage+needed')
  })

  router.get('/cases/shortcut/prosecutor-needed', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[statuses][]=Prosecution+team+needed')
  })

  router.get('/cases/shortcut/charging-decision-needed', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[statuses][]=Charging+decision+needed')
  })

  router.get('/cases/shortcut/charged', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[statuses][]=Charged')
  })

  router.get('/cases/shortcut/first-hearing-needed', (req, res) => {
    resetFilters(req)
    _.set(req.session.data.caseListFilters, 'firstHearing', ['Needs set up'])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/mags-needs-prosecutor', async (req, res) => {
    resetFilters(req)
    const userUnitIds = req.session.data.user?.units?.map(uu => uu.unitId) || []
    const magsUnits = await prisma.unit.findMany({
      where: { name: { contains: 'Magistrates' }, id: { in: userUnitIds } }
    })
    _.set(req.session.data.caseListFilters, 'prosecutors', ['Unassigned'])
    _.set(req.session.data.caseListFilters, 'unit', magsUnits.map(u => u.id.toString()))
    _.set(req.session.data.caseListFilters, 'statuses', [
      statuses.CHARGING_DECISION_NEEDED,
      statuses.POLICE_CHARGING_INFORMATION_PENDING,
      statuses.POLICE_AUTHORISED_CHARGE_PENDING,
      statuses.CHARGED
    ])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/crown-needs-prosecutor', async (req, res) => {
    resetFilters(req)
    const userUnitIds = req.session.data.user?.units?.map(uu => uu.unitId) || []
    const crownUnits = await prisma.unit.findMany({
      where: { name: { contains: 'Crown Court' }, id: { in: userUnitIds } }
    })
    _.set(req.session.data.caseListFilters, 'prosecutors', ['Unassigned'])
    _.set(req.session.data.caseListFilters, 'unit', crownUnits.map(u => u.id.toString()))
    _.set(req.session.data.caseListFilters, 'statuses', [
      statuses.CHARGING_DECISION_NEEDED,
      statuses.POLICE_CHARGING_INFORMATION_PENDING,
      statuses.POLICE_AUTHORISED_CHARGE_PENDING,
      statuses.CHARGED
    ])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/crown-needs-paralegal-officer', async (req, res) => {
    resetFilters(req)
    const userUnitIds = req.session.data.user?.units?.map(uu => uu.unitId) || []
    const crownUnits = await prisma.unit.findMany({
      where: { name: { contains: 'Crown Court' }, id: { in: userUnitIds } }
    })
    _.set(req.session.data.caseListFilters, 'paralegalOfficers', ['Unassigned'])
    _.set(req.session.data.caseListFilters, 'unit', crownUnits.map(u => u.id.toString()))
    _.set(req.session.data.caseListFilters, 'statuses', [
      statuses.CHARGING_DECISION_NEEDED,
      statuses.POLICE_CHARGING_INFORMATION_PENDING,
      statuses.POLICE_AUTHORISED_CHARGE_PENDING,
      statuses.CHARGED
    ])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/hearing-prep-needed', (req, res) => {
    resetFilters(req)
    _.set(req.session.data.caseListFilters, 'hearingStatuses', ['Hearing preparation needed'])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/hearing-outcome-needed', (req, res) => {
    resetFilters(req)
    _.set(req.session.data.caseListFilters, 'hearingStatuses', ['Hearing outcome needed'])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga', (req, res) => {
    resetFilters(req)
    res.redirect('/cases/?caseListFilters[dga][]=Awaiting outcome')
  })

  router.get('/cases/shortcut/dga-police-unit/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['Awaiting outcome'])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga-police-unit/:month/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['Awaiting outcome'])
    _.set(req, 'session.data.caseListFilters.dgaMonth', [req.params.month])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga-police-unit-recorded/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['Outcome recorded'])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga-police-unit-recorded/:month/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dga', ['Outcome recorded'])
    _.set(req, 'session.data.caseListFilters.dgaMonth', [req.params.month])
    _.set(req, 'session.data.caseListFilters.policeUnit', [req.params.policeUnitId])
    res.redirect('/cases')
  })

  router.get('/cases/shortcut/dga-police-unit-all/:month/:policeUnitId', (req, res) => {
    resetFilters(req)
    _.set(req, 'session.data.caseListFilters.dgaMonth', [req.params.month])
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

    let selectedStatusFilters = _.get(req.session.data.caseListFilters, 'statuses', [])
    let selectedDefendantFilters = _.get(req.session.data.caseListFilters, 'defendants', [])
    let selectedFirstHearingFilters = _.get(req.session.data.caseListFilters, 'firstHearing', [])
    let selectedHearingStatusFilters = _.get(req.session.data.caseListFilters, 'hearingStatuses', [])
    let selectedDgaFilters = _.get(req.session.data.caseListFilters, 'dga', [])
    let selectedDgaMonthFilters = _.get(req.session.data.caseListFilters, 'dgaMonth', [])
    let selectedCtlFilters = _.get(req.session.data.caseListFilters, 'isCTL', [])
    let selectedUnitFilters = _.get(req.session.data.caseListFilters, 'unit', [])
    let selectedPoliceUnitFilters = _.get(req.session.data.caseListFilters, 'policeUnit', [])
    let selectedPoliceRequestsFilters = _.get(req.session.data.caseListFilters, 'policeRequests', [])
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
    let selectedPoliceUnitItems = []

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

    // Status filter display
    if (selectedStatusFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Status' },
        items: selectedStatusFilters.map(function (value) {
          return { text: value, href: '/cases/remove-status/' + value }
        }),
      })
    }

    if (selectedFirstHearingFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'First hearing' },
        items: selectedFirstHearingFilters.map((value) => ({
          text: value,
          href: '/cases/remove-first-hearing/' + encodeURIComponent(value),
        })),
      })
    }

    if (selectedHearingStatusFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Hearing status' },
        items: selectedHearingStatusFilters.map((value) => ({
          text: value,
          href: '/cases/remove-hearing-status/' + encodeURIComponent(value),
        })),
      })
    }

    if (selectedDefendantFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Defendants' },
        items: selectedDefendantFilters.map((value) => ({
          text: value,
          href: '/cases/remove-defendants/' + encodeURIComponent(value),
        })),
      })
    }

    // Priority filter display
    if (selectedDgaFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'DGA dispute outcome' },
        items: selectedDgaFilters.map(function (label) {
          return { text: label, href: '/cases/remove-dga/' + label }
        }),
      })
    }

    if (selectedDgaMonthFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'DGA reporting month' },
        items: selectedDgaMonthFilters.map(function (monthKey) {
          const [year, month] = monthKey.split('-').map(Number)
          const label = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
          })
          return { text: label, href: '/cases/remove-dga-month/' + monthKey }
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

    if (selectedPoliceUnitFilters?.length) {
      const policeUnitIds = selectedPoliceUnitFilters.map(Number)

      let fetchedPoliceUnits = await prisma.policeUnit.findMany({
        where: { id: { in: policeUnitIds } },
      })

      selectedPoliceUnitItems = selectedPoliceUnitFilters.map(function (selectedPoliceUnit) {
        let policeUnit = fetchedPoliceUnits.find((pu) => pu.id === Number(selectedPoliceUnit))
        return {
          text: policeUnit ? policeUnit.name : selectedPoliceUnit,
          href: '/cases/remove-police-unit/' + selectedPoliceUnit,
        }
      })

      selectedFilters.categories.push({
        heading: { text: 'Police force' },
        items: selectedPoliceUnitItems,
      })
    }

    if (selectedPoliceRequestsFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Police requests' },
        items: selectedPoliceRequestsFilters.map(function (label) {
          return { text: label, href: '/cases/remove-police-requests/' + encodeURIComponent(label) }
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

      if (selectedDgaFilters.includes('Awaiting outcome')) {
        reviewFilters.push({ dga: { failureReasons: { some: { didPoliceDisputeFailure: null } } } })
      }

      if (selectedDgaFilters.includes('Outcome recorded')) {
        reviewFilters.push({
          AND: [
            { dga: { failureReasons: { some: {} } } },
            { NOT: { dga: { failureReasons: { some: { didPoliceDisputeFailure: null } } } } },
          ],
        })
      }

      if (reviewFilters.length) {
        where.AND.push({ OR: reviewFilters })
      }
    }

    if (selectedDgaMonthFilters?.length) {
      const monthRangeFilters = selectedDgaMonthFilters.map(function (monthKey) {
        const [year, month] = monthKey.split('-').map(Number)
        return {
          dga: {
            reviewDate: {
              gte: new Date(year, month - 1, 1),
              lte: new Date(year, month, 0, 23, 59, 59, 999),
            },
            failureReasons: { some: {} },
          },
        }
      })
      where.AND.push({ OR: monthRangeFilters })
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

    if (selectedPoliceRequestsFilters?.length) {
      const policeRequestsFilters = []

      if (selectedPoliceRequestsFilters.includes('Has pending requests')) {
        policeRequestsFilters.push({
          policeRequests: { some: { items: { some: { receivedDate: null } } } },
        })
      }

      if (selectedPoliceRequestsFilters.includes('No pending requests')) {
        policeRequestsFilters.push({
          NOT: { policeRequests: { some: { items: { some: { receivedDate: null } } } } },
        })
      }

      if (policeRequestsFilters.length) {
        where.AND.push({ OR: policeRequestsFilters })
      }
    }

    // Snapshot where before adding status filter — used to derive available status options
    const whereWithoutStatus = { AND: [...where.AND] }

    if (selectedFirstHearingFilters?.length) {
      const needsSetUp = {
        defendants: {
          some: {
            status: 'Charged',
            hearings: { none: { type: 'First hearing' } },
          },
        },
      }
      const firstHearingFilters = []
      if (selectedFirstHearingFilters.includes('Needs set up')) {
        firstHearingFilters.push(needsSetUp)
      }
      if (selectedFirstHearingFilters.includes('Does not need set up')) {
        firstHearingFilters.push({ NOT: needsSetUp })
      }
      if (firstHearingFilters.length) {
        where.AND.push({ OR: firstHearingFilters })
      }
    }

    if (selectedHearingStatusFilters?.length) {
      where.AND.push({ hearings: { some: { status: { in: selectedHearingStatusFilters } } } })
    }

    if (selectedStatusFilters?.length) {
      where.AND.push({ defendants: { some: { status: { in: selectedStatusFilters } } } })
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
          select: { status: true, startDate: true }
        },
        location: true,
        tasks: true,
        dga: { include: { failureReasons: true } },
        policeRequests: { include: { items: true } },
      },
    })

    const hearingStatusOrder = ['Hearing preparation needed', 'Hearing pending', 'Hearing outcome needed']

    cases = cases.map((c) => {
      const outstandingPoliceRequests = (c.policeRequests || []).filter((r) =>
        r.items.some((item) => item.receivedDate === null),
      )
      const outstandingRequestDeadline =
        outstandingPoliceRequests.length > 0
          ? new Date(Math.min(...outstandingPoliceRequests.map((r) => new Date(r.deadline))))
          : null

      const uniqueActive = [...new Set(c.hearings.map(h => h.status).filter(s => s && s !== 'Hearing complete'))]
      const hearingStatuses = hearingStatusOrder.filter(s => uniqueActive.includes(s))

      const nextHearingDate = c.hearings.length
        ? new Date(Math.min(...c.hearings.map(h => new Date(h.startDate))))
        : null

      return {
        ...addTimeLimitDates(c),
        needsDgaOutcome:
          c.dga?.failureReasons?.some((fr) => fr.didPoliceDisputeFailure === null) ?? false,
        outstandingRequestDeadline,
        hearingStatuses,
        nextHearingDate,
      }
    })

    const getStatusSortIndex = (c) => {
      const defendantStatuses = c.status === 'Mixed' ? c.defendantStatuses : [c.status]
      const indices = defendantStatuses.map(s => {
        const i = caseStatuses.indexOf(s)
        return i === -1 ? caseStatuses.length : i
      })
      return Math.min(...indices)
    }

    const validCaseSorts = ['Status', 'Hearing date', 'Custody time limit', 'Statutory time limit', 'PACE clock']
    const sortBy = validCaseSorts.includes(_.get(req.session.data, 'caseSort'))
      ? req.session.data.caseSort
      : 'Status'
    req.session.data.caseSort = sortBy

    if (sortBy === 'Hearing date') {
      cases.sort((a, b) => {
        if (a.nextHearingDate && !b.nextHearingDate) return -1
        if (!a.nextHearingDate && b.nextHearingDate) return 1
        if (a.nextHearingDate && b.nextHearingDate) return a.nextHearingDate - b.nextHearingDate
        return 0
      })
    } else if (sortBy === 'Custody time limit') {
      cases.sort((a, b) => {
        if (a.custodyTimeLimit && !b.custodyTimeLimit) return -1
        if (!a.custodyTimeLimit && b.custodyTimeLimit) return 1
        if (a.custodyTimeLimit && b.custodyTimeLimit) return a.custodyTimeLimit - b.custodyTimeLimit
        return 0
      })
    } else if (sortBy === 'Statutory time limit') {
      cases.sort((a, b) => {
        if (a.statutoryTimeLimit && !b.statutoryTimeLimit) return -1
        if (!a.statutoryTimeLimit && b.statutoryTimeLimit) return 1
        if (a.statutoryTimeLimit && b.statutoryTimeLimit) return a.statutoryTimeLimit - b.statutoryTimeLimit
        return 0
      })
    } else if (sortBy === 'PACE clock') {
      cases.sort((a, b) => {
        if (a.paceClock && !b.paceClock) return -1
        if (!a.paceClock && b.paceClock) return 1
        if (a.paceClock && b.paceClock) return a.paceClock - b.paceClock
        return 0
      })
    } else {
      cases.sort((a, b) => {
        const statusDiff = getStatusSortIndex(a) - getStatusSortIndex(b)
        if (statusDiff !== 0) return statusDiff
        if (a.custodyTimeLimit && !b.custodyTimeLimit) return -1
        if (!a.custodyTimeLimit && b.custodyTimeLimit) return 1
        if (a.custodyTimeLimit && b.custodyTimeLimit) return a.custodyTimeLimit - b.custodyTimeLimit
        return 0
      })
    }

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
        let operationName = (_case.operationName || '').toLowerCase()
        return (
          reference.indexOf(keywords) > -1 ||
          defendantName.indexOf(keywords) > -1 ||
          operationName.indexOf(keywords) > -1
        )
      })
    }

    if (selectedDefendantFilters?.length) {
      cases = cases.filter((_case) => {
        if (selectedDefendantFilters.includes('Multiple defendants') && _case.defendants.length > 1) return true
        if (selectedDefendantFilters.includes('Mixed') && _case.status === 'Mixed') return true
        if (selectedDefendantFilters.includes('Not mixed') && _case.status !== 'Mixed') return true
        return false
      })
    }

    let dgaItems = dgaStatuses.map((dgaStatus) => ({
      text: dgaStatus,
      value: dgaStatus,
    }))

    const dgaMonthCases = await prisma.dGA.findMany({
      where: {
        reviewDate: { not: null },
        case: { unitId: { in: userUnitIds } },
      },
      select: { reviewDate: true },
    })

    const uniqueMonthKeys = [
      ...new Set(
        dgaMonthCases.map((d) => {
          const date = new Date(d.reviewDate)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        }),
      ),
    ]
      .sort()
      .reverse()

    const dgaMonthItems = uniqueMonthKeys.map((key) => {
      const [year, month] = key.split('-').map(Number)
      return {
        text: new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        }),
        value: key,
      }
    })

    const whereForStatusLookup = whereWithoutStatus.AND.length ? whereWithoutStatus : {}
    const distinctStatusRows = await prisma.defendant.findMany({
      where: { cases: { some: whereForStatusLookup } },
      select: { status: true },
      distinct: ['status'],
    })
    const distinctStatuses = new Set(distinctStatusRows.map(d => d.status).filter(Boolean))
    const statusItems = distinctStatuses.size > 1
      ? caseStatuses.filter(s => distinctStatuses.has(s)).map(s => ({ value: s, text: s }))
      : []

    let ctlItems = ['Has custody time limit', 'Does not have custody time limit'].map((ctl) => ({
      text: ctl,
      value: ctl,
    }))

    let policeRequestsItems = [
      'Has pending requests',
      'No pending requests',
    ].map((label) => ({ text: label, value: label }))

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

    const currentFilterKey =
      JSON.stringify(req.session.data.caseListFilters || {}) +
      (_.get(req.session.data.caseSearch, 'keywords') || '')
    if (currentFilterKey !== req.session.data.caseListFilterKey) {
      req.session.data.applyAction = {}
      req.session.data.caseListFilterKey = currentFilterKey
    }

    let totalCases = cases.length
    req.session.data.caseListAllIds = cases.map((c) => c.id.toString())
    let pageSize = 25
    let pagination = new Pagination(cases, req.query.page, pageSize)
    cases = pagination.getData()
    req.session.data.caseListPageIds = cases.map((c) => c.id.toString())

    const showMarkAsNotDisputed = cases.some((c) =>
      c.dga?.failureReasons?.some((fr) => fr.didPoliceDisputeFailure === null),
    )

    const firstHearingItems = ['Needs set up', 'Does not need set up'].map((s) => ({ value: s, text: s }))

    const hearingStatusItems = [
      'Hearing preparation needed',
      'Hearing pending',
      'Hearing outcome needed',
      'Hearing complete',
    ].map((s) => ({ value: s, text: s }))

    const defendantItems = [
      { value: 'Multiple defendants', text: 'Multiple defendants' },
      { value: 'Mixed', text: 'Mixed' },
      { value: 'Not mixed', text: 'Not mixed' },
    ]

    res.render('cases/index', {
      totalCases,
      cases,
      statusItems,
      selectedStatusFilters,
      firstHearingItems,
      selectedFirstHearingFilters,
      hearingStatusItems,
      selectedHearingStatusFilters,
      defendantItems,
      selectedDefendantFilters,
      dgaItems,
      dgaMonthItems,
      selectedDgaMonthFilters,
      ctlItems,
      policeRequestsItems,
      unitItems,
      policeUnitItems,
      selectedPoliceUnitItems,
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

  router.get('/cases/remove-status/:status', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.statuses', [])
    _.set(req, 'session.data.caseListFilters.statuses', _.pull(currentFilters, req.params.status))
    res.redirect('/cases')
  })

  router.get('/cases/remove-first-hearing/:value', (req, res) => {
    const current = _.get(req, 'session.data.caseListFilters.firstHearing', [])
    _.set(req, 'session.data.caseListFilters.firstHearing', _.pull(current, decodeURIComponent(req.params.value)))
    res.redirect('/cases')
  })

  router.get('/cases/remove-hearing-status/:value', (req, res) => {
    const current = _.get(req, 'session.data.caseListFilters.hearingStatuses', [])
    _.set(req, 'session.data.caseListFilters.hearingStatuses', _.pull(current, decodeURIComponent(req.params.value)))
    res.redirect('/cases')
  })

  router.get('/cases/remove-defendants/:value', (req, res) => {
    const current = _.get(req, 'session.data.caseListFilters.defendants', [])
    _.set(req, 'session.data.caseListFilters.defendants', _.pull(current, decodeURIComponent(req.params.value)))
    res.redirect('/cases')
  })

  router.get('/cases/remove-dga/:dga', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.dga', [])
    _.set(req, 'session.data.caseListFilters.dga', _.pull(currentFilters, req.params.dga))
    res.redirect('/cases')
  })

  router.get('/cases/remove-dga-month/:month', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.dgaMonth', [])
    _.set(req, 'session.data.caseListFilters.dgaMonth', _.pull(currentFilters, req.params.month))
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

  router.get('/cases/remove-police-requests/:label', (req, res) => {
    const currentFilters = _.get(req, 'session.data.caseListFilters.policeRequests', [])
    _.set(
      req,
      'session.data.caseListFilters.policeRequests',
      _.pull(currentFilters, decodeURIComponent(req.params.label)),
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
      'record-dga-dispute-outcomes-as-not-disputed':
        'Select a case to record DGA dispute outcomes as not disputed',
      'add-prosecutor': 'Select a case to add a prosecutor to',
    }

    let selectedCases = req.body.applyAction?.cases || []
    if (!Array.isArray(selectedCases)) selectedCases = [selectedCases]
    selectedCases = selectedCases.filter((v) => v !== '_unchecked')

    const validator = new Validator(req, res)

    validator.add({
      name: 'applyAction.cases',
      rules: [{ fn: rules.checkboxSelected, message: errorMessages[action] || 'Select a case' }],
    })

    if (action === 'record-dga-dispute-outcomes-as-not-disputed') {
      let hasUnresolved = true
      if (selectedCases.length) {
        const cases = await prisma.case.findMany({
          where: { id: { in: selectedCases.map(Number) } },
          include: { dga: { include: { failureReasons: true } } },
        })
        hasUnresolved = cases.some((c) =>
          c.dga?.failureReasons?.some((fr) => fr.didPoliceDisputeFailure === null),
        )
      }

      validator.add({
        name: 'applyAction.cases',
        rules: [
          {
            fn: (value, params) => params.hasUnresolved,
            params: { hasUnresolved },
            message: 'Selected cases must have a DGA dispute outcome that needs recording',
          },
        ],
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
