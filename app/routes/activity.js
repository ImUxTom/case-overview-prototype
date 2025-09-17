const _ = require('lodash')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = router => {

  router.get("/activity", async (req, res) => {
   
    const events = await prisma.activityLog.findMany({
      include: {
        user: true,
        case: {
          include: {
            defendants: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.render('activity/index', {
      events
    })
  })

}