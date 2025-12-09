const { PrismaClient } = require("@prisma/client");
const { faker } = require("@faker-js/faker");

// Data
const complexities = require("../app/data/complexities.js");
const firstNames = require("../app/data/first-names.js");
const lastNames = require("../app/data/last-names.js");
const types = require("../app/data/types.js");
const taskNames = require("../app/data/task-names.js");
const documentTypes = require("../app/data/document-types.js");
const venues = require("../app/data/venues.js");
const remandStatuses = require("../app/data/remand-statuses.js");
const charges = require("../app/data/charges.js");
const chargeStatuses = require("../app/data/charge-statuses.js");
const pleas = require("../app/data/pleas.js");
const ukCities = require("../app/data/uk-cities.js");
const religions = require("../app/data/religions.js");
const occupations = require("../app/data/occupations.js");
const taskNoteDescriptions = require("../app/data/task-note-descriptions.js");
const manualTaskNamesShort = require("../app/data/manual-task-names-short.js");
const manualTaskNamesLong = require("../app/data/manual-task-names-long.js");
const documentNames = require("../app/data/document-names.js");

// Helpers
const { generateCaseReference } = require("./seed-helpers/identifiers");
const { generateUKMobileNumber, generateUKLandlineNumber, generateUKPhoneNumber } = require("./seed-helpers/phone-numbers");
const { futureDateAt10am } = require("./seed-helpers/dates");
const { generatePendingTaskDates, generateDueTaskDates, generateOverdueTaskDates, generateEscalatedTaskDates } = require("./seed-helpers/task-dates");
const { generateExpiredCTL, generateTodayCTL, generateTomorrowCTL, generateThisWeekCTL, generateNextWeekCTL, generateLaterCTL } = require("./seed-helpers/ctl-generators");
const { generateExpiredSTL, generateTodaySTL, generateTomorrowSTL, generateThisWeekSTL, generateNextWeekSTL, generateLaterSTL } = require("./seed-helpers/stl-generators");
const { generateExpiredPACE, generateLessThan1HourPACE, generateLessThan2HoursPACE, generateLessThan3HoursPACE, generateMoreThan3HoursPACE } = require("./seed-helpers/pace-generators");

