const { faker } = require('@faker-js/faker');
const { generateUKMobileNumber, generateUKLandlineNumber, generateUKPhoneNumber } = require('./phone-numbers');
const {
  generateExpiredCTL,
  generateTodayCTL,
  generateTomorrowCTL,
  generateThisWeekCTL,
  generateNextWeekCTL,
  generateLaterCTL
} = require('./ctl-generators');
const {
  generateExpiredSTL,
  generateTodaySTL,
  generateTomorrowSTL,
  generateThisWeekSTL,
  generateNextWeekSTL,
  generateLaterSTL
} = require('./stl-generators');
const {
  generateExpiredPACE,
  generateLessThan1HourPACE,
  generateLessThan2HoursPACE,
  generateLessThan3HoursPACE,
  generateMoreThan3HoursPACE
} = require('./pace-generators');

// Helper function to create a test case with defendant, charge, and task
async function createTestCase(prisma, user, unitId, timeLimitType, rangeKey, generateFn, config) {
  const { defenceLawyers, charges, firstNames, lastNames, pleas, victims, types, complexities, taskNames, ukCities } = config;

  const defendant = await prisma.defendant.create({
    data: {
      firstName: faker.helpers.arrayElement(firstNames),
      lastName: faker.helpers.arrayElement(lastNames),
      gender: faker.helpers.arrayElement(["Male", "Female", "Unknown"]),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 75, mode: "age" }),
      remandStatus: "REMANDED_IN_CUSTODY",
      paceClock: timeLimitType === 'PACE' ? generateFn() : null,
      defenceLawyer: { connect: { id: faker.helpers.arrayElement(defenceLawyers).id } },
      charges: {
        create: {
          chargeCode: faker.helpers.arrayElement(charges).code,
          description: faker.helpers.arrayElement(charges).description,
          status: "Charged",
          offenceDate: faker.date.past(),
          plea: faker.helpers.arrayElement(pleas),
          particulars: faker.lorem.sentence(),
          custodyTimeLimit: timeLimitType === 'CTL' ? generateFn() : null,
          statutoryTimeLimit: timeLimitType === 'STL' ? generateFn() : null,
          isCount: false
        }
      }
    }
  });

  const victimIds = faker.helpers.arrayElements(victims, faker.number.int({ min: 1, max: 2 })).map(v => ({ id: v.id }));

  const _case = await prisma.case.create({
    data: {
      reference: `${faker.string.alphanumeric(4).toUpperCase()}-${faker.string.alphanumeric(8).toUpperCase()}`,
      type: faker.helpers.arrayElement(types),
      complexity: faker.helpers.arrayElement(complexities),
      unit: { connect: { id: unitId } },
      defendants: { connect: { id: defendant.id } },
      victims: { connect: victimIds }
    }
  });

  // Assign prosecutor or paralegal officer based on user role
  if (user.firstName === "Rachael") {
    await prisma.caseParalegalOfficer.create({
      data: {
        caseId: _case.id,
        userId: user.id
      }
    });
  } else if (user.firstName === "Simon") {
    await prisma.caseProsecutor.create({
      data: {
        caseId: _case.id,
        userId: user.id
      }
    });
  }

  // Create task for visibility
  const timeLimit = generateFn();
  await prisma.task.create({
    data: {
      name: faker.helpers.arrayElement(taskNames),
      reminderType: null,
      reminderDate: new Date(timeLimit.getTime() - 3 * 24 * 60 * 60 * 1000),
      dueDate: timeLimit,
      escalationDate: new Date(timeLimit.getTime() + 2 * 24 * 60 * 60 * 1000),
      completedDate: null,
      caseId: _case.id,
      assignedToUserId: user.id
    }
  });

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
        caseId: _case.id,
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
        "Communication Aids"
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

  return _case;
}

async function seedUserSpecificTestCases(prisma, dependencies, config) {
  const { defenceLawyers, victims } = dependencies;
  const { charges, firstNames, lastNames, pleas, types, complexities, taskNames, ukCities } = config;

  // Find Rachael Harvey and Simon Whatley
  const rachaelHarvey = await prisma.user.findFirst({
    where: { firstName: "Rachael", lastName: "Harvey" }
  });

  const simonWhatley = await prisma.user.findFirst({
    where: { firstName: "Simon", lastName: "Whatley" }
  });

  const testUsers = [
    { user: rachaelHarvey, units: [3, 4] },
    { user: simonWhatley, units: [9, 11, 13, 18] }
  ];

  const testCases = [
    // CTL
    { type: 'CTL', range: 'Expired', fn: generateExpiredCTL },
    { type: 'CTL', range: 'Today', fn: generateTodayCTL },
    { type: 'CTL', range: 'Tomorrow', fn: generateTomorrowCTL },
    { type: 'CTL', range: 'ThisWeek', fn: generateThisWeekCTL },
    { type: 'CTL', range: 'NextWeek', fn: generateNextWeekCTL },
    { type: 'CTL', range: 'Later', fn: generateLaterCTL },
    // STL
    { type: 'STL', range: 'Expired', fn: generateExpiredSTL },
    { type: 'STL', range: 'Today', fn: generateTodaySTL },
    { type: 'STL', range: 'Tomorrow', fn: generateTomorrowSTL },
    { type: 'STL', range: 'ThisWeek', fn: generateThisWeekSTL },
    { type: 'STL', range: 'NextWeek', fn: generateNextWeekSTL },
    { type: 'STL', range: 'Later', fn: generateLaterSTL },
    // PACE
    { type: 'PACE', range: 'Expired', fn: generateExpiredPACE },
    { type: 'PACE', range: '<1hr', fn: generateLessThan1HourPACE },
    { type: 'PACE', range: '<2hrs', fn: generateLessThan2HoursPACE },
    { type: 'PACE', range: '<3hrs', fn: generateLessThan3HoursPACE },
    { type: 'PACE', range: '>3hrs', fn: generateMoreThan3HoursPACE }
  ];

  const fullConfig = {
    defenceLawyers,
    charges,
    firstNames,
    lastNames,
    pleas,
    victims,
    types,
    complexities,
    taskNames,
    ukCities
  };

  for (const { user, units } of testUsers) {
    for (let i = 0; i < testCases.length; i++) {
      const { type, range, fn } = testCases[i];
      const unitId = units[i % units.length];

      await createTestCase(prisma, user, unitId, type, range, fn, fullConfig);
    }
    console.log(`✅ Created 17 guaranteed test cases for ${user.firstName} ${user.lastName}`);
  }
}

module.exports = {
  seedUserSpecificTestCases
};
