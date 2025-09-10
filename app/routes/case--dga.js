const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  router.get("/cases/:id/dga", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    })

    res.render("cases/dga/index", { _case })
  })

}