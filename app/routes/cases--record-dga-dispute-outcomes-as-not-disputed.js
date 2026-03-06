const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = (router) => {
  router.get('/cases/record-dga-dispute-outcomes-as-not-disputed', async (req, res) => {
    const selectedCaseIds = req.session.data.applyAction.cases.map(Number)

    const cases = await prisma.case.findMany({
      where: { id: { in: selectedCaseIds } },
      include: {
        defendants: true,
        dga: { include: { failureReasons: true } },
      },
    })

    const caseItems = cases
      .map((c) => ({
        ...c,
        totalFailureReasons: c.dga?.failureReasons?.length || 0,
        unresolvedFailureReasons:
          c.dga?.failureReasons?.filter((fr) => fr.disputed === null).length || 0,
      }))
      .filter((c) => c.unresolvedFailureReasons > 0)

    res.render('cases/record-dga-dispute-outcomes-as-not-disputed/index', { caseItems })
  })

  router.post('/cases/record-dga-dispute-outcomes-as-not-disputed', async (req, res) => {
    const selectedCaseIds = req.session.data.applyAction.cases.map(Number)

    const cases = await prisma.case.findMany({
      where: { id: { in: selectedCaseIds } },
      include: {
        policeUnit: true,
        dga: { include: { failureReasons: true } },
      },
    })

    for (const c of cases) {
      const unresolvedReasons = c.dga?.failureReasons?.filter((fr) => fr.disputed === null) || []

      for (const fr of unresolvedReasons) {
        await prisma.dGAFailureReason.update({
          where: { id: fr.id },
          data: { disputed: 'No' },
        })

        const date = new Date(c.dga.reviewDate)
        const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

        await prisma.activityLog.create({
          data: {
            userId: req.session.data.user.id,
            model: 'DGAFailureReason',
            recordId: fr.id,
            action: 'UPDATE',
            title: 'DGA outcome recorded',
            caseId: c.id,
            meta: {
              failureReason: fr.reason,
              policeUnit: c.policeUnit?.name || 'Not specified',
              monthName,
              disputed: 'No',
            },
          },
        })
      }
    }

    delete req.session.data.applyAction

    req.flash('success', 'DGA dispute outcomes recorded as not disputed')

    res.redirect('/cases')
  })
}
