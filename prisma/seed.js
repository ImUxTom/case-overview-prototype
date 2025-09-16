import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import complexities from "../app/data/complexities.js";
import firstNames from "../app/data/first-names.js";
import lastNames from "../app/data/last-names.js";
import types from "../app/data/types.js";
import specialisms from "../app/data/specialisms.js";

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
      { name: "Fraud division" },
      { name: "Serious crime" },
      { name: "Cybercrime" },
      { name: "Drugs and organised crime" },
      { name: "Terrorism and national security" },
      { name: "General prosecutions" },
    ],
  });
  console.log("✅ Units seeded");

  // -------------------- Users --------------------
  const users = [];
  const userData = [
    { email: "admin@example.com", password: "password123", role: "ADMIN" },
    { email: "user@example.com", password: "password123", role: "USER" },
  ];

  for (const u of userData) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: { email: u.email, password: hashedPassword, role: u.role },
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
      unit: { connect: { id: faker.number.int({ min: 1, max: 6 }) } },
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
        unit: { connect: { id: faker.number.int({ min: 1, max: 6 }) } },
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
  for (let i = 0; i < 51; i++) {
    const assignedDefendants = faker.helpers.arrayElements(
      defendants,
      faker.number.int({ min: 1, max: 3 })
    );
    const assignedVictims = faker.helpers.arrayElements(
      victims,
      faker.number.int({ min: 1, max: 3 })
    );
    const assignedLawyers = faker.helpers.arrayElements(
      lawyers,
      faker.number.int({ min: 0, max: 3 })
    );

    let caseUnitId;
    if (assignedLawyers.length > 0) {
      const lawyerUnitIds = assignedLawyers.map((l) => l.unitId);
      caseUnitId = faker.helpers.arrayElement(lawyerUnitIds);
    } else {
      caseUnitId = faker.number.int({ min: 1, max: 6 });
    }

    const courtType = faker.helpers.arrayElement([
      "Magistrates court",
      "Crown court",
    ]);

    const createdCase = await prisma.case.create({
      data: {
        reference: generateCaseReference(),
        type: faker.helpers.arrayElement(types),
        user: {
          connect: { id: faker.helpers.arrayElement([users[0].id, users[1].id]) },
        },
        ctl: faker.datatype.boolean(),
        complexity: faker.helpers.arrayElement(complexities),
        courtType: courtType,
        unit: { connect: { id: caseUnitId } },
        defendants: { connect: assignedDefendants.map((d) => ({ id: d.id })) },
        victims: { connect: assignedVictims.map((v) => ({ id: v.id })) },
        lawyers: { connect: assignedLawyers.map((l) => ({ id: l.id })) },
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
            data: [
              { name: "Retrieve core details", dueDate: faker.date.future() },
              { name: "Check communications", dueDate: faker.date.future() },
            ],
          },
        },
        dga: faker.datatype.boolean()
          ? {
              create: faker.datatype.boolean()
                ? {
                    outcome: faker.helpers.arrayElement([
                      "NOT_DISPUTED",
                      "DISPUTED_SUCCESSFULLY",
                      "DISPUTED_UNSUCCESSFULLY",
                    ]),
                    reason: faker.lorem.sentence(),
                  }
                : {},
            }
          : undefined,
      },
    });

    // -------------------- Witnesses --------------------
    const numWitnesses = faker.number.int({ min: 1, max: 7 });
    for (let w = 0; w < numWitnesses; w++) {
      const createdWitness = await prisma.witness.create({
        data: {
          firstName: faker.helpers.arrayElement(firstNames),
          lastName: faker.helpers.arrayElement(lastNames),
          appearingInCourt: faker.helpers.arrayElement([true, false, null]),
          caseId: createdCase.id,
          // New fields
          relevant: faker.datatype.boolean(),
          keyWitness: faker.datatype.boolean(),
          type: faker.helpers.arrayElement(["Expert", "Character", "Eye witness", "Other"]),
          attendanceIssues: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
          previousTransgressions: faker.helpers.arrayElement([null, faker.lorem.words(5)]),
          warned: faker.datatype.boolean(),
          dateOfBirth: faker.date.birthdate({ min: 18, max: 90, mode: "age" }),
          emailAddress: faker.internet.email(),
          phoneNumber: faker.phone.number(),
          courtAvailabilityStartDate: faker.date.future(),
          courtAvailabilityEndDate: faker.date.future(),
          courtSpecialMeasures: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
          courtNeeds: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
          requiresMeeting: faker.datatype.boolean(),
        },
      });

      const numStatements = faker.number.int({ min: 1, max: 5 });
      for (let s = 0; s < numStatements; s++) {
        await prisma.witnessStatement.create({
          data: {
            witnessId: createdWitness.id,
            receivedDate: faker.date.past(),
            useAsEvidence: faker.helpers.arrayElement([true, false, null]),
            serveSection9: faker.helpers.arrayElement([true, false, null]),
          },
        });
      }
    }
  }

  console.log("✅ Cases with witnesses and statements seeded");
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
