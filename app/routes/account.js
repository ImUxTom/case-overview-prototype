const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const checkSignedIn = require('../middleware/checkSignedIn')

module.exports = router => {

  router.get('/account', checkSignedIn, (req, res) => {
    res.render("account/index", { 
      user: req.session.data.user
    })
  })


  router.post('/account/sign-in', async (req, res) => {
    req.session.data.user = await prisma.user.findFirst()
if (req.session.data['state'] === 'current') {
    res.redirect('/tasks')
  } else {
    res.redirect('/overview')
  }
})

  router.get('/account/sign-out', (req, res) => {
    req.session.data.user = null
    res.redirect('/account/sign-in')
  })

  router.get('/account/sign-in', (req, res) => {
    res.render('/account/sign-in')
  })

}