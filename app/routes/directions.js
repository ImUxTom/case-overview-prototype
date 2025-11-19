const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const { groupDirections } = require('../helpers/directionGrouping')

function resetFilters(req) {
  _.set(req, 'session.data.directionListFilters.owner', null)
  _.set(req, 'session.data.directionListFilters.units', null)
  _.set(req, 'session.data.directionListFilters.dateStatus', null)
}

module.exports = router => {

  router.get('/directions/shortcut/overdue', (req, res) => {
    const currentUser = req.session.data.user
    resetFilters(req)
    res.redirect(`/directions?directionListFilters[owner][]=user-${currentUser.id}&directionListFilters[dateStatus][]=Overdue`)
  })

  router.get('/directions/shortcut/due-today', (req, res) => {
    const currentUser = req.session.data.user
    resetFilters(req)
    res.redirect(`/directions?directionListFilters[owner][]=user-${currentUser.id}&directionListFilters[dateStatus][]=Due today`)
  })

  router.get('/directions/shortcut/due-tomorrow', (req, res) => {
    const currentUser = req.session.data.user
    resetFilters(req)
    res.redirect(`/directions?directionListFilters[owner][]=user-${currentUser.id}&directionListFilters[dateStatus][]=Due tomorrow`)
  })

  router.get("/directions", async (req, res) => {
    const currentUser = req.session.data.user

    // Get user's unit IDs for filtering
    const userUnitIds = currentUser?.units?.map(uu => uu.unitId) || []

    // Track if this is the first visit (filters object doesn't exist)
    const isFirstVisit = !req.session.data.directionListFilters

    // Ensure directionListFilters object exists
    if (!req.session.data.directionListFilters) {
      req.session.data.directionListFilters = {}
    }

    // Only set default owner to current user on first visit
    if (isFirstVisit) {
      _.set(req.session.data.directionListFilters, 'owner', [`user-${currentUser.id}`])
    }

    let selectedOwnerFilters = _.get(req.session.data.directionListFilters, 'owner', [])
    let selectedUnitFilters = _.get(req.session.data.directionListFilters, 'units', [])
    let selectedDateStatusFilters = _.get(req.session.data.directionListFilters, 'dateStatus', [])

    let selectedFilters = { categories: [] }

    let selectedOwnerItems = []
    let selectedUnitItems = []
    let selectedDateStatusItems = []

    // Owner filter display
    if (selectedOwnerFilters?.length) {
      const userIds = []
      const teamIds = []

      selectedOwnerFilters.forEach(filter => {
        if (filter.startsWith('user-')) {
          userIds.push(Number(filter.replace('user-', '')))
        } else if (filter.startsWith('team-')) {
          teamIds.push(Number(filter.replace('team-', '')))
        }
      })

      let fetchedUsers = []
      let fetchedTeams = []

      if (userIds.length) {
        fetchedUsers = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true }
        })
      }

      if (teamIds.length) {
        fetchedTeams = await prisma.team.findMany({
          where: { id: { in: teamIds } },
          include: { unit: true }
        })
      }

      selectedOwnerItems = selectedOwnerFilters.map(function(filter) {
        if (filter.startsWith('user-')) {
          const userId = Number(filter.replace('user-', ''))
          const user = fetchedUsers.find(u => u.id === userId)
          let displayText = user ? `${user.firstName} ${user.lastName}` : filter

          if (currentUser && user && user.id === currentUser.id) {
            displayText += " (you)"
          }

          return { text: displayText, href: '/directions/remove-owner/' + filter }
        } else if (filter.startsWith('team-')) {
          const teamId = Number(filter.replace('team-', ''))
          const team = fetchedTeams.find(t => t.id === teamId)
          const displayText = team ? `${team.name} (${team.unit.name})` : filter

          return { text: displayText, href: '/directions/remove-owner/' + filter }
        }
      })

      selectedFilters.categories.push({ heading: { text: 'Owner' }, items: selectedOwnerItems })
    }

    // Unit filter display
    if (selectedUnitFilters?.length) {
      const unitIds = selectedUnitFilters.map(Number)

      let fetchedUnits = await prisma.unit.findMany({
        where: { id: { in: unitIds } }
      })

      selectedUnitItems = selectedUnitFilters.map(function(selectedUnit) {
        let unit = fetchedUnits.find(function(u) { return u.id === Number(selectedUnit) })
        return { text: unit ? unit.name : selectedUnit, href: '/directions/remove-unit/' + selectedUnit }
      })

      selectedFilters.categories.push({ heading: { text: 'Unit' }, items: selectedUnitItems })
    }

    // Date status filter display
    if (selectedDateStatusFilters?.length) {
      selectedDateStatusItems = selectedDateStatusFilters.map(function(dateStatus) {
        return { text: dateStatus, href: '/directions/remove-date-status/' + encodeURIComponent(dateStatus) }
      })

      selectedFilters.categories.push({
        heading: { text: 'Due' },
        items: selectedDateStatusItems
      })
    }

    // Build Prisma where clause
    let where = { AND: [] }

    // MANDATORY: Exclude completed directions
    where.AND.push({ completedDate: null })

    // MANDATORY: Restrict to directions in user's units only
    if (userUnitIds.length) {
      where.AND.push({ case: { unitId: { in: userUnitIds } } })
    }

    // Owner filter (users and teams)
    if (selectedOwnerFilters?.length) {
      const userIds = []
      const teamIds = []

      selectedOwnerFilters.forEach(filter => {
        if (filter.startsWith('user-')) {
          userIds.push(Number(filter.replace('user-', '')))
        } else if (filter.startsWith('team-')) {
          teamIds.push(Number(filter.replace('team-', '')))
        }
      })

      const ownerConditions = []
      if (userIds.length) {
        ownerConditions.push({ assignedToUserId: { in: userIds } })
      }
      if (teamIds.length) {
        ownerConditions.push({ assignedToTeamId: { in: teamIds } })
      }

      if (ownerConditions.length) {
        where.AND.push({ OR: ownerConditions })
      }
    }

    if (selectedUnitFilters?.length) {
      const unitIds = selectedUnitFilters.map(Number)
      where.AND.push({ case: { unitId: { in: unitIds } } })
    }

    if (where.AND.length === 0) {
      where = {}
    }

    let directions = await prisma.direction.findMany({
      where: where,
      orderBy: [
        { dueDate: 'asc' }
      ],
      include: {
        case: {
          include: {
            defendants: {
              include: {
                charges: true,
                defenceLawyer: true
              }
            },
            unit: true,
            hearings: {
              orderBy: {
                startDate: 'asc'
              },
              take: 1
            }
          }
        },
        assignedToUser: true,
        assignedToTeam: {
          include: {
            unit: true
          }
        }
      }
    })

    // Add CTL information to each direction's case
    directions = directions.map(direction => {
      let allCtlDates = []
      direction.case.defendants.forEach(defendant => {
        defendant.charges.forEach(charge => {
          if (charge.custodyTimeLimit) {
            allCtlDates.push(new Date(charge.custodyTimeLimit))
          }
        })
      })

      direction.case.hasCTL = allCtlDates.length > 0
      direction.case.soonestCTL = allCtlDates.length > 0 ? new Date(Math.min(...allCtlDates)) : null
      direction.case.ctlCount = allCtlDates.length

      return direction
    })

    let keywords = _.get(req.session.data.directionSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      directions = directions.filter(direction => {
        let description = direction.description.toLowerCase()
        let caseReference = direction.case.reference.toLowerCase()
        let defendantName = (direction.case.defendants[0].firstName + ' ' + direction.case.defendants[0].lastName).toLowerCase()
        return description.indexOf(keywords) > -1 || caseReference.indexOf(keywords) > -1 || defendantName.indexOf(keywords) > -1
      })
    }

    // Fetch users and teams from user's units for the owner filter
    let users = await prisma.user.findMany({
      where: {
        units: {
          some: {
            unitId: { in: userUnitIds }
          }
        }
      }
    })

    let teams = await prisma.team.findMany({
      where: { unitId: { in: userUnitIds } },
      include: { unit: true }
    })

    // Build owner items with prefixed values
    let ownerItems = []

    users.forEach(user => {
      if (currentUser && user.id === currentUser.id) {
        ownerItems.push({
          text: `${user.firstName} ${user.lastName} (you)`,
          value: `user-${user.id}`
        })
      } else {
        ownerItems.push({
          text: `${user.firstName} ${user.lastName}`,
          value: `user-${user.id}`
        })
      }
    })

    teams.forEach(team => {
      ownerItems.push({
        text: `${team.name} (${team.unit.name})`,
        value: `team-${team.id}`
      })
    })

    // Put current user (you) first
    ownerItems.sort((a, b) => {
      if (a.text.includes('(you)')) return -1
      if (b.text.includes('(you)')) return 1
      return 0
    })

    // Fetch only user's units for the filter
    let units = await prisma.unit.findMany({
      where: { id: { in: userUnitIds } }
    })

    let unitItems = units.map(unit => ({
      text: unit.name,
      value: `${unit.id}`
    }))

    // Date status items (based on Due date sort - default)
    let dateStatusItems = [
      { text: 'Overdue', value: 'Overdue' },
      { text: 'Due today', value: 'Due today' },
      { text: 'Due tomorrow', value: 'Due tomorrow' },
      { text: 'Due later', value: 'Due later' }
    ]

    // Handle sorting
    const sortBy = _.get(req.session.data, 'directionSort', 'Due date')

    // Add grouping metadata to directions based on sort type
    directions = groupDirections(directions, sortBy)

    // Filter by date status (after grouping)
    if (selectedDateStatusFilters?.length) {
      directions = directions.filter(direction => {
        return selectedDateStatusFilters.includes(direction.groupHeading)
      })
    }

    // Sort by date group, then by the appropriate date field
    directions.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      // Secondary sort based on sort type
      if (sortBy === 'Custody time limit') {
        const dateA = a.case?.soonestCTL ? new Date(a.case.soonestCTL) : new Date(9999, 11, 31)
        const dateB = b.case?.soonestCTL ? new Date(b.case.soonestCTL) : new Date(9999, 11, 31)
        return dateA - dateB
      } else if (sortBy === 'Hearing date') {
        const dateA = a.case?.hearings?.[0]?.startDate ? new Date(a.case.hearings[0].startDate) : new Date(9999, 11, 31)
        const dateB = b.case?.hearings?.[0]?.startDate ? new Date(b.case.hearings[0].startDate) : new Date(9999, 11, 31)
        return dateA - dateB
      } else {
        return new Date(a.dueDate) - new Date(b.dueDate)
      }
    })

    let totalDirections = directions.length
    let pageSize = 25
    let pagination = new Pagination(directions, req.query.page, pageSize)
    directions = pagination.getData()

    res.render('directions/index', {
      directions,
      pagination,
      totalDirections,
      ownerItems,
      selectedOwnerFilters,
      selectedOwnerItems,
      unitItems,
      selectedUnitFilters,
      selectedUnitItems,
      dateStatusItems,
      selectedDateStatusFilters,
      selectedDateStatusItems,
      selectedFilters
    })
  })

  router.get('/directions/remove-owner/:filter', (req, res) => {
    const currentFilters = _.get(req, 'session.data.directionListFilters.owner', [])
    _.set(req, 'session.data.directionListFilters.owner', _.pull(currentFilters, req.params.filter))
    res.redirect('/directions')
  })

  router.get('/directions/remove-unit/:unitId', (req, res) => {
    const currentFilters = _.get(req, 'session.data.directionListFilters.units', [])
    _.set(req, 'session.data.directionListFilters.units', _.pull(currentFilters, req.params.unitId))
    res.redirect('/directions')
  })

  router.get('/directions/remove-date-status/:dateStatus', (req, res) => {
    const currentFilters = _.get(req, 'session.data.directionListFilters.dateStatus', [])
    const dateStatus = decodeURIComponent(req.params.dateStatus)
    _.set(req, 'session.data.directionListFilters.dateStatus', _.pull(currentFilters, dateStatus))
    res.redirect('/directions')
  })

  router.get('/directions/clear-filters', (req, res) => {
    resetFilters(req)
    res.redirect('/directions')
  })

  router.get('/directions/clear-search', (req, res) => {
    _.set(req, 'session.data.directionSearch.keywords', '')
    res.redirect('/directions')
  })

}
