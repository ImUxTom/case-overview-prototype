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
  const DGA_TARGET = 10; // set desired number of DGAs

  const createdCases = [];

  // Group defendants by their actual assigned time limit type
  const ctlDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'CTL');
  const stlDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'STL');
  const paceDefendants = defendants.filter((_, index) => defendantTimeLimitTypes[index] === 'PACE');

  for (let i = 0; i < TOTAL_CASES; i++) {
    // Randomly choose which time limit type this case will have
    const timeLimitType = faker.helpers.arrayElement(['CTL', 'STL', 'PACE']);

    // Select defendants ONLY from the appropriate pool
    // This ensures no mixing of time limit types within a case
    let defendantPool;
    if (timeLimitType === 'CTL') {
      defendantPool = ctlDefendants;
    } else if (timeLimitType === 'STL') {
      defendantPool = stlDefendants;
    } else {
      defendantPool = paceDefendants;
    }

    const assignedDefendants = faker.helpers.arrayElements(
      defendantPool,
      faker.number.int({ min: 1, max: 3 })
    );
    const assignedVictims = faker.helpers.arrayElements(
      victims,
      faker.number.int({ min: 1, max: 3 })
    );

    const caseUnitId = faker.number.int({ min: 1, max: 18 });

    // Pick between 0 and 5 unique standard task names
    const numStandardTasks = faker.number.int({ min: 0, max: 5 });
    const chosenTaskNames = faker.helpers.arrayElements(taskNames, numStandardTasks);

    // Add 0 to 2 reminder tasks (with manual-style descriptions)
    const numReminderTasks = faker.number.int({ min: 0, max: 2 });
    const reminderTasks = [];
    for (let r = 0; r < numReminderTasks; r++) {
      // 80% standard reminder, 20% asset recovery reminder
      const reminderType = faker.datatype.boolean({ probability: 0.8 }) ? 'Standard' : 'Asset recovery';

      // Generate longer description for reminder tasks (like manual tasks)
      // 25% chance of long name, 75% chance of short name
      const useLongName = faker.datatype.boolean({ probability: 0.25 });
      const name = useLongName
        ? faker.helpers.arrayElement(manualTaskNamesLong)
        : faker.helpers.arrayElement(manualTaskNamesShort);

      reminderTasks.push({ name, reminderType });
    }

    const allTasks = [
      ...chosenTaskNames.map(name => ({ name, reminderType: null })),
      ...reminderTasks
    ];

    const tasksData = allTasks.map((taskInfo) => {
      const { name, reminderType } = taskInfo;

      // 75% assigned to users, 25% assigned to teams
      const assignmentType = faker.helpers.weightedArrayElement([
        { weight: 75, value: 'user' },
        { weight: 25, value: 'team' }
      ]);

      let assignedToUserId = null;
      let assignedToTeamId = null;

      if (assignmentType === 'user') {
        // Exclude Tony Stark (casework assistant) from task assignments
        const usersExcludingTony = users.filter(u => u.email !== 'tony@cps.gov.uk');
        assignedToUserId = faker.helpers.arrayElement(usersExcludingTony).id;
      } else if (assignmentType === 'team') {
        // Pick a random team from the case's unit (4 teams per unit)
        const unitTeamOffset = (caseUnitId - 1) * 4;
        assignedToTeamId = faker.number.int({ min: unitTeamOffset + 1, max: unitTeamOffset + 4 });
      }

      // Generate task dates based on random state
      // 40% pending, 30% due, 20% overdue, 10% escalated
      const stateType = faker.helpers.weightedArrayElement([
        { weight: 40, value: 'pending' },
        { weight: 30, value: 'due' },
        { weight: 20, value: 'overdue' },
        { weight: 10, value: 'escalated' }
      ]);

      let dates;
      switch (stateType) {
        case 'pending':
          dates = generatePendingTaskDates();
          break;
        case 'due':
          dates = generateDueTaskDates();
          break;
        case 'overdue':
          dates = generateOverdueTaskDates();
          break;
        case 'escalated':
          dates = generateEscalatedTaskDates();
          break;
      }

      // 5% chance task is completed
      const completedDate = faker.datatype.boolean({ probability: 0.05 }) ? faker.date.recent({ days: 30 }) : null;

      // 30% chance task is urgent
      const isUrgent = faker.datatype.boolean({ probability: 0.30 });
      const urgentNote = isUrgent ? faker.helpers.arrayElement([
        'This task requires immediate attention due to upcoming court hearing.',
        'Defendant is in custody and custody time limit is approaching.',
        'Critical evidence needs to be reviewed urgently.',
        'Urgent request from senior prosecutor.',
        'Time-sensitive matter requiring immediate action.',
        'Witness availability is limited and needs urgent contact.'
      ]) : null;

      return {
        name,
        reminderType,
        reminderDate: dates.reminderDate,
        dueDate: dates.dueDate,
        escalationDate: dates.escalationDate,
        completedDate,
        isUrgent,
        urgentNote,
        assignedToUserId,
        assignedToTeamId,
      };
    });

    // Pick between 5 and 15 documents
    const numDocuments = faker.number.int({ min: 5, max: 15 });
    const documentsData = [];
    for (let d = 0; d < numDocuments; d++) {
      const baseName = faker.helpers.arrayElement(documentNames);
      const name = `${baseName} ${d + 1}`;
      documentsData.push({
        name,
        description: faker.helpers.arrayElement(['This is a random description', 'This is another random description', faker.lorem.sentence()]),
        type: faker.helpers.arrayElement(documentTypes),
        size: faker.number.int({ min: 50, max: 5000 }),
      });
    }

    // Generate 0-5 directions per case
    const numDirections = faker.number.int({ min: 0, max: 5 });
    const directionsData = [];
    for (let dir = 0; dir < numDirections; dir++) {
      const directionTitles = [
        'Witness statement required',
        'Evidence review needed',
        'Extension application',
        'Disclosure exercise',
        'Notice to be served',
        'Expert report request',
        'Defence case statement response',
        'Counsel conference',
        'Victim update required',
        'Bad Character application',
        'Court order compliance',
        'Additional evidence service'
      ];

      const directionDescriptions = [
        'Provide witness statement by the specified date',
        'Submit evidence review by the specified date',
        'File application for extension by the specified date',
        'Complete disclosure exercise by the specified date',
        'Serve notice on defendant by the specified date',
        'Obtain expert report by the specified date',
        'File response to defence case statement by the specified date',
        'Arrange conference with counsel by the specified date',
        'Update victim on case progress by the specified date',
        'Submit Bad Character application by the specified date',
        'Comply with court order by the specified date',
        'Serve additional evidence by the specified date'
      ];

      const directionIndex = faker.number.int({ min: 0, max: directionTitles.length - 1 });
      const title = directionTitles[directionIndex];
      const description = directionDescriptions[directionIndex];

      // Generate due date: 60% overdue, 20% today/tomorrow, 20% future
      const dateChoice = faker.number.float({ min: 0, max: 1 });
      let dueDate;

      if (dateChoice < 0.6) {
        // Overdue - 1 to 90 days in the past
        dueDate = faker.date.past({ days: 90 });
      } else if (dateChoice < 0.7) {
        // Due today
        dueDate = new Date();
        dueDate.setHours(23, 59, 59, 999);
      } else if (dateChoice < 0.8) {
        // Due tomorrow
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(23, 59, 59, 999);
      } else {
        // Future - 2 to 60 days ahead
        dueDate = faker.date.soon({ days: 60 });
      }

      // 5% chance direction is already completed
      const completedDate = faker.datatype.boolean({ probability: 0.05 }) ? faker.date.recent({ days: 30 }) : null;

      // Assignee: Prosecution or Defence
      const assignee = faker.helpers.arrayElement(['Prosecution', 'Defence']);

      // Always assign to a specific defendant from this case
      const defendantId = assignedDefendants.length > 0
        ? faker.helpers.arrayElement(assignedDefendants).id
        : null;

      directionsData.push({
        title,
        description,
        dueDate,
        completedDate,
        assignee,
        defendantId
      });
    }

    const createdCase = await prisma.case.create({
      data: {
        reference: generateCaseReference(),
        type: faker.helpers.arrayElement(types),
        complexity: faker.helpers.arrayElement(complexities),
        unit: { connect: { id: caseUnitId } },
        defendants: { connect: assignedDefendants.map((d) => ({ id: d.id })) },
        victims: { connect: assignedVictims.map((v) => ({ id: v.id })) },
        location: {
          create: {
            name: faker.company.name(),
            line1: faker.location.streetAddress(),
            line2: faker.location.secondaryAddress(),
            town: faker.helpers.arrayElement(ukCities),
            postcode: faker.location.zipCode("WD# #SF"),
          },
        },
        tasks: {
          createMany: {
            data: tasksData, // now unique per case
          },
        },
        directions: {
          createMany: {
            data: directionsData,
          },
        },
        documents: {
          createMany: {
            data: documentsData,
          },
        },
      },
    });

    // Assign prosecutors to case
    // Use UNASSIGNED_TARGET to determine how many cases should remain unassigned
    const unassignedProbability = UNASSIGNED_TARGET / TOTAL_CASES;
    const shouldAssignProsecutor = faker.number.float({ min: 0, max: 1 }) >= unassignedProbability;

    if (shouldAssignProsecutor) {
      // 99% get 1 prosecutor, 1% get 2-3
      const prosecutorAssignmentChoice = faker.number.float({ min: 0, max: 1 });
      const numProsecutors = prosecutorAssignmentChoice < 0.99 ? 1 : faker.number.int({ min: 2, max: 3 });

      // Get prosecutors from this case's unit
      const unitProsecutors = prosecutors.filter(p =>
        p.units.some(uu => uu.unitId === caseUnitId)
      );

      if (unitProsecutors.length > 0) {
        const assignedProsecutors = faker.helpers.arrayElements(unitProsecutors, Math.min(numProsecutors, unitProsecutors.length));
        for (const prosecutor of assignedProsecutors) {
          await prisma.caseProsecutor.create({
            data: {
              caseId: createdCase.id,
              userId: prosecutor.id
            }
          });
        }
      }
    }

    // Assign paralegal officers to case
    // 80% get assigned (99% of those get 1, 1% get 2), 20% remain unassigned
    const shouldAssignParalegal = faker.number.float({ min: 0, max: 1 }) >= 0.20;

    if (shouldAssignParalegal) {
      const paralegalAssignmentChoice = faker.number.float({ min: 0, max: 1 });
      const numParalegals = paralegalAssignmentChoice < 0.99 ? 1 : 2;

      // Get paralegal officers from this case's unit
      const unitParalegals = users.filter(u =>
        u.role === 'Paralegal officer' && u.units.some(uu => uu.unitId === caseUnitId)
      );

      if (unitParalegals.length > 0) {
        const assignedParalegals = faker.helpers.arrayElements(unitParalegals, Math.min(numParalegals, unitParalegals.length));
        for (const paralegal of assignedParalegals) {
          await prisma.caseParalegalOfficer.create({
            data: {
              caseId: createdCase.id,
              userId: paralegal.id
            }
          });
        }
      }
    }

    // -------------------- Hearings --------------------
    // 50% of cases have 1 hearing, 50% have none
    const hasHearing = faker.datatype.boolean();

    if (hasHearing) {
      const hearingStatus = faker.helpers.arrayElement(['Fixed', 'Warned', 'Estimated']);
      const hearingType = 'First hearing';
      const hearingVenue = faker.helpers.arrayElement(venues);

      // Distribution: 40% today, 40% tomorrow, 20% future dates
      const dateChoice = faker.number.float({ min: 0, max: 1 });
      let hearingStartDate;

      if (dateChoice < 0.4) {
        // Today at 10am
        hearingStartDate = new Date();
        hearingStartDate.setUTCHours(10, 0, 0, 0);
      } else if (dateChoice < 0.8) {
        // Tomorrow at 10am
        hearingStartDate = new Date();
        hearingStartDate.setDate(hearingStartDate.getDate() + 1);
        hearingStartDate.setUTCHours(10, 0, 0, 0);
      } else {
        // Future date at 10am
        hearingStartDate = futureDateAt10am();
      }

      // 10% chance of multi-day hearing (has endDate)
      const isMultiDay = faker.datatype.boolean({ probability: 0.10 });
      const hearingEndDate = isMultiDay
        ? new Date(hearingStartDate.getTime() + (faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000))
        : null;

      if (hearingEndDate) {
        hearingEndDate.setUTCHours(16, 0, 0, 0); // End at 4pm
      }

      await prisma.hearing.create({
        data: {
          startDate: hearingStartDate,
          endDate: hearingEndDate,
          status: hearingStatus,
          type: hearingType,
          venue: hearingVenue,
          caseId: createdCase.id
        }
      });
    }

    // -------------------- Witnesses --------------------
    const numWitnesses = faker.number.int({ min: 1, max: 7 });
    for (let w = 0; w < numWitnesses; w++) {
      // Generate witness types with realistic distribution (most have 0-3 types)
      const allTypes = [
        "isVictim",
        "isKeyWitness",
        "isChild",
        "isExpert",
        "isInterpreter",
        "isPolice",
        "isProfessional",
        "isPrisoner",
        "isVulnerable",
        "isIntimidated"
      ];

      // Weighted selection for number of types (most witnesses have 0-3)
      const numTypesWeighted = faker.helpers.weightedArrayElement([
        { weight: 30, value: 0 },
        { weight: 30, value: 1 },
        { weight: 25, value: 2 },
        { weight: 10, value: 3 },
        { weight: 4, value: 4 },
        { weight: 1, value: 5 }
      ]);

      // Select random types
      const selectedTypes = faker.helpers.arrayElements(allTypes, numTypesWeighted);

      // Build witness type object (all false by default, then set selected to true)
      const witnessTypes = {
        isVictim: selectedTypes.includes("isVictim"),
        isKeyWitness: selectedTypes.includes("isKeyWitness"),
        isChild: selectedTypes.includes("isChild"),
        isExpert: selectedTypes.includes("isExpert"),
        isInterpreter: selectedTypes.includes("isInterpreter"),
        isPolice: selectedTypes.includes("isPolice"),
        isProfessional: selectedTypes.includes("isProfessional"),
        isPrisoner: selectedTypes.includes("isPrisoner"),
        isVulnerable: selectedTypes.includes("isVulnerable"),
        isIntimidated: selectedTypes.includes("isIntimidated")
      };

      // Randomly assign dcf (50/50 split between new and old architecture)
      const isDcf = faker.datatype.boolean();

      const createdWitness = await prisma.witness.create({
        data: {
          title: faker.helpers.arrayElement([null, "Mr", "Mrs", "Ms", "Dr", "Prof"]),
          firstName: faker.helpers.arrayElement(firstNames),
          lastName: faker.helpers.arrayElement(lastNames),
          dateOfBirth: faker.date.birthdate({ min: 18, max: 90, mode: "age" }),
          gender: faker.helpers.arrayElement(["Male", "Female", "Unknown"]),
          ethnicity: faker.helpers.arrayElement([
            null,
            "White",
            "Asian_or_Asian_British",
            "Black_or_Black_British",
            "Mixed",
            "Other",
            "Prefer_not_to_say"
          ]),
          preferredLanguage: faker.helpers.arrayElement(["English", "Welsh"]),
          isCpsContactAllowed: faker.datatype.boolean(),
          addressLine1: faker.helpers.arrayElement([null, faker.location.streetAddress()]),
          addressLine2: faker.helpers.arrayElement([null, faker.location.secondaryAddress()]),
          addressTown: faker.helpers.arrayElement([null, faker.helpers.arrayElement(ukCities)]),
          addressPostcode: faker.helpers.arrayElement([null, faker.location.zipCode("WD# #SF")]),
          mobileNumber: faker.helpers.arrayElement([null, generateUKMobileNumber()]),
          emailAddress: faker.helpers.arrayElement([null, faker.internet.email()]),
          preferredContactMethod: faker.helpers.arrayElement([null, "Email", "Phone", "Post"]),
          faxNumber: faker.helpers.arrayElement([null, generateUKLandlineNumber()]),
          homeNumber: faker.helpers.arrayElement([null, generateUKLandlineNumber()]),
          workNumber: faker.helpers.arrayElement([null, generateUKPhoneNumber()]),
          otherNumber: faker.helpers.arrayElement([null, generateUKPhoneNumber()]),
          ...witnessTypes,
          isAppearingInCourt: faker.helpers.arrayElement([false, null]),
          isRelevant: faker.datatype.boolean(),
          attendanceIssues: faker.helpers.arrayElement([
            null,
            faker.lorem.sentence(),
          ]),
          previousTransgressions: faker.helpers.arrayElement([
            null,
            faker.lorem.sentence(),
          ]),
          wasWarned: faker.datatype.boolean(),
          dcf: isDcf,
          // Only set availability fields if dcf = true (new architecture)
          courtAvailabilityStartDate: isDcf ? faker.date.future() : null,
          courtAvailabilityEndDate: isDcf ? faker.date.future() : null,
          // Only set victim fields if witness is a victim
          victimCode: witnessTypes.isVictim ? "Learning disabilities" : null,
          victimExplained: witnessTypes.isVictim ? faker.datatype.boolean() : null,
          victimOfferResponse: witnessTypes.isVictim ? faker.helpers.arrayElement(["Not offered", "Declined", "Accepted"]) : null,
          caseId: createdCase.id,
        },
      });

      const numStatements = faker.number.int({ min: 1, max: 5 });
      for (let s = 0; s < numStatements; s++) {
        await prisma.witnessStatement.create({
          data: {
            witnessId: createdWitness.id,
            number: s + 1,
            receivedDate: faker.date.past(),
            isUsedAsEvidence: faker.helpers.arrayElement([true, false, null]),
            isMarkedAsSection9: faker.helpers.arrayElement([true, false, null]),
          },
        });
      }

      // Create special measures if dcf = true (65% get 1, 10% get 2, 25% get 0)
      if (isDcf) {
        const numSpecialMeasures = faker.helpers.weightedArrayElement([
          { weight: 65, value: 1 },
          { weight: 10, value: 2 },
          { weight: 25, value: 0 }
        ]);

        const specialMeasureTypes = [
          "Screen Witness",
          "Pre-recorded Cross-examination (s.28)",
          "Evidence by Live Link",
          "Evidence in Private",
          "Removal of Wigs and Gowns",
          "Visually Recorded Interview",
          "Intermediary",
          "Aids to Communication"
        ];

        const meetingUrls = [
          "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example123",
          "https://zoom.us/j/1234567890",
          "https://meet.google.com/abc-defg-hij"
        ];

        // Select unique types for this witness
        const selectedTypes = faker.helpers.arrayElements(specialMeasureTypes, numSpecialMeasures);

        for (let sm = 0; sm < numSpecialMeasures; sm++) {
          const requiresMeeting = faker.datatype.boolean();

          await prisma.specialMeasure.create({
            data: {
              witnessId: createdWitness.id,
              type: selectedTypes[sm],
              details: faker.lorem.sentence(),
              needs: faker.lorem.sentence(),
              requiresMeeting: requiresMeeting,
              meetingUrl: requiresMeeting ? faker.helpers.arrayElement(meetingUrls) : null,
              hasAppliedForReportingRestrictions: faker.datatype.boolean(),
            },
          });
        }
      }
    }

    // -------------------- Notes --------------------
    // Add 0-3 notes to each case
    const numNotes = faker.number.int({ min: 0, max: 3 });
    for (let n = 0; n < numNotes; n++) {
      const noteContent = faker.helpers.arrayElement([
        "Spoke with the defendant's solicitor today. They are requesting additional time to review the evidence.",
        "Witness availability confirmed for the trial dates. All key witnesses will be present.",
        "Discussed the case with senior prosecutor. Agreed to pursue the more serious charge given the strength of evidence.",
        "Received updated forensic report. Results support our case significantly.",
        "Defense has indicated they may be willing to accept a plea deal. Awaiting formal proposal.",
        "Victim personal statement received and added to case file. Very compelling account.",
        "Court liaison confirmed hearing room availability. No conflicts with trial dates.",
        "Expert witness has reviewed the materials and confirmed availability to testify.",
        "Defense disclosure received today. Need to review carefully before next hearing.",
        "Case complexity assessment completed. Recommend upgrading to Level 4.",
        "Brief prepared for counsel. All materials compiled and sent electronically.",
        "Spoke with investigating officer. Additional evidence may be available from digital forensics.",
        "Victim expressed concerns about giving evidence in open court. Discussing special measures options.",
        "Received confirmation that all exhibits are properly logged and secured.",
        "Case conference scheduled for next week to discuss trial strategy with team."
      ]);

      await prisma.note.create({
        data: {
          content: noteContent,
          caseId: createdCase.id,
          userId: faker.helpers.arrayElement(users).id
        }
      });
    }

    // -------------------- Task Notes --------------------
    // Get all tasks for this case
    const caseTasks = await prisma.task.findMany({
      where: { caseId: createdCase.id }
    });

    for (const task of caseTasks) {
      // 25% no notes, 50% 1 note, 25% 3 notes
      const noteCountChoice = faker.helpers.weightedArrayElement([
        { weight: 25, value: 0 },
        { weight: 50, value: 1 },
        { weight: 25, value: 3 }
      ]);

      for (let n = 0; n < noteCountChoice; n++) {
        const description = faker.helpers.arrayElement(taskNoteDescriptions);

        // Create notes with timestamps spread out over the past
        const daysAgo = faker.number.int({ min: 1, max: 30 });
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        const randomUser = faker.helpers.arrayElement(users);

        await prisma.taskNote.create({
          data: {
            description,
            taskId: task.id,
            userId: randomUser.id,
            createdAt,
            updatedAt: createdAt
          }
        });
      }
    }

    createdCases.push({ id: createdCase.id });
  }

  console.log(`✅ Created ${createdCases.length} cases`);

  // -------------------- DGA Assignments --------------------
  const failureReasonsList = [
    "Breach failure - Charged by Police in breach of the Director's Guidance",
    "Disclosure failure - Disclosable unused material not provided",
    "Disclosure failure - Information about reasonable lines of inquiry insufficient",
    "Disclosure failure - Information about reasonable lines of inquiry not provided",
    "Disclosure failure - Rebuttable presumption material not provided",
    "Disclosure failure - Schedules of unused material not completed correctly",
    "Disclosure failure - Schedules of unused material not provided",
    "Evidential failure - Exhibit",
    "Evidential failure - Forensic",
    "Evidential failure - Medical evidence",
    "Evidential failure - Multi-media BWV not clipped",
    "Evidential failure - Multi-media BWV not in playable format",
    "Evidential failure - Multi-media BWV not provided",
    "Evidential failure - Multi-media CCTV not clipped",
    "Evidential failure - Multi-media CCTV not in playable format",
    "Evidential failure - Multi-media CCTV not provided",
    "Evidential failure - Multi-media Other not clipped",
    "Evidential failure - Multi-media Other not in playable format",
    "Evidential failure - Relevant orders/applications, details not provided",
    "Evidential failure - Statement(s)",
    "Victim and witness failure - Needs of the victim/witness special measures have not been considered or are inadequate",
    "Victim and witness failure - Victim and witness needs (not special measures related)",
    "Victim and witness failure - VPS - no information on whether VPS offered/not provided"
  ];

  await seedDGAAssignments(prisma, createdCases, {
    dgaTarget: DGA_TARGET,
    failureReasonsList
  });

  // -------------------- Guaranteed Tasks --------------------
  await seedGuaranteedTasks(prisma, users, taskNames);

  // Seed: Priority tasks to make sure each persona has priority tasks
  await seedPriorityTasks(prisma, taskNames);

  // -------------------- User-Specific Test Cases --------------------
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
