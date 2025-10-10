const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  router.get("/cases/:caseId/tasks", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        tasks: { orderBy: { dueDate: 'asc' } },
        user: true,
        unit: true,
        lawyers: true,
        defendants: true,
        hearing: true,
        location: true,
        dga: true
      },
    })

    res.render("cases/tasks/index", { _case })
  })

}