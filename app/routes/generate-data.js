const bcrypt = require('bcrypt')
const faker = require('@faker-js/faker').faker
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Example data arrays (replace with your own if needed)
const priorities = ['High', 'Medium', 'Low']
const complexities = ['Simple', 'Moderate', 'Complex']
const types = ['magistrates', 'crown', 'other']
const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Tony', 'Steve']
const lastNames = ['Smith', 'Doe', 'Johnson', 'Brown', 'Stark']
const specialisms = ['Fraud', 'Cybercrime', 'Drugs', 'Terrorism']

function futureDateAt10am() {
  const d = faker.date.future()
  d.setHours(10, 0, 0, 0)
  return d
}

function generateCaseReference() {
  const twoDigits = faker.number.int({ min: 10, max: 99 })
  const twoLetters = faker.string.alpha({ count: 2, casing: 'upper' })
  const sixDigits = faker.number.int({ min: 100000, max: 999999 })
  const suffix = faker.number.int({ min: 1, max: 9 })
  return `${twoDigits}${twoLetters}${sixDigits}/${suffix}`
}

module.exports = (router) => {
  router.get('/generate-data', async (req, res) => {
    delete req.session.data
    const redirectUrl = req.query.returnUrl || '/'

    try {
      // -------------------- CLEAR TABLES --------------------
      await prisma.witnessStatement.deleteMany({})
      await prisma.witness.deleteMany({})
      await prisma.task.deleteMany({})
      await prisma.location.deleteMany({})
      await prisma.hearing.deleteMany({})
      await prisma.dGA.deleteMany({})
      await prisma.case.deleteMany({})
      await prisma.defendant.deleteMany({})
      await prisma.victim.deleteMany({})
      await prisma.lawyer.deleteMany({})
      await prisma.user.deleteMany({})
      await prisma.specialism.deleteMany({})
      await prisma.unit.deleteMany({})

      // -------------------- UNITS --------------------
      const unitNames = [
        'Fraud division',
        'Serious crime',
        'Cybercrime',
        'Drugs and organised crime',
        'Terrorism and national security',
        'General prosecutions',
      ]
      const units = []
      for (const name of unitNames) {
        const u = await prisma.unit.create({ data: { name } })
        units.push(u)
      }

      // -------------------- USERS --------------------
      const users = []
      const userData = [
        { email: 'admin@example.com', password: 'password123', role: 'ADMIN' },
        { email: 'user@example.com', password: 'password123', role: 'USER' },
      ]
      for (const u of userData) {
        const hashed = await bcrypt.hash(u.password, 10)
        const user = await prisma.user.create({ data: { ...u, password: hashed } })
        users.push(user)
      }

      // -------------------- SPECIALISMS --------------------
      const specialismRecords = []
      for (const name of specialisms) {
        const s = await prisma.specialism.create({ data: { name } })
        specialismRecords.push(s)
      }

      // -------------------- LAWYERS --------------------
      const lawyers = []
      // Always create Tony Stark
      const tony = await prisma.lawyer.create({
        data: { firstName: 'Tony', lastName: 'Stark', unitId: faker.helpers.arrayElement(units).id },
      })
      lawyers.push(tony)

      for (let i = 0; i < 150; i++) {
        const specialistAreas = faker.helpers.arrayElements(specialismRecords, faker.number.int({ min: 0, max: 2 }))
        const remainingForPreferred = specialismRecords.filter((s) => !specialistAreas.includes(s))
        const preferredAreas = faker.helpers.arrayElements(remainingForPreferred, faker.number.int({ min: 0, max: 2 }))
        const remainingForRestricted = specialismRecords.filter((s) => !specialistAreas.includes(s) && !preferredAreas.includes(s))
        const restrictedAreas = faker.helpers.arrayElements(remainingForRestricted, faker.number.int({ min: 0, max: 2 }))

        const lawyer = await prisma.lawyer.create({
          data: {
            firstName: faker.helpers.arrayElement(firstNames),
            lastName: faker.helpers.arrayElement(lastNames),
            unitId: faker.helpers.arrayElement(units).id,
            specialistAreas: { connect: specialistAreas.map((s) => ({ id: s.id })) },
            preferredAreas: { connect: preferredAreas.map((s) => ({ id: s.id })) },
            restrictedAreas: { connect: restrictedAreas.map((s) => ({ id: s.id })) },
          },
        })
        lawyers.push(lawyer)
      }

      // -------------------- DEFENDANTS --------------------
      const defendants = []
      for (let i = 0; i < 200; i++) {
        const d = await prisma.defendant.create({
          data: {
            firstName: faker.helpers.arrayElement(firstNames),
            lastName: faker.helpers.arrayElement(lastNames),
          },
        })
        defendants.push(d)
      }

      // -------------------- VICTIMS --------------------
      const victims = []
      for (let i = 0; i < 200; i++) {
        const v = await prisma.victim.create({
          data: {
            firstName: faker.helpers.arrayElement(firstNames),
            lastName: faker.helpers.arrayElement(lastNames),
          },
        })
        victims.push(v)
      }

      // -------------------- CASES + WITNESSES + DGA --------------------
      for (let i = 0; i < 50; i++) {
        const assignedDefendants = faker.helpers.arrayElements(defendants, faker.number.int({ min: 1, max: 3 }))
        const assignedVictims = faker.helpers.arrayElements(victims, faker.number.int({ min: 1, max: 3 }))
        const assignedLawyers = faker.helpers.arrayElements(lawyers, faker.number.int({ min: 0, max: 3 }))
        const caseUnitId = assignedLawyers.length
          ? faker.helpers.arrayElement(assignedLawyers).unitId
          : faker.helpers.arrayElement(units).id
        const caseType = faker.helpers.arrayElement(types)

        const createdCase = await prisma.case.create({
          data: {
            reference: generateCaseReference(),
            type: caseType,
            priority: faker.helpers.arrayElement(priorities),
            complexity: faker.helpers.arrayElement(complexities),
            userId: faker.helpers.arrayElement(users).id,
            unitId: caseUnitId,
            defendants: assignedDefendants.length ? { connect: assignedDefendants.map((d) => ({ id: d.id })) } : undefined,
            victims: assignedVictims.length ? { connect: assignedVictims.map((v) => ({ id: v.id })) } : undefined,
            lawyers: assignedLawyers.length ? { connect: assignedLawyers.map((l) => ({ id: l.id })) } : undefined,
            hearing: { create: { date: futureDateAt10am() } },
            location: {
              create: {
                name: faker.company.name(),
                line1: faker.location.streetAddress(),
                line2: faker.location.secondaryAddress(),
                town: faker.location.city(),
                postcode: faker.location.zipCode('WD# #SF'),
              },
            },
            tasks: {
              createMany: {
                data: [
                  { name: 'Retrieve core details', dueDate: futureDateAt10am() },
                  { name: 'Check communications', dueDate: futureDateAt10am() },
                ],
              },
            },
            dga: faker.datatype.boolean()
              ? {
                  create: {
                    outcome: faker.helpers.arrayElement([
                      'NOT_DISPUTED',
                      'DISPUTED_SUCCESSFULLY',
                      'DISPUTED_UNSUCCESSFULLY',
                    ]),
                    reason: faker.lorem.sentence(),
                  },
                }
              : undefined,
          },
        })

        // -------------------- WITNESSES + STATEMENTS --------------------
        const numWitnesses = faker.number.int({ min: 1, max: 7 })
        for (let w = 0; w < numWitnesses; w++) {
          const createdWitness = await prisma.witness.create({
            data: {
              firstName: faker.helpers.arrayElement(firstNames),
              lastName: faker.helpers.arrayElement(lastNames),
              appearingInCourt: faker.helpers.arrayElement([true, false, null]),
              caseId: createdCase.id,
            },
          })

          const numStatements = faker.number.int({ min: 1, max: 2 })
          for (let s = 0; s < numStatements; s++) {
            await prisma.witnessStatement.create({
              data: {
                witnessId: createdWitness.id,
                useInCourt: faker.helpers.arrayElement([true, false, null]),
                serveSection9: caseType === 'magistrates' ? faker.helpers.arrayElement([true, false, null]) : null,
              },
            })
          }
        }
      }

      res.redirect(redirectUrl)
    } catch (e) {
      console.error('Error seeding DB:', e)
      res.status(500).json({ error: 'Failed to seed database' })
    } finally {
      await prisma.$disconnect()
    }
  })
}
