const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  router.get("/cases/:caseId/dga/new", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { user: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    })

    res.render("cases/dga/new/index", { _case })
  })

  router.post("/cases/:caseId/dga/new", (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/dga/new/check`)
  })

  router.get("/cases/:caseId/dga/new/check", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { user: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    })

    let outcomes = {
      NOT_DISPUTED: "Not disputed",
      DISPUTED_SUCCESSFULLY: "Disputed successfully",
      DISPUTED_UNSUCCESSFULLY: "Disputed unsuccessfully",
    }

    let outcome = outcomes[req.session.data.recordDGA.outcome]

    res.render("cases/dga/new/check", { _case, outcome })
  })

  router.post("/cases/:caseId/dga/new/check", async (req, res) => {
    await prisma.DGA.update({
      where: { caseId: parseInt(req.params.caseId) },
      data: { outcome: req.session.data.recordDGA.outcome }
    })

    // const _case = await prisma.case.findUnique({
    //   where: { id: parseInt(req.params.caseId) },
    //   include: { user: true, lawyers: true, defendants: true, hearing: true, location: true, tasks: true, dga: true },
    // })

    res.redirect(`/cases/${req.params.caseId}`)
  })

}