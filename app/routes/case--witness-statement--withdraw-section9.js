const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  
  router.get("/cases/:caseId/witnesses/:witnessId/statements/:statementId/withdraw-section9", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId )}
    })

    const witnessStatement = await prisma.witnessStatement.findUnique({
      where: { id: parseInt(req.params.statementId )}
    })

    res.render("cases/witnesses/withdraw-section9/index", { 
      _case,
      witness,
      witnessStatement
    })
  })

  router.post("/cases/:caseId/witnesses/:witnessId/statements/:statementId/withdraw-section9", async (req, res) => {
    await prisma.witnessStatement.update({
      where: { id: parseInt(req.params.statementId) },
      data: {
        serveSection9: false
      }
    })

    req.flash('success', 'Section 9 withdrawn')

    res.redirect(`/cases/${req.params.caseId}/witnesses`)

  })

}