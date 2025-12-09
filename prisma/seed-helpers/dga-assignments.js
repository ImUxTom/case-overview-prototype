const { faker } = require('@faker-js/faker');

async function seedDGAAssignments(prisma, cases, config) {
  const { dgaTarget, failureReasonsList } = config;

  // Select random cases for DGA assignment
  const dgaIds = new Set(
    faker.helpers.arrayElements(cases, dgaTarget).map((c) => c.id)
  );

  for (const c of cases) {
    if (dgaIds.has(c.id)) {
      // Create DGA
      const dga = await prisma.dGA.create({
        data: {
          caseId: c.id,
          reason: faker.lorem.sentence(),
          // outcome omitted → will be NULL
        },
      });

      // Create 1-5 failure reasons for this DGA
      const numFailureReasons = faker.number.int({ min: 1, max: 5 });
      const selectedReasons = faker.helpers.arrayElements(failureReasonsList, numFailureReasons);

      for (const reason of selectedReasons) {
        await prisma.dGAFailureReason.create({
          data: {
            dgaId: dga.id,
            reason: reason,
            outcome: null // All start as "Not started"
          }
        });
      }
    }
  }

  console.log(`✅ Assigned ${dgaTarget} cases needing DGA review with failure reasons`);
}

module.exports = {
  seedDGAAssignments
};
