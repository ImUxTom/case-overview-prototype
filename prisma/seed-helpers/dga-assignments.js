const { faker } = require('@faker-js/faker');

async function seedDGAAssignments(prisma, cases, config) {
  const { dgaTarget } = config;

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
