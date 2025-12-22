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

async function seedOctober2025DGAs(prisma) {
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

  // Specific police units for guaranteed October 2025 cases with different states
  const guaranteedPoliceUnits = [
    {
      name: 'Metropolitan Police',
      state: 'not-started', // Not sent to police, no outcomes recorded
      sentToPoliceDate: null
    },
    {
      name: 'Thames Valley Police',
      state: 'in-progress', // Sent to police, some outcomes recorded
      sentToPoliceDate: new Date(2025, 11, 1) // Dec 1, 2025
    },
    {
      name: 'West Midlands Police',
      state: 'completed', // Sent to police, all outcomes recorded
      sentToPoliceDate: new Date(2025, 10, 25) // Nov 25, 2025
    }
  ];

  // Specific CPS units to ensure coverage (units 3 and 4 are commonly used by test users)
  const targetCpsUnits = [3, 4];

  // Fetch cases from database with policeUnit field and in target CPS units
  const casesInTargetUnits = await prisma.case.findMany({
    where: {
      unitId: { in: targetCpsUnits }
    },
    select: {
      id: true,
      unitId: true,
      policeUnit: true
    }
  });

  // Create guaranteed October 2025 cases (3 cases per police unit = 9 total)
  const october2025Cases = [];

  // Possible outcomes for completed/in-progress cases
  const outcomes = ['Not disputed', 'Disputed successfully', 'Disputed unsuccessfully'];

  for (const policeUnitConfig of guaranteedPoliceUnits) {
    const policeUnitName = policeUnitConfig.name;
    const state = policeUnitConfig.state;
    const sentToPoliceDate = policeUnitConfig.sentToPoliceDate;

    // Find cases with this police unit
    const casesWithPoliceUnit = casesInTargetUnits.filter(c => c.policeUnit === policeUnitName);

    const selectedCases = faker.helpers.arrayElements(casesWithPoliceUnit, Math.min(3, casesWithPoliceUnit.length));

    for (const caseItem of selectedCases) {
      // Set non-compliant date to October 2025
      const nonCompliantDate = new Date(2025, 9, faker.number.int({ min: 1, max: 31 })); // Month 9 = October
      const reportDeadline = calculateDeadline(nonCompliantDate);

      // Create DGA
      const dga = await prisma.dGA.create({
        data: {
          caseId: caseItem.id,
          reason: faker.lorem.sentence(),
          nonCompliantDate: nonCompliantDate,
          reportDeadline: reportDeadline,
          sentToPoliceDate: sentToPoliceDate, // Set based on police unit config
        },
      });

      // Create 1-5 failure reasons for this DGA
      const numFailureReasons = faker.number.int({ min: 1, max: 5 });
      const selectedReasons = faker.helpers.arrayElements(failureReasonsList, numFailureReasons);

      const createdFailureReasons = [];

      for (let i = 0; i < selectedReasons.length; i++) {
        const reason = selectedReasons[i];
        let outcome = null;

        // Set outcomes based on state
        if (state === 'completed') {
          // All failure reasons have outcomes
          outcome = faker.helpers.arrayElement(outcomes);
        } else if (state === 'in-progress') {
          // 50% chance each failure reason has an outcome
          outcome = faker.datatype.boolean() ? faker.helpers.arrayElement(outcomes) : null;
        }
        // else state === 'not-started', outcome stays null

        const failureReason = await prisma.dGAFailureReason.create({
          data: {
            dgaId: dga.id,
            reason: reason,
            outcome: outcome,
            // Set details and methods if outcome is disputed
            details: outcome && outcome !== 'Not disputed' ? faker.lorem.paragraph() : null,
            methods: outcome && outcome !== 'Not disputed' ? faker.helpers.arrayElements(['Email', 'Phone', 'Letter'], faker.number.int({ min: 1, max: 2 })).join(', ') : null
          }
        });

        createdFailureReasons.push(failureReason);
      }

      // Update case reportStatus based on failure reason outcomes
      const totalReasons = createdFailureReasons.length;
      const completedReasons = createdFailureReasons.filter(fr => fr.outcome !== null).length;

      let reportStatus = null;
      if (completedReasons === totalReasons && totalReasons > 0) {
        reportStatus = 'Completed';
      } else if (completedReasons > 0) {
        reportStatus = 'In progress';
      }

      await prisma.case.update({
        where: { id: caseItem.id },
        data: { reportStatus }
      });

      october2025Cases.push(caseItem.id);
    }
  }

  console.log(`✅ Created ${october2025Cases.length} October 2025 DGA cases`);
  return october2025Cases;
}

module.exports = {
  seedOctober2025DGAs
};
