const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {

  router.get("/lawyers/:id/specialist-areas/new", async (req, res) => {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    const specialisms = await prisma.specialism.findMany()
    
    
    const specialismItems = specialisms.map(specialism => {
      return {
        text: specialism.name,
        value: specialism.id
      }
    })

    res.render("lawyers/specialist-areas/new/index", { 
      lawyer,
      specialismItems
    })
  })

  router.post("/lawyers/:id/specialist-areas/new", async (req, res) => {
    res.redirect(`/lawyers/${req.params.id}/specialist-areas/new/preferred-areas`)
  })

  router.get("/lawyers/:id/specialist-areas/new/preferred-areas", async (req, res) => {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    const specialisms = await prisma.specialism.findMany()
    
    const specialismItems = specialisms.map(specialism => {
      return {
        text: specialism.name,
        value: specialism.id
      }
    })

    res.render("lawyers/specialist-areas/new/preferred-areas", { 
      lawyer,
      specialismItems
    })
  })

  router.post("/lawyers/:id/specialist-areas/new/preferred-areas", async (req, res) => {
    res.redirect(`/lawyers/${req.params.id}/specialist-areas/new/restricted-areas`)
  })

  router.get("/lawyers/:id/specialist-areas/new/restricted-areas", async (req, res) => {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    const specialisms = await prisma.specialism.findMany()
    
    const specialismItems = specialisms.map(specialism => {
      return {
        text: specialism.name,
        value: specialism.id
      }
    })

    res.render("lawyers/specialist-areas/new/restricted-areas", { 
      lawyer,
      specialismItems
    })
  })

  router.post("/lawyers/:id/specialist-areas/new/restricted-areas", async (req, res) => {
    res.redirect(`/lawyers/${req.params.id}/specialist-areas/new/check`)
  })

  router.get("/lawyers/:id/specialist-areas/new/check", async (req, res) => {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    const specialismIds = req.session.data.addSpecialistArea?.specialisms?.map(Number) || []
    let specialistAreas = await prisma.specialism.findMany({ where: { id: { in: specialismIds } } })

    const preferredIds = req.session.data.addSpecialistArea?.preferredAreas?.map(Number) || []
    let preferredAreas = await prisma.specialism.findMany({ where: { id: { in: preferredIds } } })

    const restrictedIds = req.session.data.addSpecialistArea?.restrictedAreas?.map(Number) || []
    let restrictedAreas = await prisma.specialism.findMany({ where: { id: { in: restrictedIds } } })

    res.render("lawyers/specialist-areas/new/check", { 
      lawyer,
      specialistAreas,
      preferredAreas,
      restrictedAreas
    })
  })

  router.post("/lawyers/:id/specialist-areas/new/check", async (req, res) => {
    const specialismIds = req.session.data.addSpecialistArea?.specialisms?.map(Number) || []
    const preferredIds = req.session.data.addSpecialistArea?.preferredAreas?.map(Number) || []
    const restrictedIds = req.session.data.addSpecialistArea?.restrictedAreas?.map(Number) || []

    await prisma.lawyer.update({
      where: { id: parseInt(req.params.id) },
      data: {
        specialistAreas: {
          set: specialismIds.map(id => ({ id }))
        },
        preferredAreas: {
          set: preferredIds.map(id => ({ id }))
        },
        restrictedAreas: {
          set: restrictedIds.map(id => ({ id }))
        }
      }
    })

    req.flash('success', 'Specialist areas added')

    res.redirect(`/lawyers/${req.params.id}`)
  })

}