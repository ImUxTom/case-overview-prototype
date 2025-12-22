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
const charges = require("../app/data/charges.js");
const pleas = require("../app/data/pleas.js");
const ukCities = require("../app/data/uk-cities.js");
const taskNoteDescriptions = require("../app/data/task-note-descriptions.js");
const manualTaskNamesShort = require("../app/data/manual-task-names-short.js");
const manualTaskNamesLong = require("../app/data/manual-task-names-long.js");
const documentNames = require("../app/data/document-names.js");

// Seeds
const { seedAreas } = require("./seed-helpers/areas");
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
const { seedOctober2025DGAs } = require("./seed-helpers/dga-october-2025");
const { seedGeneralCases } = require("./seed-helpers/general-cases");
const { seedCaseNotes } = require("./seed-helpers/case-notes");
const { seedDirectionNotes } = require("./seed-helpers/direction-notes");
const { seedActivityLogs } = require("./seed-helpers/activity-logs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Seed: Areas
  await seedAreas(prisma);

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

  // Seed: DGA assignments (original - for all users including Veronica)
  await seedDGAAssignments(prisma, createdCases, {
    dgaTarget: DGA_TARGET
  });

  // Seed: October 2025 DGA cases (specific for units 3 and 4)
  await seedOctober2025DGAs(prisma);

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

  // Seed: Case notes
  await seedCaseNotes(prisma, users);

  // Seed: Direction notes
  await seedDirectionNotes(prisma, users);

  // Seed: Activity logs
  await seedActivityLogs(prisma, createdCases, users);

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