// Seeds
const { seedUnits } = require("./seed-helpers/units");
const { seedTeams } = require("./seed-helpers/teams");
const { seedUsers } = require("./seed-helpers/users");
const { seedSpecialisms } = require("./seed-helpers/specialisms");
const { seedProsecutors } = require("./seed-helpers/prosecutors");
const { seedDefenceLawyers } = require("./seed-helpers/defence-lawyers");
const { seedDefendants } = require("./seed-helpers/defendants");
const { seedVictims } = require("./seed-helpers/victims");
const { getDefendantTimeLimitTypes } = require("./seed-helpers/defendant-time-limit-types");
const { seedUserSpecificTestCases } = require("./seed-helpers/user-specific-test-cases");
const { seedPriorityTasks } = require("./seed-helpers/priority-tasks");
const { seedGuaranteedTasks } = require("./seed-helpers/guaranteed-tasks");
const { seedDGAAssignments } = require("./seed-helpers/dga-assignments");
const { seedGeneralCases } = require("./seed-helpers/general-cases");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Seed: Units
  await seedUnits(prisma);

  // Seed: Teams
  await seedTeams(prisma);

  // Seed: Users
  const users = await seedUsers(prisma);

  // Seed: Specialisms
  await seedSpecialisms(prisma);

  // Seed: Prosecutors (users with role="Prosecutor")
  const prosecutors = await seedProsecutors(prisma);

  // Seed: Defence lawyers
  const defenceLawyers = await seedDefenceLawyers(prisma);

  // Seed: Defendants
  const defendants = await seedDefendants(prisma, defenceLawyers);

  // Seed: Victims
  const victims = await seedVictims(prisma);

  // Determine defendant time limit types for case grouping
  const defendantTimeLimitTypes = await getDefendantTimeLimitTypes(defendants, prisma);

  // -------------------- Cases --------------------
  const TOTAL_CASES = 1065;
  const UNASSIGNED_TARGET = 7;
  const DGA_TARGET = 10;

  // Group defendants by their actual assigned time limit type
  const ctlDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'CTL');
  const stlDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'STL');
  const paceDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'PACE');

  // Seed: General cases
  const createdCases = await seedGeneralCases(
    prisma,
    {
      users,
      prosecutors,
      defendants,
      victims,
      ctlDefendants,
      stlDefendants,
      paceDefendants
    },
    {
      totalCases: TOTAL_CASES,
      unassignedTarget: UNASSIGNED_TARGET,
      complexities,
      types,
      taskNames,
      documentTypes,
      venues,
      ukCities,
      firstNames,
      lastNames,
      documentNames,
      manualTaskNamesShort,
      manualTaskNamesLong,
      taskNoteDescriptions
    }
  );

  // Seed: DGA assignments
  await seedDGAAssignments(prisma, createdCases, {
    dgaTarget: DGA_TARGET
  });

  // Seed: guaranteed tasks
  await seedGuaranteedTasks(prisma, users, taskNames);

  // Seed: Priority tasks to make sure each user profile e.g. Rachael has priority tasks
  await seedPriorityTasks(prisma, taskNames);

  // Seed: User specific cases/tasks e.g. Rachael
  await seedUserSpecificTestCases(
    prisma,
    { defenceLawyers, victims },
    { charges, firstNames, lastNames, pleas, types, complexities, taskNames, ukCities }
  );

  // -------------------- Seed Case Notes --------------------
  // Fetch all cases and add notes to 30% of them
  const allCases = await prisma.case.findMany();
  let caseNotesCreated = 0;
  let casesWithNotes = 0;

  for (const _case of allCases) {
    // 30% chance this case gets notes
    if (faker.datatype.boolean({ probability: 0.3 })) {
      const numNotes = faker.number.int({ min: 1, max: 3 });

      for (let n = 0; n < numNotes; n++) {
        const randomUser = faker.helpers.arrayElement(users);
        await prisma.note.create({
          data: {
            content: faker.lorem.sentences(2),
            caseId: _case.id,
            userId: randomUser.id,
            createdAt: faker.date.recent({ days: 30 })
          }
        });
        caseNotesCreated++;
      }
      casesWithNotes++;
    }
  }

  console.log(`✅ Created ${caseNotesCreated} case notes across ${casesWithNotes} cases`);

  // -------------------- Seed Direction Notes --------------------
  // Fetch all directions and add notes to 30% of them
  const allDirections = await prisma.direction.findMany();
  let directionNotesCreated = 0;
  let directionsWithNotes = 0;

  for (const direction of allDirections) {
    // 30% chance this direction gets notes
    if (faker.datatype.boolean({ probability: 0.3 })) {
      const numNotes = faker.number.int({ min: 1, max: 3 });

      for (let n = 0; n < numNotes; n++) {
        const randomUser = faker.helpers.arrayElement(users);
        await prisma.directionNote.create({
          data: {
            description: faker.lorem.sentences(2),
            directionId: direction.id,
            userId: randomUser.id,
            createdAt: faker.date.recent({ days: 30 })
          }
        });
        directionNotesCreated++;
      }
      directionsWithNotes++;
    }
  }

  console.log(`✅ Created ${directionNotesCreated} direction notes across ${directionsWithNotes} directions`);

  // -------------------- Activity Logs --------------------
  const eventTypes = [
    'DGA recorded',
    'Prosecutor assigned',
    'Witness marked as appearing in court',
    'Witness marked as not attending court',
    'Witness statement marked as Section 9',
    'Witness statement unmarked as Section 9'
  ];

  const dgaOutcomes = {
    NOT_DISPUTED: "Not disputed",
    DISPUTED_SUCCESSFULLY: "Disputed successfully",
    DISPUTED_UNSUCCESSFULLY: "Disputed unsuccessfully"
  };

  const witnessNotAppearingReasons = [
    "Witness is ill and unable to attend",
    "Witness has moved abroad",
    "Witness is unavailable due to work commitments",
    "Witness has refused to attend",
    "Witness cannot be located",
    "Witness is intimidated and unwilling to testify",
    "Witness has conflicting court appearance",
    "Witness has withdrawn cooperation"
  ];

  // Select ~50% of cases to have activity logs
  const casesForActivity = faker.helpers.arrayElements(
    createdCases,
    Math.floor(createdCases.length * 0.5)
  );

  let totalActivityLogs = 0;

  for (const caseRef of casesForActivity) {
    // Fetch the full case with relations
    const fullCase = await prisma.case.findUnique({
      where: { id: caseRef.id },
      include: {
        prosecutors: {
          include: { user: true }
        },
        dga: true,
        witnesses: {
          include: {
            statements: true
          }
        }
      }
    });

    // Generate 1-6 events per case
    const numEvents = faker.number.int({ min: 1, max: 6 });
    const eventsToCreate = [];

    // Generate base dates for this case (over the last 6 months)
    const baseDates = [];
    for (let i = 0; i < numEvents; i++) {
      baseDates.push(faker.date.past({ years: 0.5 }));
    }
    // Sort chronologically
    baseDates.sort((a, b) => a - b);

    for (let i = 0; i < numEvents; i++) {
      const randomUser = faker.helpers.arrayElement(users);
      const eventDate = baseDates[i];

      // Decide which event type to create based on what exists
      const possibleEvents = [];

      // Prosecutor assigned - if case has prosecutors
      if (fullCase.prosecutors && fullCase.prosecutors.length > 0) {
        possibleEvents.push('Prosecutor assigned');
      }

      // DGA recorded - if case has a DGA
      if (fullCase.dga) {
        possibleEvents.push('DGA recorded');
      }

      // Witness events - if case has witnesses
      if (fullCase.witnesses && fullCase.witnesses.length > 0) {
        possibleEvents.push('Witness marked as appearing in court');
        possibleEvents.push('Witness marked as not attending court');
      }

      // Witness statement events - if case has witness statements
      const witnessesWithStatements = fullCase.witnesses?.filter(w => w.statements.length > 0) || [];
      if (witnessesWithStatements.length > 0) {
        possibleEvents.push('Witness statement marked as Section 9');
        possibleEvents.push('Witness statement unmarked as Section 9');
      }

      // Task note events - if case has tasks with notes
      const tasksWithNotes = await prisma.task.findMany({
        where: {
          caseId: fullCase.id,
          notes: { some: {} }
        },
        include: {
          notes: true
        }
      });
      if (tasksWithNotes.length > 0) {
        possibleEvents.push('Task note added');
      }

      // Direction note events - if case has directions with notes
      const directionsWithNotes = await prisma.direction.findMany({
        where: {
          caseId: fullCase.id,
          notes: { some: {} }
        },
        include: {
          notes: true
        }
      });
      if (directionsWithNotes.length > 0) {
        possibleEvents.push('Direction note added');
      }

      // Case note events - if case has notes
      const caseNotes = await prisma.note.findMany({
        where: {
          caseId: fullCase.id
        }
      });
      if (caseNotes.length > 0) {
        possibleEvents.push('Case note added');
      }

      // If no possible events, skip
      if (possibleEvents.length === 0) continue;

      const eventType = faker.helpers.arrayElement(possibleEvents);
      let activityData = {
        userId: randomUser.id,
        caseId: fullCase.id,
        action: 'UPDATE',
        title: eventType,
        createdAt: eventDate
      };

      // Add specific metadata based on event type
      switch (eventType) {
        case 'Prosecutor assigned':
          const prosecutorAssignment = faker.helpers.arrayElement(fullCase.prosecutors);
          const prosecutor = prosecutorAssignment.user;
          activityData.model = 'Case';
          activityData.recordId = fullCase.id;
          activityData.meta = {
            prosecutor: {
              id: prosecutor.id,
              firstName: prosecutor.firstName,
              lastName: prosecutor.lastName
            }
          };
          break;

        case 'DGA recorded':
          const outcomeKey = faker.helpers.arrayElement(['NOT_DISPUTED', 'DISPUTED_SUCCESSFULLY', 'DISPUTED_UNSUCCESSFULLY']);
          activityData.model = 'Case';
          activityData.recordId = fullCase.id;
          activityData.meta = {
            outcome: dgaOutcomes[outcomeKey]
          };
          break;

        case 'Witness marked as appearing in court':
          const appearingWitness = faker.helpers.arrayElement(fullCase.witnesses);
          activityData.model = 'Witness';
          activityData.recordId = appearingWitness.id;
          activityData.meta = {
            witness: {
              id: appearingWitness.id,
              firstName: appearingWitness.firstName,
              lastName: appearingWitness.lastName
            }
          };
          break;

        case 'Witness marked as not attending court':
          const notAppearingWitness = faker.helpers.arrayElement(fullCase.witnesses);
          activityData.model = 'Witness';
          activityData.recordId = notAppearingWitness.id;
          activityData.meta = {
            witness: {
              id: notAppearingWitness.id,
              firstName: notAppearingWitness.firstName,
              lastName: notAppearingWitness.lastName
            },
            reason: faker.helpers.arrayElement(witnessNotAppearingReasons)
          };
          break;

        case 'Witness statement marked as Section 9':
        case 'Witness statement unmarked as Section 9':
          const witnessWithStatement = faker.helpers.arrayElement(witnessesWithStatements);
          const statement = faker.helpers.arrayElement(witnessWithStatement.statements);
          activityData.model = 'WitnessStatement';
          activityData.recordId = statement.id;
          activityData.meta = {
            witnessStatement: {
              id: statement.id,
              number: statement.number
            },
            witness: {
              id: witnessWithStatement.id,
              firstName: witnessWithStatement.firstName,
              lastName: witnessWithStatement.lastName
            }
          };
          break;

        case 'Task note added':
          const taskWithNote = faker.helpers.arrayElement(tasksWithNotes);
          const taskNote = faker.helpers.arrayElement(taskWithNote.notes);
          activityData.model = 'TaskNote';
          activityData.recordId = taskNote.id;
          activityData.action = 'CREATE';
          activityData.meta = {
            task: {
              id: taskWithNote.id,
              name: taskWithNote.name
            },
            description: taskNote.description
          };
          break;

        case 'Direction note added':
          const directionWithNote = faker.helpers.arrayElement(directionsWithNotes);
          const directionNote = faker.helpers.arrayElement(directionWithNote.notes);
          activityData.model = 'DirectionNote';
          activityData.recordId = directionNote.id;
          activityData.action = 'CREATE';
          activityData.meta = {
            direction: {
              id: directionWithNote.id,
              description: directionWithNote.description
            },
            description: directionNote.description
          };
          break;

        case 'Case note added':
          const caseNote = faker.helpers.arrayElement(caseNotes);
          activityData.model = 'Note';
          activityData.recordId = caseNote.id;
          activityData.action = 'CREATE';
          activityData.meta = {
            content: caseNote.content
          };
          break;
      }

      eventsToCreate.push(activityData);
    }

    // Create all events for this case
    for (const eventData of eventsToCreate) {
      await prisma.activityLog.create({
        data: eventData
      });
      totalActivityLogs++;
    }
  }

  console.log(`✅ Created ${totalActivityLogs} activity log entries across ${casesForActivity.length} cases`);

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
