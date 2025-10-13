const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {

  router.get("/cases/:caseId/witnesses/:witnessId", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId) },
      include: { statements: true }
    })

    res.render("cases/witnesses/show", {
      _case,
      witness
    })
  })

  router.get("/cases/:caseId/witnesses/:witnessId/statements", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId) },
      include: { statements: true }
    })

    res.render("cases/witnesses/statements", {
      _case,
      witness
    })
  })

  router.get("/cases/:caseId/witnesses/:witnessId/availability", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId) },
      include: { statements: true }
    })

    res.render("cases/witnesses/availability", {
      _case,
      witness
    })
  })

  router.get("/cases/:caseId/witnesses/:witnessId/special-measures", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId) },
      include: { statements: true }
    })

    res.render("cases/witnesses/special-measures", {
      _case,
      witness
    })
  })

}