const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const taskTypes = require('../data/task-types')
const taskNames = require('../data/task-names')

function resetFilters(req) {
  _.set(req, 'session.data.taskListFilters.taskTypes', null)
  _.set(req, 'session.data.taskListFilters.owner', null)
  _.set(req, 'session.data.taskListFilters.units', null)
  _.set(req, 'session.data.taskListFilters.taskNames', null)
}

module.exports = router => {

  router.get("/tasks", async (req, res) => {
    const currentUser = req.session.data.user

    // Get user's unit IDs for filtering
    const userUnitIds = currentUser?.units?.map(uu => uu.unitId) || []

    // Track if this is the first visit (filters object doesn't exist)
    const isFirstVisit = !req.session.data.taskListFilters

    // Ensure taskListFilters object exists
    if (!req.session.data.taskListFilters) {
      req.session.data.taskListFilters = {}
    }

    // Only set default owner to current user on first visit
    // If filters exist but owner is missing, user cleared it intentionally
    if (isFirstVisit) {
      _.set(req.session.data.taskListFilters, 'owner', [`user-${currentUser.id}`])
    }

    let selectedOwnerFilters = _.get(req.session.data.taskListFilters, 'owner', [])
    let selectedTaskTypeFilters = _.get(req.session.data.taskListFilters, 'taskTypes', [])
    let selectedUnitFilters = _.get(req.session.data.taskListFilters, 'units', [])
    let selectedTaskNameFilters = _.get(req.session.data.taskListFilters, 'taskNames', [])

    let selectedFilters = { categories: [] }

    let selectedOwnerItems = []
    let selectedUnitItems = []
    let selectedTaskTypeItems = []
    let selectedTaskNameItems = []

    // Owner filter display
    if (selectedOwnerFilters?.length) {
      // Parse filters into userIds and teamIds
      const userIds = []
      const teamIds = []

      selectedOwnerFilters.forEach(filter => {
        if (filter.startsWith('user-')) {
          userIds.push(Number(filter.replace('user-', '')))
        } else if (filter.startsWith('team-')) {
          teamIds.push(Number(filter.replace('team-', '')))
        }
      })

      // Fetch users and teams
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

      // Build display items
      selectedOwnerItems = selectedOwnerFilters.map(function(filter) {
        if (filter.startsWith('user-')) {
          const userId = Number(filter.replace('user-', ''))
          const user = fetchedUsers.find(u => u.id === userId)
          let displayText = user ? `${user.firstName} ${user.lastName}` : filter

          if (currentUser && user && user.id === currentUser.id) {
            displayText += " (you)"
          }

          return { text: displayText, href: '/tasks/remove-owner/' + filter }
        } else if (filter.startsWith('team-')) {
          const teamId = Number(filter.replace('team-', ''))
          const team = fetchedTeams.find(t => t.id === teamId)
          const displayText = team ? `${team.name} (${team.unit.name})` : filter

          return { text: displayText, href: '/tasks/remove-owner/' + filter }
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
        return { text: unit ? unit.name : selectedUnit, href: '/tasks/remove-unit/' + selectedUnit }
      })

      selectedFilters.categories.push({ heading: { text: 'Unit' }, items: selectedUnitItems })
    }

    // Task type filter display
    if (selectedTaskTypeFilters?.length) {
      selectedTaskTypeItems = selectedTaskTypeFilters.map(function(label) {
        return { text: label, href: '/tasks/remove-type/' + label }
      })

      selectedFilters.categories.push({
        heading: { text: 'Task type' },
        items: selectedTaskTypeItems
      })
    }

    // Task name filter display
    if (selectedTaskNameFilters?.length) {
      selectedTaskNameItems = selectedTaskNameFilters.map(function(taskName) {
        return { text: taskName, href: '/tasks/remove-task-name/' + encodeURIComponent(taskName) }
      })

      selectedFilters.categories.push({
        heading: { text: 'Task' },
        items: selectedTaskNameItems
      })
    }

    // Build Prisma where clause
    let where = { AND: [] }

    // MANDATORY: Restrict to tasks in user's units only
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

    if (selectedTaskTypeFilters?.length) {
      where.AND.push({ type: { in: selectedTaskTypeFilters } })
    }

    if (selectedUnitFilters?.length) {
      const unitIds = selectedUnitFilters.map(Number)
      where.AND.push({ case: { unitId: { in: unitIds } } })
    }

    if (selectedTaskNameFilters?.length) {
      where.AND.push({ name: { in: selectedTaskNameFilters } })
    }

    if (where.AND.length === 0) {
      where = {}
    }

    let tasks = await prisma.task.findMany({
      where: where,
      orderBy: { dueDate: 'asc' },
      include: {
        case: {
          include: {
            defendants: {
              include: {
                charges: true,
                defenceLawyer: true
              }
            },
            unit: true
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

    // Add CTL information to each task's case
    tasks = tasks.map(task => {
      let allCtlDates = []
      task.case.defendants.forEach(defendant => {
        defendant.charges.forEach(charge => {
          if (charge.custodyTimeLimit) {
            allCtlDates.push(new Date(charge.custodyTimeLimit))
          }
        })
      })

      task.case.hasCTL = allCtlDates.length > 0
      task.case.soonestCTL = allCtlDates.length > 0 ? new Date(Math.min(...allCtlDates)) : null
      task.case.ctlCount = allCtlDates.length

      return task
    })

    let keywords = _.get(req.session.data.taskSearch, 'keywords')

    if(keywords) {
      keywords = keywords.toLowerCase()
      tasks = tasks.filter(task => {
        let taskName = task.name.toLowerCase()
        let caseReference = task.case.reference.toLowerCase()
        let defendantName = (task.case.defendants[0].firstName + ' ' + task.case.defendants[0].lastName).toLowerCase()
        return taskName.indexOf(keywords) > -1 || caseReference.indexOf(keywords) > -1 || defendantName.indexOf(keywords) > -1
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

    // Add users with "user-{id}" prefix
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

    // Add teams with "team-{id}" prefix and unit label
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

    let taskTypeItems = taskTypes.map(taskType => ({
      text: taskType,
      value: taskType
    }))

    let taskNameItems = taskNames.map(taskName => ({
      text: taskName,
      value: taskName
    }))

    // Handle sorting
    const sortBy = _.get(req.session.data, 'taskSort', 'Due date')

    if (sortBy === 'Custody release date') {
      // Sort by soonest CTL first, then tasks without CTL
      tasks.sort((a, b) => {
        if (a.case.hasCTL && !b.case.hasCTL) return -1
        if (!a.case.hasCTL && b.case.hasCTL) return 1
        if (a.case.hasCTL && b.case.hasCTL) {
          return a.case.soonestCTL - b.case.soonestCTL
        }
        return 0
      })
    } else if (sortBy === 'Hearing date') {
      // Sort by hearing date (assuming case has hearing)
      tasks.sort((a, b) => {
        const aDate = a.case.hearing ? new Date(a.case.hearing.date) : new Date(9999, 0, 1)
        const bDate = b.case.hearing ? new Date(b.case.hearing.date) : new Date(9999, 0, 1)
        return aDate - bDate
      })
    }
    // Default is 'Due date' which is already sorted by the orderBy in the query

    let totalTasks = tasks.length
    let pageSize = 25
    let pagination = new Pagination(tasks, req.query.page, pageSize)
    tasks = pagination.getData()

    res.render('tasks/index', {
      tasks,
      pagination,
      totalTasks,
      ownerItems,
      selectedOwnerFilters,
      selectedOwnerItems,
      unitItems,
      selectedUnitFilters,
      selectedUnitItems,
      taskTypeItems,
      selectedTaskTypeFilters,
      selectedTaskTypeItems,
      taskNameItems,
      selectedTaskNameFilters,
      selectedTaskNameItems,
      selectedFilters
    })
  })

  router.get('/tasks/remove-owner/:filter', (req, res) => {
    const currentFilters = _.get(req, 'session.data.taskListFilters.owner', [])
    _.set(req, 'session.data.taskListFilters.owner', _.pull(currentFilters, req.params.filter))
    res.redirect('/tasks')
  })

  router.get('/tasks/remove-type/:type', (req, res) => {
    const currentFilters = _.get(req, 'session.data.taskListFilters.taskTypes', [])
    _.set(req, 'session.data.taskListFilters.taskTypes', _.pull(currentFilters, req.params.type))
    res.redirect('/tasks')
  })

  router.get('/tasks/remove-unit/:unitId', (req, res) => {
    const currentFilters = _.get(req, 'session.data.taskListFilters.units', [])
    _.set(req, 'session.data.taskListFilters.units', _.pull(currentFilters, req.params.unitId))
    res.redirect('/tasks')
  })

  router.get('/tasks/remove-task-name/:taskName', (req, res) => {
    const currentFilters = _.get(req, 'session.data.taskListFilters.taskNames', [])
    const taskName = decodeURIComponent(req.params.taskName)
    _.set(req, 'session.data.taskListFilters.taskNames', _.pull(currentFilters, taskName))
    res.redirect('/tasks')
  })

  router.get('/tasks/clear-filters', (req, res) => {
    resetFilters(req)
    res.redirect('/tasks')
  })

  router.get('/tasks/clear-search', (req, res) => {
    _.set(req, 'session.data.taskSearch.keywords', '')
    res.redirect('/tasks')
  })

}