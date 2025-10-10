const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  router.get("/cases/:caseId/defendants", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: {
        user: true,
        witnesses: true,
        lawyers: true,
        defendants: true,
        hearing: true,
        location: true,
        tasks: true,
        dga: true
      }
    })

    res.render("cases/defendants/index", { _case })
  })

}
