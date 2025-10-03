const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const checkSignedIn = require('./middleware/checkSignedIn')

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
  delete req.session.data;
  const redirectUrl = req.query.returnUrl || '/';

  // Determine the absolute path to the database folder
  const dataFolder = path.join(__dirname, '../data');

  try {
    // Ensure the folder exists
    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder, { recursive: true });
      console.log(`Created folder: ${dataFolder}`);
    }
  } catch (err) {
    console.error('Error creating data folder:', err);
    return res.status(500).json({ error: 'Failed to prepare database folder' });
  }

  // Run Prisma push and seed
  exec("npx prisma db push --force-reset", (resetError, resetStdout, resetStderr) => {
    if (resetError) {
      console.error('Error resetting DB:', resetError);
      console.error(resetStderr);
      return res.status(500).json({ error: 'Failed to reset database' });
    }
    console.log('DB reset output:', resetStdout);

    exec("npx prisma db seed", (seedError, seedStdout, seedStderr) => {
      if (seedError) {
        console.error('Error seeding DB:', seedError);
        console.error(seedStderr);
        return res.status(500).json({ error: 'Failed to seed database' });
      }
      console.log('DB seeded successfully:', seedStdout);
      res.redirect(redirectUrl);
    });
  });
});

require('./routes/account')(router)

router.use(checkSignedIn)

require('./routes/overview')(router)
require('./routes/activity')(router)

require('./routes/tasks')(router)
require('./routes/cases')(router)
require('./routes/cases--add-lawyer')(router)
require('./routes/case--overview')(router)
require('./routes/case--dga')(router)
require('./routes/case--dga--new')(router)
require('./routes/case--activity')(router)
require('./routes/case--material')(router)
require('./routes/case--witnesses')(router)
require('./routes/case--witness')(router)
require('./routes/case--witness--mark-as-attending-court')(router)
require('./routes/case--witness--mark-as-not-attending-court')(router)
require('./routes/case--witness-statement--mark-as-section9')(router)
require('./routes/case--witness-statement--unmark-as-section9')(router)

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