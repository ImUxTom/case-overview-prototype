const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const Pagination = require('../helpers/pagination')

module.exports = router => {

  router.get("/tasks", async (req, res) => {
   
    let tasks = await prisma.task.findMany({
      include: {
        case: {
          include: {
            defendants: true
          }
        }
      },
      orderBy: { dueDate: 'desc' }
    })

    let pageSize = 25
    let pagination = new Pagination(tasks, req.query.page, pageSize)
    tasks = pagination.getData()

    res.render('tasks/index', {
      tasks,
      pagination
    })
  })

}