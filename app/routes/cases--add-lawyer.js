const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getLawyerHintText(lawyer) {
  total = lawyer._count.cases
  let hintParts = []

  if(lawyer.didInitialReview) {
    hintParts.push(
      `<li>Ground work lawyer</li>`
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
    if (lawyer.ctlCases && lawyer.ctlCases.length > 0) {
      hintParts.push(`<li>${total} case${total > 1 ? "s" : ""}</li>`)
    }

    // Collect only levels that have > 0
    let breakdown = []

    if (lawyer.ctlCases && lawyer.ctlCases.length > 0) {
      breakdown.push(`${lawyer.ctlCases.length} CTL`)
    }

    if (lawyer.stlCases && lawyer.stlCases.length > 0) {
      breakdown.push(`${lawyer.stlCases.length} STL`)
    }

    if (lawyer.level1Cases && lawyer.level1Cases.length > 0) {
      breakdown.push(`${lawyer.level1Cases.length} level one`)
    }
    if (lawyer.level2Cases && lawyer.level2Cases.length > 0) {
      breakdown.push(`${lawyer.level2Cases.length} level two`)
    }
    if (lawyer.level3Cases && lawyer.level3Cases.length > 0) {
      breakdown.push(`${lawyer.level3Cases.length} level three`)
    }
    if (lawyer.level4Cases && lawyer.level4Cases.length > 0) {
      breakdown.push(`${lawyer.level4Cases.length} level four`)
    }
    if (lawyer.level5Cases && lawyer.level5Cases.length > 0) {
      breakdown.push(`${lawyer.level5Cases.length} level five`)
    }

    if (breakdown.length) {
      caseLoadBreakdown += `${breakdown.join(", ")}`
    }

  }

  hintParts.push(`<li>${caseLoadBreakdown}</li>`)

  return `<ul class="govuk-list govuk-list--bullet govuk-hint govuk-!-margin-bottom-0">${hintParts.join("")}</ul>`
}


module.exports = router => {

  router.get("/cases/:caseId/add-lawyer", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
      include: { unit: true, lawyers: { select: { id: true } } }
    })

    const assignedLawyers = _.get(req.session.data, 'editLawyers.lawyers') || _case.lawyers.map(lawyer => `${lawyer.id}`)

    let lawyers = await prisma.lawyer.findMany({
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
          select: {
            id: true,
            complexity: true,
            defendants: {
              select: {
                charges: {
                  select: {
                    custodyTimeLimit: true
                  }
                }
              }
            }
          }
        }
      }
    })

    lawyers = lawyers.map((lawyer, index) => {
      // Hard-code Michael Chen's caseload data
      if (lawyer.firstName === 'Michael' && lawyer.lastName === 'Chen') {
        return {
          ...lawyer,
          level1Cases: Array(3).fill({}), // 3 level 1 cases
          level2Cases: Array(3).fill({}), // 3 level 2 cases
          level3Cases: Array(2).fill({}), // 2 level 3 cases
          level4Cases: Array(1).fill({}), // 1 level 4 case
          level5Cases: Array(1).fill({}), // 1 level 5 case
          ctlCases: Array(2).fill({}),    // 2 CTL cases
          stlCases: Array(2).fill({}),    // 2 STL cases
          totalCases: 10,
          ctlCaseCount: 2,
          stlCaseCount: 2
        }
      }

      const ctlCases = lawyer.cases?.filter(c => {
        return c.defendants.some(d => d.charges.some(ch => ch.custodyTimeLimit !== null))
      }) || []

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
        ctlCases,
        totalCases: lawyer._count.cases,
        ctlCaseCount: ctlCases.length
      }
      return newLawyer
    })

    lawyers.sort((a, b) => a.totalCases - b.totalCases || a.ctlCaseCount - b.ctlCaseCount)

    // Find Michael Chen and make him the recommended prosecutor
    const michaelChenIndex = lawyers.findIndex(l => l.firstName === 'Michael' && l.lastName === 'Chen')
    if (michaelChenIndex !== -1) {
      lawyers[michaelChenIndex].didInitialReview = true
      lawyers[michaelChenIndex].recommended = true
      // Move Michael Chen to the top of the list
      const michaelChen = lawyers.splice(michaelChenIndex, 1)[0]
      lawyers.unshift(michaelChen)
    } else {
      // Fallback to first lawyer if Michael Chen not found
      lawyers[0].didInitialReview = true
      lawyers[0].recommended = true
    }

    let lawyerItems = lawyers.map(lawyer => {
      let text = `${lawyer.firstName} ${lawyer.lastName}`
      if(lawyer.recommended) {
        text += ` (most suitable)`
      }

      return {
        text: text,
        value: `${lawyer.id}`,
        hint: {
          html: getLawyerHintText(lawyer)
        }
      }
    })

    res.render("cases/add-lawyer/index", { 
      _case, 
      assignedLawyers,
      lawyerItems 
    })
  })

  router.post("/cases/:caseId/add-lawyer", async (req, res) => {
    res.redirect(`/cases/${req.params.caseId}/add-lawyer/check`)
  })

  router.get("/cases/:caseId/add-lawyer/check", async (req, res) => {
    const _case = await prisma.case.findUnique({
      where: { id: parseInt(req.params.caseId) },
    })

    // get the lawyer being assigned
    let lawyer = await prisma.lawyer.findUnique({
      where: { id: parseInt(req.session.data.assignLawyer.lawyer) },
      include: { 
        cases: { select: { id: true, complexity: true } },
        _count: { select: { cases: true } },
      },
    })

    res.render("cases/add-lawyer/check", { 
      _case,
      lawyer
    })
  })

  router.post("/cases/:caseId/add-lawyer/check", async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const lawyerId = parseInt(req.session.data.assignLawyer.lawyer)
    
    await prisma.case.update({
      where: { id: caseId },
      data: {
        lawyers: {
          connect: { id: lawyerId }
        }
      }
    })

    const lawyer = await prisma.lawyer.findUnique({
      where: { id: lawyerId },
      select: { id: true, firstName: true, lastName: true } 
    })


    await prisma.activityLog.create({
      data: {
        userId: req.session.data.user.id,
        model: 'Case',
        recordId: caseId,
        action: 'UPDATE',
        title: 'Prosecutor assigned',
        caseId: caseId,
        meta: { lawyer }
      }
    })

    delete req.session.data.assignLawyer

    req.flash('success', 'Prosecutor assigned')
    res.redirect(`/cases/${req.params.caseId}`)
  })

}