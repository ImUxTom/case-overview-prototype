const { faker } = require('@faker-js/faker');
const { generateCaseReference } = require('./identifiers');
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

const SIMON_UNITS = {
  NORTH_YORKSHIRE_MAGISTRATES_COURT: 9,
  SOUTH_YORKSHIRE_MAGISTRATES_COURT: 11,
  WEST_YORKSHIRE_MAGISTRATES_COURT: 13,
  HUMBERSIDE_MAGISTRATES_COURT: 18
};

async function createWitness(prisma, caseId, config) {
  const { firstNames, lastNames, ukCities } = config;

  const allTypes = [
    "isVictim", "isKeyWitness", "isChild", "isExpert", "isInterpreter",
    "isPolice", "isProfessional", "isPrisoner", "isVulnerable", "isIntimidated"
  ];

  const numTypesWeighted = faker.helpers.weightedArrayElement([
    { weight: 30, value: 0 },
    { weight: 30, value: 1 },
    { weight: 25, value: 2 },
    { weight: 10, value: 3 },
    { weight: 4, value: 4 },
    { weight: 1, value: 5 }
  ]);

  const selectedTypes = faker.helpers.arrayElements(allTypes, numTypesWeighted);

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

  const isDcf = faker.datatype.boolean();

  const witness = await prisma.witness.create({
    data: {
      title: faker.helpers.arrayElement([null, "Mr", "Mrs", "Ms", "Dr", "Prof"]),
      firstName: faker.helpers.arrayElement(firstNames),
      lastName: faker.helpers.arrayElement(lastNames),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 90, mode: "age" }),
      gender: faker.helpers.arrayElement(["Male", "Female", "Unknown"]),
      ethnicity: faker.helpers.arrayElement([
        null, "White", "Asian_or_Asian_British", "Black_or_Black_British",
        "Mixed", "Other", "Prefer_not_to_say"
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
      attendanceIssues: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
      previousTransgressions: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
      wasWarned: faker.datatype.boolean(),
      dcf: isDcf,
      courtAvailabilityStartDate: isDcf ? faker.date.future() : null,
      courtAvailabilityEndDate: isDcf ? faker.date.future() : null,
      victimCode: witnessTypes.isVictim ? "Learning disabilities" : null,
      victimExplained: witnessTypes.isVictim ? faker.datatype.boolean() : null,
      victimOfferResponse: witnessTypes.isVictim ? faker.helpers.arrayElement(["Not offered", "Declined", "Accepted"]) : null,
      caseId: caseId,
    },
  });

  return { witness, isDcf };
}

async function createWitnessStatements(prisma, witnessId, numStatements) {
  for (let s = 0; s < numStatements; s++) {
    await prisma.witnessStatement.create({
      data: {
        witnessId: witnessId,
        number: s + 1,
        receivedDate: faker.date.past(),
        isUsedAsEvidence: faker.helpers.arrayElement([true, false, null]),
        isMarkedAsSection9: faker.helpers.arrayElement([true, false, null]),
      },
    });
  }
}

