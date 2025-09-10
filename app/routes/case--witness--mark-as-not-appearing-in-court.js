const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {
  
  router.get("/cases/:caseId/witnesses/:witnessId/mark-as-not-appearing-in-court", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { defendants: true, witnesses: true },
    })

    const witness = await prisma.witness.findUnique({
      where: { id: parseInt(req.params.witnessId )}
    })


    res.render("cases/witnesses/mark-as-not-appearing-in-court/index", { 
      _case,
      witness
    })
  })

  router.post("/cases/:caseId/witnesses/:witnessId/mark-as-not-appearing-in-court", async (req, res) => {
    await prisma.witness.update({
      where: { id: parseInt(req.params.witnessId) },
      data: {
        appearingInCourt: false
      }
    })

    req.flash('success', 'Witness marked as not appearing in court')

    res.redirect(`/cases/${req.params.caseId}/witnesses`)

  })

}