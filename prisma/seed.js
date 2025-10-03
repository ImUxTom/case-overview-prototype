const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { faker } = require("@faker-js/faker");
const complexities = require("../app/data/complexities.js");
const firstNames = require("../app/data/first-names.js");
const lastNames = require("../app/data/last-names.js");
const types = require("../app/data/types.js");
const specialisms = require("../app/data/specialisms.js");

const prisma = new PrismaClient();

function futureDateAt10am() {
  const d = faker.date.future();
  d.setHours(10, 0, 0, 0);
  return d;
}

function generateCaseReference() {
  const twoDigits = faker.number.int({ min: 10, max: 99 });
  const twoLetters = faker.string.alpha({ count: 2, casing: "upper" });
  const sixDigits = faker.number.int({ min: 100000, max: 999999 });
  const suffix = faker.number.int({ min: 1, max: 9 });
  return `${twoDigits}${twoLetters}${sixDigits}/${suffix}`;
}

async function main() {
  console.log("🌱 Starting seed...");

  // -------------------- Units --------------------
  await prisma.unit.createMany({
    data: [
      { name: "Magistrates" },
      { name: "Crown Court" },
      { name: "Rape and serious sexual offences " },
      { name: "Complex casework unit" },
    ],
  });
  console.log("✅ Units seeded");

  // -------------------- Users --------------------
  const users = [];
  const userData = [
    {
      email: "admin@example.com",
      password: "password123",
      role: "ADMIN",
      firstName: "Rachael",
      lastName: "Harvey",
    },
    {
      email: "user@example.com",
      password: "password123",
      role: "USER",
      firstName: "Simon",
      lastName: "Whatley",
    },
  ];

  for (const u of userData) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: {
        ...u,
        password: hashedPassword,
      },
    });
    users.push(user);
  }
  console.log("✅ Users seeded");

  // -------------------- Specialisms --------------------
  await prisma.specialism.createMany({
    data: specialisms.map((name) => ({ name })),
  });
  console.log("✅ Specialisms seeded");

  // -------------------- Lawyers --------------------
  const lawyers = [];
  const tony = await prisma.lawyer.create({
    data: {
      firstName: "Tony",
      lastName: "Stark",
      unit: { connect: { id: faker.number.int({ min: 1, max: 4 }) } },
    },
  });
  lawyers.push(tony);

  for (let i = 0; i < 150; i++) {
    const specialistAreas = faker.helpers.arrayElements(
      specialisms,
      faker.number.int({ min: 0, max: 2 })
    );
    const remainingForPreferred = specialisms.filter(
      (s) => !specialistAreas.includes(s)
    );
    const preferredAreas = faker.helpers.arrayElements(
      remainingForPreferred,
      faker.number.int({ min: 0, max: 2 })
    );
    const remainingForRestricted = specialisms.filter(
      (s) => !specialistAreas.includes(s) && !preferredAreas.includes(s)
    );
    const restrictedAreas = faker.helpers.arrayElements(
      remainingForRestricted,
      faker.number.int({ min: 0, max: 2 })
    );

    const lawyer = await prisma.lawyer.create({
      data: {
        firstName: faker.helpers.arrayElement(firstNames),
        lastName: faker.helpers.arrayElement(lastNames),
        unit: { connect: { id: faker.number.int({ min: 1, max: 4 }) } },
        specialistAreas: { connect: specialistAreas.map((name) => ({ name })) },
        preferredAreas: { connect: preferredAreas.map((name) => ({ name })) },
        restrictedAreas: { connect: restrictedAreas.map((name) => ({ name })) },
      },
    });
    lawyers.push(lawyer);
  }
  console.log("✅ Lawyers seeded");

  // -------------------- Defendants --------------------
  const defendants = [];
  for (let i = 0; i < 200; i++) {
    const d = await prisma.defendant.create({
      data: {
        firstName: faker.helpers.arrayElement(firstNames),
        lastName: faker.helpers.arrayElement(lastNames),
      },
    });
    defendants.push(d);
  }
  console.log("✅ Defendants seeded");

  // -------------------- Victims --------------------
  const victims = [];
  for (let i = 0; i < 200; i++) {
    const v = await prisma.victim.create({
      data: {
        firstName: faker.helpers.arrayElement(firstNames),
        lastName: faker.helpers.arrayElement(lastNames),
      },
    });
    victims.push(v);
  }
  console.log("✅ Victims seeded");

  // -------------------- Cases --------------------
  const TOTAL_CASES = 3465;
  const UNASSIGNED_TARGET = 39;
  const DGA_TARGET = 50; // set desired number of DGAs

  const createdCases = [];

  // Define a pool of possible task names
  const taskNames = [
    "Retrieve core details",
    "Check communications",
    "Review disclosure",
    "Prepare witness briefing",
    "Schedule pre-trial meeting",
    "Draft opening statement",
    "Submit evidence bundle",
    "Confirm hearing date",
  ];

  for (let i = 0; i < TOTAL_CASES; i++) {
    const assignedDefendants = faker.helpers.arrayElements(
      defendants,
      faker.number.int({ min: 1, max: 3 })
    );
    const assignedVictims = faker.helpers.arrayElements(
      victims,
      faker.number.int({ min: 1, max: 3 })
    );

    const caseUnitId = faker.number.int({ min: 1, max: 4 });

    // Pick between 0 and 5 unique task names
    const numTasks = faker.number.int({ min: 0, max: 5 });
    const chosenTaskNames = faker.helpers.arrayElements(taskNames, numTasks);

    const tasksData = chosenTaskNames.map((name) => ({
      name,
      dueDate: faker.date.future(),
    }));

    const createdCase = await prisma.case.create({
      data: {
        reference: generateCaseReference(),
        type: faker.helpers.arrayElement(types),
        user: {
          connect: {
            id: faker.helpers.arrayElement([users[0].id, users[1].id]),
          },
        },
        ctl: faker.datatype.boolean(),
        complexity: faker.helpers.arrayElement(complexities),
        unit: { connect: { id: caseUnitId } },
        defendants: { connect: assignedDefendants.map((d) => ({ id: d.id })) },
        victims: { connect: assignedVictims.map((v) => ({ id: v.id })) },
        hearing: { create: { date: futureDateAt10am() } },
        location: {
          create: {
            name: faker.company.name(),
            line1: faker.location.streetAddress(),
            line2: faker.location.secondaryAddress(),
            town: faker.location.city(),
            postcode: faker.location.zipCode("WD# #SF"),
          },
        },
        tasks: {
          createMany: {
            data: tasksData, // now unique per case
          },
        },
      },
    });

    // -------------------- Witnesses --------------------
    const numWitnesses = faker.number.int({ min: 1, max: 7 });
    for (let w = 0; w < numWitnesses; w++) {
      const createdWitness = await prisma.witness.create({
        data: {
          firstName: faker.helpers.arrayElement(firstNames),
          lastName: faker.helpers.arrayElement(lastNames),
          appearingInCourt: faker.helpers.arrayElement([false, null]),
          caseId: createdCase.id,
          relevant: faker.datatype.boolean(),
          keyWitness: faker.datatype.boolean(),
          type: faker.helpers.arrayElement([
            "Expert",
            "Character",
            "Eye witness",
            "Other",
          ]),
          attendanceIssues: faker.helpers.arrayElement([
            null,
            faker.lorem.sentence(),
          ]),
          previousTransgressions: faker.helpers.arrayElement([
            null,
            faker.lorem.words(5),
          ]),
          warned: faker.datatype.boolean(),
          dateOfBirth: faker.date.birthdate({ min: 18, max: 90, mode: "age" }),
          emailAddress: faker.internet.email(),
          phoneNumber: faker.phone.number(),
          courtAvailabilityStartDate: faker.date.future(),
          courtAvailabilityEndDate: faker.date.future(),
          courtSpecialMeasures: faker.helpers.arrayElement([
            null,
            faker.lorem.sentence(),
          ]),
          courtNeeds: faker.helpers.arrayElement([
            null,
            faker.lorem.sentence(),
          ]),
          requiresMeeting: faker.datatype.boolean(),
        },
      });

      const numStatements = faker.number.int({ min: 1, max: 5 });
      for (let s = 0; s < numStatements; s++) {
        await prisma.witnessStatement.create({
          data: {
            witnessId: createdWitness.id,
            number: s + 1,
            receivedDate: faker.date.past(),
            useAsEvidence: faker.helpers.arrayElement([true, false, null]),
            serveSection9: faker.helpers.arrayElement([true, false, null]),
          },
        });
      }
    }

    createdCases.push({ id: createdCase.id });
  }

  console.log(`✅ Created ${createdCases.length} cases`);

  // -------------------- Assign DGAs --------------------
  const dgaIds = new Set(
    faker.helpers.arrayElements(createdCases, DGA_TARGET).map((c) => c.id)
  );

  for (const c of createdCases) {
    if (dgaIds.has(c.id)) {
      await prisma.dGA.create({
        data: {
          caseId: c.id,
          reason: faker.lorem.sentence(),
          // outcome omitted → will be NULL
        },
      });
    }
  }

  console.log(`✅ Assigned ${DGA_TARGET} cases needing DGA review (no outcome set)`);

  // -------------------- Assign cases --------------------
  const unassignedCount = Math.min(UNASSIGNED_TARGET, createdCases.length);
  const unassignedIds = new Set(
    faker.helpers.arrayElements(createdCases, unassignedCount).map((c) => c.id)
  );
  const assignableCases = createdCases.filter(
    (c) => !unassignedIds.has(c.id)
  );

  for (const c of assignableCases) {
    const chosenLawyer = faker.helpers.arrayElement(lawyers);

    await prisma.case.update({
      where: { id: c.id },
      data: {
        unitId: chosenLawyer.unitId,
        lawyers: {
          set: [{ id: chosenLawyer.id }],
        },
      },
    });
  }

  console.log(
    `✅ Assigned ${assignableCases.length} cases to exactly one lawyer, left ${unassignedCount} unassigned`
  );

  console.log("🌱 Seed finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
