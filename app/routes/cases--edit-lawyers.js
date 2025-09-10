const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getLawyerHintText(lawyer) {
  total = lawyer._count.cases
  let hintParts = []

  if(lawyer.didInitialReview) {
    hintParts.push(
      `<li>Did the initial review</li>`
    )
  }


  if (lawyer.specialistAreas.length) {
    hintParts.push(
      `<li>${lawyer.specialistAreas.map(a => a.name).join(", ")}</li>`
    )
  }

  let caseLoadBreakdown = ''
  if (total === 0) {
    caseLoadBreakdown = "No cases"
  } else {
    caseLoadBreakdown = `${total} case${total > 1 ? "s" : ""}`

    // Collect only levels that have > 0
    let levelBreakdown = []
    if (lawyer.level1Cases.length > 0) {
      levelBreakdown.push(`${lawyer.level1Cases.length} complexity level one`)
    }
    if (lawyer.level2Cases.length > 0) {
      levelBreakdown.push(`${lawyer.level2Cases.length} complexity level two`)
    }
    if (lawyer.level3Cases.length > 0) {
      levelBreakdown.push(`${lawyer.level3Cases.length} complexity level three`)
    }
    if (lawyer.level4Cases.length > 0) {
      levelBreakdown.push(`${lawyer.level4Cases.length} complexity level four`)
    }
    if (lawyer.level5Cases.length > 0) {
      levelBreakdown.push(`${lawyer.level5Cases.length} complexity  level five`)
    }

    if (levelBreakdown.length) {
      caseLoadBreakdown += ` (${levelBreakdown.join(", ")})`
    }
  }

  hintParts.push(`<li>${caseLoadBreakdown}</li>`)

  return `<ul class="govuk-list govuk-list--bullet govuk-hint govuk-!-margin-bottom-0">${hintParts.join("")}</ul>`
}


module.exports = router => {

  router.get("/cases/:id/edit-lawyers", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { unit: true, lawyers: { select: { id: true } } }
    })

    const assignedLawyers = _.get(req.session.data, 'editLawyers.lawyers') || _case.lawyers.map(lawyer => `${lawyer.id}`)

    let lawyers = await prisma.lawyer.findMany({
      where: {
        unit: _case.unit
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        unit: true,
        specialistAreas: true,
        preferredAreas: true,
        restrictedAreas: true,
        _count: {
          select: {
            cases: true
          }
        },
        cases: {
          select: { id: true, priority: true, complexity: true }
        }
      },
      orderBy: {
        cases: {
          _count: "asc"
        }
      }
    })

    lawyers = lawyers.map((lawyer, index) => {
      // const highPriorityCases = lawyer.cases?.filter(c => c.priority === "High priority") || []
      // const mediumPriorityCases = lawyer.cases?.filter(c => c.priority === "Medium priority") || []
      // const lowPriorityCases = lawyer.cases?.filter(c => c.priority === "Low priority") || []

      const level1Cases = lawyer.cases?.filter(c => c.complexity === "Level 1") || []
      const level2Cases = lawyer.cases?.filter(c => c.complexity === "Level 2") || []
      const level3Cases = lawyer.cases?.filter(c => c.complexity === "Level 3") || []
      const level4Cases = lawyer.cases?.filter(c => c.complexity === "Level 4") || []
      const level5Cases = lawyer.cases?.filter(c => c.complexity === "Level 5") || []
      
      let newLawyer = {
        ...lawyer,
        level1Cases,
        level2Cases,
        level3Cases,
        level4Cases,
        level5Cases,
      }


      // hack it so the first one has a note about how they did an initial review
      if(index == 0) {
        newLawyer.didInitialReview = true
      }

      return newLawyer
    })

    let lawyerItems = lawyers.map(lawyer => {
      return {
        text: `${lawyer.firstName} ${lawyer.lastName}`,
        value: `${lawyer.id}`,
        hint: {
          html: getLawyerHintText(lawyer)
        }
      }
    })

    res.render("cases/edit-lawyers/index", { 
      _case, 
      assignedLawyers,
      lawyerItems 
    })
  })

  router.post("/cases/:id/edit-lawyers", async (req, res) => {
    res.redirect(`/cases/${req.params.id}/edit-lawyers/check`)
  })

  router.get("/cases/:id/edit-lawyers/check", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.id) },
    })

    const lawyerIds = req.session.data.editLawyers?.lawyers?.map(Number) || []// make sure they’re numbers

    // get the to be selected lawyers
    let lawyers = await prisma.lawyer.findMany({
      where: { id: { in: lawyerIds } },
      include: { 
        cases: { select: { id: true, priority: true, complexity: true } },
        _count: { select: { cases: true } },
      },
    })

    res.render("cases/edit-lawyers/check", { 
      _case,
      lawyers
    })
  })

  router.post("/cases/:id/edit-lawyers/check", async (req, res) => {
    const lawyerIds = req.session.data.editLawyers?.lawyers?.map(Number) || []

    await prisma.case.update({
      where: { id: parseInt(req.params.id) },
      data: {
        lawyers: {
          set: lawyerIds.map(id => ({ id }))
        }
      }
    })

    req.flash('success', 'Assigned lawyers updated')
    res.redirect(`/cases/${req.params.id}`)
  })

}