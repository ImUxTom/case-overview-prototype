const { faker } = require('@faker-js/faker');

// Helper: Calculate deadline as end of month + 6 weeks
function calculateDeadline(nonCompliantDate) {
  const date = new Date(nonCompliantDate);

  // Get last day of the month
  const year = date.getFullYear();
  const month = date.getMonth();
  const endOfMonth = new Date(year, month + 1, 0); // Day 0 of next month = last day of current month

  // Add 6 weeks (42 days)
  const deadline = new Date(endOfMonth);
  deadline.setDate(deadline.getDate() + 42);

  return deadline;
}

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

  // Select random cases for DGA assignment (original behavior)
  const dgaIds = new Set(
    faker.helpers.arrayElements(cases, dgaTarget).map((c) => c.id)
  );

  for (const c of cases) {
    if (dgaIds.has(c.id)) {
      // Generate non-compliant date between 3-6 months ago
      const monthsAgo = faker.number.int({ min: 3, max: 6 });
      const nonCompliantDate = new Date();
      nonCompliantDate.setMonth(nonCompliantDate.getMonth() - monthsAgo);
      // Set to a random day in that month
      nonCompliantDate.setDate(faker.number.int({ min: 1, max: 28 }));

      // Calculate deadline: end of month + 6 weeks
      const reportDeadline = calculateDeadline(nonCompliantDate);

      // Create DGA with dates
      const dga = await prisma.dGA.create({
        data: {
          caseId: c.id,
          reason: faker.lorem.sentence(),
          nonCompliantDate: nonCompliantDate,
          reportDeadline: reportDeadline,
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

  console.log(`✅ Assigned ${dgaTarget} cases needing DGA review (general seeding)`);
}

module.exports = {
  seedDGAAssignments
};