async function createSpecialMeasures(prisma, witnessId) {
  const numSpecialMeasures = faker.helpers.weightedArrayElement([
    { weight: 65, value: 1 },
    { weight: 10, value: 2 },
    { weight: 25, value: 0 }
  ]);

  const specialMeasureTypes = [
    "Screen Witness", "Pre-recorded Cross-examination (s.28)", "Evidence by Live Link",
    "Evidence in Private", "Removal of Wigs and Gowns", "Visually Recorded Interview",
    "Intermediary", "Communication Aids"
  ];

  const meetingUrls = [
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example123",
    "https://zoom.us/j/1234567890",
    "https://meet.google.com/abc-defg-hij"
  ];

  const selectedTypes = faker.helpers.arrayElements(specialMeasureTypes, numSpecialMeasures);

  for (let sm = 0; sm < numSpecialMeasures; sm++) {
    const requiresMeeting = faker.datatype.boolean();
    await prisma.specialMeasure.create({
      data: {
        witnessId: witnessId,
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

async function createTimeLimitTestCase(prisma, user, unitId, timeLimitType, generateFn, config) {
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
      reference: generateCaseReference(),
      type: faker.helpers.arrayElement(types),
      complexity: faker.helpers.arrayElement(complexities),
      unit: { connect: { id: unitId } },
      defendants: { connect: { id: defendant.id } },
      victims: { connect: victimIds }
    }
  });

  await prisma.caseProsecutor.create({
    data: {
      caseId: _case.id,
      userId: user.id
    }
  });

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

  // Create 1-7 witnesses with 1-5 statements each
  const numWitnesses = faker.number.int({ min: 1, max: 7 });
  for (let w = 0; w < numWitnesses; w++) {
    const { witness, isDcf } = await createWitness(prisma, _case.id, config);
    const numStatements = faker.number.int({ min: 1, max: 5 });
    await createWitnessStatements(prisma, witness.id, numStatements);
    if (isDcf) {
      await createSpecialMeasures(prisma, witness.id);
    }
  }

  return _case;
}

async function createManyStatementsCase(prisma, user, config) {
  const { defenceLawyers, charges, firstNames, lastNames, pleas, victims, types, complexities, taskNames, ukCities } = config;

  const defendant = await prisma.defendant.create({
    data: {
      firstName: faker.helpers.arrayElement(firstNames),
      lastName: faker.helpers.arrayElement(lastNames),
      gender: faker.helpers.arrayElement(["Male", "Female", "Unknown"]),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 75, mode: "age" }),
      remandStatus: "REMANDED_IN_CUSTODY",
      paceClock: null,
      defenceLawyer: { connect: { id: faker.helpers.arrayElement(defenceLawyers).id } },
      charges: {
        create: {
          chargeCode: faker.helpers.arrayElement(charges).code,
          description: faker.helpers.arrayElement(charges).description,
          status: "Charged",
          offenceDate: faker.date.past(),
          plea: faker.helpers.arrayElement(pleas),
          particulars: faker.lorem.sentence(),
          custodyTimeLimit: null,
          statutoryTimeLimit: null,
          isCount: false
        }
      }
    }
  });

  const victimIds = faker.helpers.arrayElements(victims, faker.number.int({ min: 1, max: 2 })).map(v => ({ id: v.id }));

  const _case = await prisma.case.create({
    data: {
      reference: '99SW100001/1',
      type: faker.helpers.arrayElement(types),
      complexity: faker.helpers.arrayElement(complexities),
      unit: { connect: { id: SIMON_UNITS.NORTH_YORKSHIRE_MAGISTRATES_COURT } },
      defendants: { connect: { id: defendant.id } },
      victims: { connect: victimIds }
    }
  });

  await prisma.caseProsecutor.create({
    data: {
      caseId: _case.id,
      userId: user.id
    }
  });

  const dueDate = faker.date.soon({ days: 14 });
  await prisma.task.create({
    data: {
      name: faker.helpers.arrayElement(taskNames),
      reminderType: null,
      reminderDate: new Date(dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
      dueDate: dueDate,
      escalationDate: new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      completedDate: null,
      caseId: _case.id,
      assignedToUserId: user.id
    }
  });

  // Create 5 witnesses: first one has 10 statements, others have 0-2
  // For this special case: isAppearingInCourt = null, isMarkedAsSection9 = null (user will set these)
  for (let w = 0; w < 5; w++) {
    const { witness, isDcf } = await createWitness(prisma, _case.id, config);

    // Set isAppearingInCourt to null for user to decide
    await prisma.witness.update({
      where: { id: witness.id },
      data: { isAppearingInCourt: null }
    });

    // Create statements with isMarkedAsSection9 = null for user to decide
    const numStatements = w === 0 ? 10 : faker.number.int({ min: 0, max: 2 });
    for (let s = 0; s < numStatements; s++) {
      await prisma.witnessStatement.create({
        data: {
          witnessId: witness.id,
          number: s + 1,
          receivedDate: faker.date.past(),
          isUsedAsEvidence: faker.helpers.arrayElement([true, false, null]),
          isMarkedAsSection9: null,
        },
      });
    }

    if (isDcf) {
      await createSpecialMeasures(prisma, witness.id);
    }
  }

  return _case;
}

async function seedSimonCases(prisma, dependencies, config) {
  const { defenceLawyers, victims } = dependencies;
  const { charges, firstNames, lastNames, pleas, types, complexities, taskNames, ukCities } = config;

  const simonWhatley = await prisma.user.findFirst({
    where: { firstName: "Simon", lastName: "Whatley" }
  });

  if (!simonWhatley) {
    console.log('⚠️ Simon Whatley not found, skipping Simon cases');
    return;
  }

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

  const testCases = [
    // CTL
    { type: 'CTL', fn: generateExpiredCTL },
    { type: 'CTL', fn: generateTodayCTL },
    { type: 'CTL', fn: generateTomorrowCTL },
    { type: 'CTL', fn: generateThisWeekCTL },
    { type: 'CTL', fn: generateNextWeekCTL },
    { type: 'CTL', fn: generateLaterCTL },
    // STL
    { type: 'STL', fn: generateExpiredSTL },
    { type: 'STL', fn: generateTodaySTL },
    { type: 'STL', fn: generateTomorrowSTL },
    { type: 'STL', fn: generateThisWeekSTL },
    { type: 'STL', fn: generateNextWeekSTL },
    { type: 'STL', fn: generateLaterSTL },
    // PACE
    { type: 'PACE', fn: generateExpiredPACE },
    { type: 'PACE', fn: generateLessThan1HourPACE },
    { type: 'PACE', fn: generateLessThan2HoursPACE },
    { type: 'PACE', fn: generateLessThan3HoursPACE },
    { type: 'PACE', fn: generateMoreThan3HoursPACE }
  ];

  const units = [
    SIMON_UNITS.NORTH_YORKSHIRE_MAGISTRATES_COURT,
    SIMON_UNITS.SOUTH_YORKSHIRE_MAGISTRATES_COURT,
    SIMON_UNITS.WEST_YORKSHIRE_MAGISTRATES_COURT,
    SIMON_UNITS.HUMBERSIDE_MAGISTRATES_COURT
  ];

  // Create 17 time limit test cases
  for (let i = 0; i < testCases.length; i++) {
    const { type, fn } = testCases[i];
    const unitId = units[i % units.length];
    await createTimeLimitTestCase(prisma, simonWhatley, unitId, type, fn, fullConfig);
  }

  // Create the 10-statements case (5 witnesses, one with 10 statements)
  await createManyStatementsCase(prisma, simonWhatley, fullConfig);

  console.log(`✅ Created 17 time limit test cases + 1 special case (10 statements) for Simon Whatley`);
}

module.exports = {
  seedSimonCases
};
