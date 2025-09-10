const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const exec = require('child_process').exec;

const flash = require('connect-flash')
router.use(flash())

router.all('*', (req, res, next) => {
  res.locals.referrer = req.query.referrer
  res.locals.path = req.path
  res.locals.protocol = req.protocol
  res.locals.hostname = req.hostname
  res.locals.query = req.query
  res.locals.flash = req.flash('success')[0]
  next()
})

router.get('/clear-data', function (req, res) {
	delete req.session.data
	const redirectUrl = req.query.returnUrl || '/'
	
  exec("npx prisma db push --force-reset", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error resetting DB: ${error}`)
      return res.status(500).json({ error: "Failed to reset database" })
    }
    console.log(stdout)
    console.error(stderr)
    exec("npx prisma db seed", (seedError, stdout, stderr) => {
      if (seedError) {
        console.error('Error running seed script:', seedError);
        return res.status(500).json({ error: 'Failed to seed database' });
      }
      res.redirect(redirectUrl)
    })
  })

})

require('./routes/account')(router)
require('./routes/overview')(router)
require('./routes/cases')(router)
require('./routes/cases--edit-lawyers')(router)
require('./routes/case--overview')(router)
require('./routes/case--dga')(router)
require('./routes/case--witnesses')(router)
// require('./routes/case--witness')(router)
require('./routes/case--witness--mark-as-appearing-in-court')(router)
require('./routes/case--witness--mark-as-not-appearing-in-court')(router)
require('./routes/case--witness-statement--issue-section9')(router)
require('./routes/case--witness-statement--withdraw-section9')(router)
// require('./routes/case--witness--withdraw-section9')(router)
require('./routes/lawyers')(router)
require('./routes/lawyers--add-specialist-area')(router)

// router.use((err, req, res, next) => {
//   // console.error(err.stack)
//   res
//     .status(500)
//     .render('500', {
//       err
//     })
// })