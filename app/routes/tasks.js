const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')
const taskTypes = require('../data/task-types')

function resetFilters(req) {
  _.set(req, 'session.data.taskListFilters.taskTypes', null)
}

module.exports = router => {

  router.get("/tasks", async (req, res) => {
    let selectedTaskTypeFilters = _.get(req.session.data.taskListFilters, 'taskTypes', [])

    let selectedFilters = { categories: [] }

    // Task type filter display
    if (selectedTaskTypeFilters?.length) {
      selectedFilters.categories.push({
        heading: { text: 'Type' },
        items: selectedTaskTypeFilters.map(function(label) {
          return { text: label, href: '/tasks/remove-type/' + label }
        })
      })
    }

    // Build Prisma where clause
    let where = { AND: [] }

    if (selectedTaskTypeFilters?.length) {
      where.AND.push({ type: { in: selectedTaskTypeFilters } })
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
            defendants: true
          }
        }
      }
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

    let taskTypeItems = taskTypes.map(taskType => ({
      text: taskType,
      value: taskType
    }))

    let totalTasks = tasks.length
    let pageSize = 25
    let pagination = new Pagination(tasks, req.query.page, pageSize)
    tasks = pagination.getData()

    res.render('tasks/index', {
      tasks,
      pagination,
      totalTasks,
      taskTypeItems,
      selectedFilters
    })
  })

  router.get('/tasks/remove-type/:type', (req, res) => {
    const currentFilters = _.get(req, 'session.data.taskListFilters.taskTypes', [])
    _.set(req, 'session.data.taskListFilters.taskTypes', _.pull(currentFilters, req.params.type))
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