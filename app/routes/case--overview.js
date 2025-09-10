const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  router.get("/cases/:id", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true, unit: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    })
    res.render("cases/show", { _case })
  })

  router.get("/cases/:id/complexity-calculation", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true, unit: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    })
    res.render("cases/complexity-calculation", { _case })
  })

}