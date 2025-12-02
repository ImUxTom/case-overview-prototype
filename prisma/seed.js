const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { faker } = require("@faker-js/faker");
const complexities = require("../app/data/complexities.js");
const firstNames = require("../app/data/first-names.js");
const lastNames = require("../app/data/last-names.js");
const types = require("../app/data/types.js");
const taskNames = require("../app/data/task-names.js");
const documentTypes = require("../app/data/document-types.js");
const specialisms = require("../app/data/specialisms.js");
const hearingTypes = require("../app/data/hearing-types.js");
const venues = require("../app/data/venues.js");

const prisma = new PrismaClient();

const ukCities = [
  "London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool",
  "Newcastle", "Sheffield", "Bristol", "Edinburgh", "Leicester", "Coventry",
  "Bradford", "Cardiff", "Belfast", "Nottingham", "Kingston upon Hull",
  "Plymouth", "Stoke-on-Trent", "Wolverhampton", "Derby", "Southampton",
  "Portsmouth", "Brighton", "Reading", "Northampton", "Luton", "Bolton",
  "Aberdeen", "Sunderland", "Dundee", "Norwich", "Ipswich", "York",
  "Swansea", "Oxford", "Cambridge", "Peterborough", "Gloucester", "Chester"
];

const religions = [
  "Christianity", "Islam", "Hinduism", "Sikhism", "Judaism", "Buddhism",
  "No religion", "Not stated", "Other"
];

const occupations = [
  "Unemployed", "Student", "Retail worker", "Construction worker", "Teacher",
  "Healthcare worker", "Office worker", "Self-employed", "Driver", "Engineer",
  "Hospitality worker", "Tradesperson", "IT professional", "Manager", "Retired"
];

const remandStatuses = [
  "UNCONDITIONAL_BAIL", "CONDITIONAL_BAIL", "REMANDED_IN_CUSTODY", "REMANDED_IN_SECURE_UNIT"
];

const charges = [
  { code: "B10", description: "THEFT, contrary to section 1(1) of the Theft Act 1968" },
  { code: "A01", description: "ASSAULT BY BEATING, contrary to section 39 of the Criminal Justice Act 1988" },
  { code: "C03", description: "CRIMINAL DAMAGE, contrary to section 1(1) of the Criminal Damage Act 1971" },
  { code: "D05", description: "POSSESSION OF A CONTROLLED DRUG (Class B), contrary to section 5(2) of the Misuse of Drugs Act 1971" },
  { code: "D06", description: "POSSESSION WITH INTENT TO SUPPLY A CONTROLLED DRUG (Class A), contrary to section 5(3) of the Misuse of Drugs Act 1971" },
  { code: "F02", description: "FRAUD BY FALSE REPRESENTATION, contrary to section 1 of the Fraud Act 2006" },
  { code: "H01", description: "HARASSMENT, contrary to section 2 of the Protection from Harassment Act 1997" },
  { code: "M01", description: "COMMON ASSAULT, contrary to section 39 of the Criminal Justice Act 1988" },
  { code: "R01", description: "ROBBERY, contrary to section 8(1) of the Theft Act 1968" },
  { code: "V01", description: "DRIVING WHILST DISQUALIFIED, contrary to section 103(1)(b) of the Road Traffic Act 1988" },
  { code: "W01", description: "POSSESSION OF AN OFFENSIVE WEAPON, contrary to section 1 of the Prevention of Crime Act 1953" },
  { code: "B11", description: "BURGLARY, contrary to section 9(1)(a) of the Theft Act 1968" },
  { code: "A02", description: "ACTUAL BODILY HARM, contrary to section 47 of the Offences Against the Person Act 1861" },
  { code: "T01", description: "THREATENING BEHAVIOUR, contrary to section 4 of the Public Order Act 1986" }
];

const chargeStatuses = [
  "Charged", "Under review", "Proceeded", "Discontinued", "Amended"
];

const pleas = ["NOT_GUILTY", "GUILTY", "NO_PLEA", "NOT_INDICATED"];

const defenceLawyerOrganisations = [
  "Smith & Co Solicitors", "Jones Legal LLP", "Brown Associates", "Wilson & Partners",
  "Taylor Law Firm", "Davies Solicitors", "Evans Legal Services", "Thomas & Associates",
  "Roberts Law", "Johnson Legal LLP", "Williams Solicitors", "Anderson & Co",
  "White Legal Services", "Martin & Partners", "Thompson Law Firm", "Jackson Solicitors"
];

function generateUKMobileNumber() {
  // UK mobile numbers: 07 + 9 digits (07XXXXXXXXX)
  return `07${faker.string.numeric(9)}`;
}

function generateUKLandlineNumber() {
  // Mix of geographic (01XXX XXXXXX) and major city (020 XXXX XXXX) numbers
  const type = faker.helpers.arrayElement(['geographic', 'london', 'major']);

  if (type === 'london') {
    // London: 020 + 8 digits
    return `020${faker.string.numeric(8)}`;
  } else if (type === 'major') {
    // Major cities (Manchester 0161, Birmingham 0121, etc.): 01XX + 7 digits
    const areaCode = faker.helpers.arrayElement(['0161', '0121', '0131', '0141', '0113', '0114', '0117', '0151']);
    return `${areaCode}${faker.string.numeric(7)}`;
  } else {
    // Geographic: 01XXX + 6 digits
    return `01${faker.string.numeric(3)}${faker.string.numeric(6)}`;
  }
}

function generateUKPhoneNumber() {
  // Mix of mobile and landline for general phone numbers
  return faker.helpers.arrayElement([generateUKMobileNumber(), generateUKLandlineNumber()]);
}

function futureDateAt10am() {
  const d = faker.date.future();
  d.setHours(10, 0, 0, 0);
  return d;
}

function getOverdueDate() {
  // Returns a date 2-7 days in the past at 23:59:59.999 UTC
  const daysAgo = faker.number.int({ min: 2, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function getTodayDate() {
  // Returns today at 23:59:59.999 UTC
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function getTomorrowDate() {
  // Returns tomorrow at 23:59:59.999 UTC
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Helper functions for generating task dates in different states
function generatePendingTaskDates() {
  // Pending: all dates in the future
  const reminderDate = faker.date.soon({ days: 14 }); // 0-14 days from now
  const daysUntilDue = faker.number.int({ min: 3, max: 7 });
  const dueDate = new Date(reminderDate);
  dueDate.setDate(dueDate.getDate() + daysUntilDue);

  const daysUntilEscalation = faker.number.int({ min: 3, max: 7 });
  const escalationDate = new Date(dueDate);
  escalationDate.setDate(escalationDate.getDate() + daysUntilEscalation);

  reminderDate.setUTCHours(23, 59, 59, 999);
  dueDate.setUTCHours(23, 59, 59, 999);
  escalationDate.setUTCHours(23, 59, 59, 999);

  return { reminderDate, dueDate, escalationDate };
}

function generateDueTaskDates() {
  // Due: reminder date has passed, due date in future
  const daysAgo = faker.number.int({ min: 1, max: 3 });
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() - daysAgo);

  const daysUntilDue = faker.number.int({ min: 2, max: 5 });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysUntilDue);

  const daysUntilEscalation = faker.number.int({ min: 3, max: 7 });
  const escalationDate = new Date(dueDate);
  escalationDate.setDate(escalationDate.getDate() + daysUntilEscalation);

  reminderDate.setUTCHours(23, 59, 59, 999);
  dueDate.setUTCHours(23, 59, 59, 999);
  escalationDate.setUTCHours(23, 59, 59, 999);

  return { reminderDate, dueDate, escalationDate };
}

function generateOverdueTaskDates() {
  // Overdue: due date has passed, escalation date in future
  const daysAgo = faker.number.int({ min: 2, max: 7 });
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() - daysAgo - 5);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - daysAgo);

  const daysUntilEscalation = faker.number.int({ min: 2, max: 5 });
  const escalationDate = new Date();
  escalationDate.setDate(escalationDate.getDate() + daysUntilEscalation);

  reminderDate.setUTCHours(23, 59, 59, 999);
  dueDate.setUTCHours(23, 59, 59, 999);
  escalationDate.setUTCHours(23, 59, 59, 999);

  return { reminderDate, dueDate, escalationDate };
}

function generateEscalatedTaskDates() {
  // Escalated: all dates have passed
  const daysAgo = faker.number.int({ min: 3, max: 10 });
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() - daysAgo - 7);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - daysAgo - 3);

  const escalationDate = new Date();
  escalationDate.setDate(escalationDate.getDate() - daysAgo);

  reminderDate.setUTCHours(23, 59, 59, 999);
  dueDate.setUTCHours(23, 59, 59, 999);
  escalationDate.setUTCHours(23, 59, 59, 999);

  return { reminderDate, dueDate, escalationDate };
}

function generateCaseReference() {
  const twoDigits = faker.number.int({ min: 10, max: 99 });
  const twoLetters = faker.string.alpha({ count: 2, casing: "upper" });
  const sixDigits = faker.number.int({ min: 100000, max: 999999 });
  const suffix = faker.number.int({ min: 1, max: 9 });
  return `${twoDigits}${twoLetters}${sixDigits}/${suffix}`;
}

// Generate CTL between yesterday and 120 days from now
function generateCTL() {
  const daysFromNow = faker.number.int({ min: -1, max: 120 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expired 1-7 days ago
function generateExpiredCTL() {
  const daysAgo = faker.number.int({ min: 1, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expires today
function generateTodayCTL() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expires tomorrow
function generateTomorrowCTL() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expires this week (2-7 days from now)
function generateThisWeekCTL() {
  const daysFromNow = faker.number.int({ min: 2, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expires next week (8-14 days from now)
function generateNextWeekCTL() {
  const daysFromNow = faker.number.int({ min: 8, max: 14 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate CTL that expires later (15-120 days from now)
function generateLaterCTL() {
  const daysFromNow = faker.number.int({ min: 15, max: 120 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL between yesterday and 6 months (180 days) from now
function generateSTL() {
  const daysFromNow = faker.number.int({ min: -1, max: 180 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate PACE clock between yesterday and 24 hours from now
function generatePACEClock() {
  const hoursFromNow = faker.number.int({ min: -24, max: 24 });
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
}

// Generate PACE clock that expired 1-12 hours ago
function getOverduePACEClock() {
  const hoursAgo = faker.number.int({ min: 1, max: 12 });
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  return d;
}

// Generate PACE clock expiring within next 6 hours
function getTodayPACEClock() {
  const hoursFromNow = faker.number.int({ min: 1, max: 6 });
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
}

// Generate STL that expired 1-7 days ago
function getOverdueSTL() {
  const daysAgo = faker.number.int({ min: 1, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL expiring within next 7 days
function getUpcomingSTL() {
  const daysFromNow = faker.number.int({ min: 1, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expired 1-7 days ago
function generateExpiredSTL() {
  const daysAgo = faker.number.int({ min: 1, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expires today
function generateTodaySTL() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expires tomorrow
function generateTomorrowSTL() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expires this week (2-7 days from now)
function generateThisWeekSTL() {
  const daysFromNow = faker.number.int({ min: 2, max: 7 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expires next week (8-14 days from now)
function generateNextWeekSTL() {
  const daysFromNow = faker.number.int({ min: 8, max: 14 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate STL that expires later (15-180 days from now)
function generateLaterSTL() {
  const daysFromNow = faker.number.int({ min: 15, max: 180 });
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Generate PACE clock that expired 1-12 hours ago
function generateExpiredPACE() {
  const hoursAgo = faker.number.int({ min: 1, max: 12 });
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  return d;
}

// Generate PACE clock expiring in less than 1 hour (10-59 minutes)
function generateLessThan1HourPACE() {
  const minutesFromNow = faker.number.int({ min: 10, max: 59 });
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesFromNow);
  return d;
}

// Generate PACE clock expiring in 1-2 hours (60-119 minutes)
function generateLessThan2HoursPACE() {
  const minutesFromNow = faker.number.int({ min: 60, max: 119 });
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesFromNow);
  return d;
}

// Generate PACE clock expiring in 2-3 hours (120-179 minutes)
function generateLessThan3HoursPACE() {
  const minutesFromNow = faker.number.int({ min: 120, max: 179 });
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesFromNow);
  return d;
}

// Generate PACE clock expiring in more than 3 hours (3-24 hours)
function generateMoreThan3HoursPACE() {
  const hoursFromNow = faker.number.int({ min: 3, max: 24 });
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
}

const taskNoteDescriptions = [
  "Awaiting response from witness",
  "Documents requested from police",
  "Need to schedule meeting with CPS",
  "Awaiting lab results",
  "Defence has requested extension",
  "Victim contacted and updated",
  "Court date confirmed",
  "Evidence review in progress",
  "Waiting for legal advice",
  "Disclosure deadline approaching",
  "Expert witness report received",
  "Investigation officer contacted",
  "File review completed",
  "Additional evidence identified",
  "Defendant solicitor contacted",
  "Hearing preparation underway",
  "Statement being reviewed",
  "Timeline needs updating",
  "Case file being prepared",
  "Custody time limit noted"
];

const manualTaskNamesShort = [
  "Follow up with witness",
  "Review new evidence",
  "Contact defence solicitor",
  "Check court availability",
  "Update case file",
  "Prepare hearing bundle",
  "Consult with senior prosecutor",
  "Review forensic report",
  "Schedule case conference",
  "Update victim on progress",
  "Check disclosure obligations",
  "Prepare cross examination",
  "Review CCTV footage",
  "Contact expert witness",
  "Draft legal submissions"
];

const manualTaskNamesLong = [
  "Review and analyze all witness statements to identify any inconsistencies or gaps in evidence that need to be addressed before the next hearing",
  "Coordinate with the investigating officer to obtain additional forensic evidence and ensure all exhibits are properly catalogued and available for court",
  "Prepare comprehensive legal submissions addressing the admissibility of the disputed evidence and research relevant case law to support the prosecution position",
  "Conduct a full review of all disclosure material to ensure compliance with CPIA requirements and identify any material that may undermine the case or assist the defence",
  "Arrange and prepare for a case conference with counsel to discuss trial strategy, potential witnesses, and any legal issues that may arise during proceedings"
];

async function main() {
  console.log("🌱 Starting seed...");

  // -------------------- Units --------------------
  await prisma.unit.createMany({
    data: [
      // Wessex area units
      { name: "Dorset Magistrates Court" },
      { name: "Hampshire Magistrates Court" },
      { name: "Wessex Crown Court" },
      { name: "Wessex RASSO" },
      { name: "Wessex CCU" },
      { name: "Wessex Fraud" },
      { name: "Wiltshire Magistrates Court" },
      // Yorkshire and Humberside area units
      { name: "North Yorkshire Crown Court" },
      { name: "North Yorkshire Magistrates Court" },
      { name: "South Yorkshire Crown Court" },
      { name: "South Yorkshire Magistrates Court" },
      { name: "West Yorkshire Crown Court" },
      { name: "West Yorkshire Magistrates Court" },
      { name: "Yorkshire and Humberside CCU" },
      { name: "Yorkshire and Humberside RASSO" },
      { name: "Humberside South Yorkshire RASSO" },
      { name: "Humberside Crown Court" },
      { name: "Humberside Magistrates Court" },
    ],
  });
  console.log("✅ 18 units seeded");

  // -------------------- Teams --------------------
  const standardTeamNames = [
    "Admin pool",
    "Crown Court",
    "Magistrates Court General",
    "Magistrates Court Contested"
  ];

  for (let unitId = 1; unitId <= 18; unitId++) {
    await prisma.team.createMany({
      data: standardTeamNames.map(name => ({
        name,
        unitId,
        isStandard: true
      }))
    });
  }
  console.log("✅ 72 standard teams created (4 per unit)");

  // -------------------- Users --------------------
  const users = [];
  const userData = [
    {
      email: "reporting.admin@cps.gov.uk",
      password: "password123",
      role: "Reporting admin",
      firstName: "Veronica",
      lastName: "Mars",
    },
    {
      email: "adam@cps.gov.uk",
      password: "password123",
      role: "Paralegal officer",
      firstName: "Adam",
      lastName: "Silver",
    },
    {
      email: "rachael@cps.gov.uk",
      password: "password123",
      role: "Paralegal officer",
      firstName: "Rachael",
      lastName: "Harvey",
    },
    {
      email: "simon@cps.gov.uk",
      password: "password123",
      role: "Prosecutor",
      firstName: "Simon",
      lastName: "Whatley",
    },
    {
      email: "tony@cps.gov.uk",
      password: "password123",
      role: "Casework assistant",
      firstName: "Tony",
      lastName: "Stark",
    },
  ];

  // Generate 200 Prosecutors
  for (let i = 0; i < 200; i++) {
    const firstName = faker.helpers.arrayElement(firstNames);
    const lastName = faker.helpers.arrayElement(lastNames);
    userData.push({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.p${i}@example.com`,
      password: "password123",
      role: "Prosecutor",
      firstName: firstName,
      lastName: lastName,
    });
  }

  // Generate 200 Paralegal officers
  for (let i = 0; i < 200; i++) {
    const firstName = faker.helpers.arrayElement(firstNames);
    const lastName = faker.helpers.arrayElement(lastNames);
    userData.push({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.po${i}@example.com`,
      password: "password123",
      role: "Paralegal officer",
      firstName: firstName,
      lastName: lastName,
    });
  }

  // Hash all passwords in parallel
  const hashedUserData = await Promise.all(
    userData.map(async (u) => ({
      ...u,
      password: await bcrypt.hash(u.password, 10),
    }))
  );

  // Create all users in one batch
  const createdUsers = await prisma.user.createManyAndReturn({
    data: hashedUserData,
  });
  users.push(...createdUsers);
  console.log(`✅ ${users.length} users seeded`);

  // -------------------- User-Unit Assignments --------------------
  // Assign each user to 1-3 random units
  for (const user of users) {
    let selectedUnits;

    // Rachael Harvey gets specific units
    if (user.firstName === "Rachael" && user.lastName === "Harvey") {
      selectedUnits = [3, 4]; // Wessex Crown Court, Wessex RASSO
    } else if (user.firstName === "Simon" && user.lastName === "Whatley") {
      selectedUnits = [9, 11, 13, 18]; // North Yorkshire Magistrates Court, South Yorkshire Magistrates Court, West Yorkshire Magistrates Court, Humberside Magistrates Court
    } else if (user.firstName === "Tony" && user.lastName === "Stark") {
      selectedUnits = [1, 2, 3, 4, 5, 6, 7]; // All Wessex units: Dorset Magistrates Court, Hampshire Magistrates Court, Wessex Crown Court, Wessex RASSO, Wessex CCU, Wessex Fraud, Wiltshire Magistrates Court
    } else if (user.firstName === "Veronica" && user.lastName === "Mars") {
      selectedUnits = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // All Yorkshire and Humberside units
    }
    else {
      const numUnits = faker.number.int({ min: 1, max: 3 });
      selectedUnits = faker.helpers.arrayElements(
        Array.from({ length: 18 }, (_, i) => i + 1),
        numUnits
      );
    }

    await prisma.userUnit.createMany({
      data: selectedUnits.map(unitId => ({
        userId: user.id,
        unitId
      }))
    });
  }
  console.log(`✅ Users assigned to units`);

  // Refetch users with their units included for later use
  const usersWithUnits = await prisma.user.findMany({
    include: {
      units: true
    }
  });
  // Replace users array with the one that includes units
  users.length = 0;
  users.push(...usersWithUnits);

  // -------------------- Specialisms --------------------
  await prisma.specialism.createMany({
    data: specialisms.map((name) => ({ name })),
  });
  console.log("✅ Specialisms seeded");

  // -------------------- Prosecutors (Users with role="Prosecutor") --------------------
  const prosecutors = [];

  const tonyUnitId = faker.number.int({ min: 1, max: 18 });
  const tony = await prisma.user.create({
    data: {
      firstName: "Tony",
      lastName: "Stark",
      email: "tony.stark@cps.gov.uk",
      password: bcrypt.hashSync("password123", 10),
      role: "Prosecutor",
      units: {
        create: {
          unitId: tonyUnitId
        }
      }
    },
    include: {
      units: true
    }
  });
  prosecutors.push(tony);

  // Michael Chen - specialist in Hate crime with exclusions for all youth specialisms
  const michaelUnitId = faker.number.int({ min: 1, max: 18 });
  const michaelChen = await prisma.user.create({
    data: {
      firstName: "Michael",
      lastName: "Chen",
      email: "michael.chen@cps.gov.uk",
      password: bcrypt.hashSync("password123", 10),
      role: "Prosecutor",
      units: {
        create: {
          unitId: michaelUnitId
        }
      },
      specialistAreas: { connect: [{ name: 'Hate crime' }] },
      preferredAreas: { connect: [] },
      restrictedAreas: { connect: [
        { name: 'Youth justice' },
        { name: 'Youth RASSO' },
        { name: 'Youth specialist' }
      ] },
    },
    include: {
      units: true
    }
  });
  prosecutors.push(michaelChen);

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

    const prosecutorUnitId = faker.number.int({ min: 1, max: 18 });
    const prosecutor = await prisma.user.create({
      data: {
        firstName: faker.helpers.arrayElement(firstNames),
        lastName: faker.helpers.arrayElement(lastNames),
        email: `prosecutor.${faker.string.alphanumeric(8).toLowerCase()}@cps.gov.uk`,
        password: bcrypt.hashSync("password123", 10),
        role: "Prosecutor",
        units: {
          create: {
            unitId: prosecutorUnitId
          }
        },
        specialistAreas: { connect: specialistAreas.map((name) => ({ name })) },
        preferredAreas: { connect: preferredAreas.map((name) => ({ name })) },
        restrictedAreas: { connect: restrictedAreas.map((name) => ({ name })) },
      },
      include: {
        units: true
      }
    });
    prosecutors.push(prosecutor);
  }
  console.log("✅ Prosecutors seeded");

  // Re-fetch all prosecutors with units included to ensure we have complete data
  const allProsecutors = await prisma.user.findMany({
    where: { role: 'Prosecutor' },
    include: { units: true }
  });
  prosecutors.length = 0;
  prosecutors.push(...allProsecutors);

  // -------------------- Defence Lawyers --------------------
  const defenceLawyerData = Array.from({ length: 100 }, () => ({
    firstName: faker.helpers.arrayElement(firstNames),
    lastName: faker.helpers.arrayElement(lastNames),
    organisation: faker.helpers.arrayElement(defenceLawyerOrganisations),
  }));

  const defenceLawyers = await prisma.defenceLawyer.createManyAndReturn({
    data: defenceLawyerData,
  });
  console.log("✅ Defence lawyers seeded");

  // -------------------- Defendants with Charges --------------------
  // Step 1: Batch create all defendants with time limit type distribution
  // 50% CTL, 25% STL, 25% PACE
  // Track time limit type for each defendant (for charge creation)
  const defendantTimeLimitTypes = [];

  const defendantData = Array.from({ length: 300 }, (_, index) => {
    // Randomly assign time limit type (equal probability)
    const timeLimitType = faker.helpers.arrayElement(['CTL', 'STL', 'PACE']);
    defendantTimeLimitTypes.push(timeLimitType);

    // For PACE defendants, randomly assign a PACE clock from any time range
    let paceClock = null;
    if (timeLimitType === 'PACE') {
      const paceGenerators = [
        generateExpiredPACE,
        generateLessThan1HourPACE,
        generateLessThan2HoursPACE,
        generateLessThan3HoursPACE,
        generateMoreThan3HoursPACE
      ];
      paceClock = faker.helpers.arrayElement(paceGenerators)();
    }

    return {
      firstName: faker.helpers.arrayElement(firstNames),
      lastName: faker.helpers.arrayElement(lastNames),
      gender: faker.helpers.arrayElement(["Male", "Female", "Unknown"]),
      religion: faker.helpers.arrayElement([...religions, null]),
      occupation: faker.helpers.arrayElement([...occupations, null]),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 75, mode: "age" }),
      remandStatus: faker.helpers.arrayElement(remandStatuses),
      paceClock,
      defenceLawyerId: faker.helpers.arrayElement(defenceLawyers).id
    };
  });

  const defendants = await prisma.defendant.createManyAndReturn({
    data: defendantData,
  });

  // Step 2: Batch create all charges for defendants
  const allChargesData = [];
  for (let i = 0; i < defendants.length; i++) {
    const defendant = defendants[i];

    // Get the time limit type for this defendant
    const timeLimitType = defendantTimeLimitTypes[i];

    // Decide how many charges this defendant has (1-4, weighted towards 1-2)
    const numCharges = faker.helpers.weightedArrayElement([
      { weight: 50, value: 1 },
      { weight: 30, value: 2 },
      { weight: 15, value: 3 },
      { weight: 5, value: 4 }
    ]);

    // Select random charges
    const selectedCharges = faker.helpers.arrayElements(charges, numCharges);

    // Generate a time limit date for this defendant (will apply to at least one charge)
    let timeLimitDate = null;
    if (timeLimitType === 'CTL') {
      // Randomly select from CTL date range generators
      const ctlGenerators = [
        generateExpiredCTL,
        generateTodayCTL,
        generateTomorrowCTL,
        generateThisWeekCTL,
        generateNextWeekCTL,
        generateLaterCTL
      ];
      timeLimitDate = faker.helpers.arrayElement(ctlGenerators)();
    } else if (timeLimitType === 'STL') {
      // Randomly select from STL date range generators
      const stlGenerators = [
        generateExpiredSTL,
        generateTodaySTL,
        generateTomorrowSTL,
        generateThisWeekSTL,
        generateNextWeekSTL,
        generateLaterSTL
      ];
      timeLimitDate = faker.helpers.arrayElement(stlGenerators)();
    }
    // PACE is on defendant, not charges

    // Build charges data
    selectedCharges.forEach((charge, index) => {
      // Generate particulars with random date and victim
      const offenceDate = faker.date.past();
      const particularsDate = offenceDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const victimName = `${faker.helpers.arrayElement(firstNames)} ${faker.helpers.arrayElement(lastNames)}`;

      // For CTL/STL defendants, at least one charge must have the time limit
      // For first charge, always apply it. For additional charges, 50% chance
      const shouldHaveTimeLimit = index === 0 || faker.datatype.boolean();

      let ctl = null;
      let stl = null;
      if (timeLimitType === 'CTL' && shouldHaveTimeLimit) {
        ctl = timeLimitDate;
      } else if (timeLimitType === 'STL' && shouldHaveTimeLimit) {
        stl = timeLimitDate;
      }

      allChargesData.push({
        chargeCode: charge.code,
        description: charge.description,
        status: faker.helpers.arrayElement(chargeStatuses),
        offenceDate: offenceDate,
        plea: faker.helpers.arrayElement(pleas),
        particulars: `On the ${particularsDate} ${charge.code === 'B10' ? 'stole' : charge.code === 'A01' ? 'assaulted' : charge.code === 'C03' ? 'damaged property belonging to' : 'committed an offence against'} ${victimName}.`,
        custodyTimeLimit: ctl,
        statutoryTimeLimit: stl,
        isCount: faker.datatype.boolean(0.3), // 30% are counts
        defendantId: defendant.id,
      });
    });
  }

  await prisma.charge.createMany({ data: allChargesData });
  console.log("✅ Defendants and charges seeded");

  // -------------------- Victims --------------------
  const victimData = Array.from({ length: 200 }, () => ({
    firstName: faker.helpers.arrayElement(firstNames),
    lastName: faker.helpers.arrayElement(lastNames),
  }));

  const victims = await prisma.victim.createManyAndReturn({
    data: victimData,
  });
  console.log("✅ Victims seeded");

  // -------------------- Cases --------------------
  const TOTAL_CASES = 2465;
  const UNASSIGNED_TARGET = 37;
  const DGA_TARGET = 50; // set desired number of DGAs

  const createdCases = [];

  // Fetch all teams for direction assignment
  const teams = await prisma.team.findMany();

  // Define a pool of possible document names
  const documentNames = [
    "Police report",
    "Witness statement",
    "Evidence photo",
    "Forensic analysis",
    "Medical records",
    "Phone records",
    "Bank statements",
    "CCTV footage",
    "Interview transcript",
    "Expert report",
    "Scene photographs",
    "Custody record",
    "Chain of custody",
    "Lab results",
    "Search warrant",
  ];

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

// NEW DGA SEEDING LOGIC

// -------------------- Assign DGAs with Failure Reasons --------------------
const dgaIds = new Set(
  faker.helpers.arrayElements(createdCases, DGA_TARGET).map((c) => c.id)
);

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

for (const c of createdCases) {
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

console.log(`✅ Assigned ${DGA_TARGET} cases needing DGA review with failure reasons`);

  // -------------------- Create Guaranteed Tasks for Testing --------------------
  // Ensure each user (except Tony Stark) has tasks that are overdue, due today, and due tomorrow
  const usersExcludingTony = users.filter(u => u.email !== 'tony@cps.gov.uk');

  let guaranteedTasksCreated = 0;

  for (const user of usersExcludingTony) {
    // Get user's unit IDs
    const userWithUnits = await prisma.user.findUnique({
      where: { id: user.id },
      include: { units: true }
    });
    const userUnitIds = userWithUnits.units.map(uu => uu.unitId);

    // Find all cases where this user is a prosecutor or paralegal officer in their units
    const userCases = await prisma.case.findMany({
      where: {
        unitId: { in: userUnitIds },
        OR: [
          {
            prosecutors: {
              some: {
                userId: user.id
              }
            }
          },
          {
            paralegalOfficers: {
              some: {
                userId: user.id
              }
            }
          }
        ]
      }
    });

    // Skip if user has no cases in their units
    if (userCases.length === 0) continue;

    // Pick a random case for these guaranteed tasks
    const targetCase = faker.helpers.arrayElement(userCases);

    // Create 4 guaranteed tasks in each state: pending, due, overdue, escalated
    const pendingDates = generatePendingTaskDates();
    const dueDates = generateDueTaskDates();
    const overdueDates = generateOverdueTaskDates();
    const escalatedDates = generateEscalatedTaskDates();

    const guaranteedTasks = [
      {
        name: faker.helpers.arrayElement(taskNames),
        reminderType: null,
        reminderDate: pendingDates.reminderDate,
        dueDate: pendingDates.dueDate,
        escalationDate: pendingDates.escalationDate,
        completedDate: null,
        caseId: targetCase.id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      },
      {
        name: faker.helpers.arrayElement(taskNames),
        reminderType: null,
        reminderDate: dueDates.reminderDate,
        dueDate: dueDates.dueDate,
        escalationDate: dueDates.escalationDate,
        completedDate: null,
        caseId: targetCase.id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      },
      {
        name: faker.helpers.arrayElement(taskNames),
        reminderType: null,
        reminderDate: overdueDates.reminderDate,
        dueDate: overdueDates.dueDate,
        escalationDate: overdueDates.escalationDate,
        completedDate: null,
        caseId: targetCase.id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      },
      {
        name: faker.helpers.arrayElement(taskNames),
        reminderType: null,
        reminderDate: escalatedDates.reminderDate,
        dueDate: escalatedDates.dueDate,
        escalationDate: escalatedDates.escalationDate,
        completedDate: null,
        caseId: targetCase.id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      }
    ];

    await prisma.task.createMany({
      data: guaranteedTasks
    });

    guaranteedTasksCreated += guaranteedTasks.length;
  }

  console.log(`✅ Created ${guaranteedTasksCreated} guaranteed tasks (pending, due, overdue, escalated) for ${usersExcludingTony.length} users`);

  // -------------------- Create Guaranteed Priority PCD and Urgent Tasks --------------------
  // Ensure Rachael Harvey, Simon Whatley, and Tony Stark have:
  // - Priority PCD review task
  // - Priority resubmitted PCD case task
  // - At least one urgent task
  const targetUsers = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: "Rachael", lastName: "Harvey" },
        { firstName: "Simon", lastName: "Whatley" },
        { firstName: "Tony", lastName: "Stark" }
      ]
    },
    include: { units: true }
  });

  let priorityTasksCreated = 0;

  for (const user of targetUsers) {
    const userUnitIds = user.units.map(uu => uu.unitId);

    // Find cases where this user is assigned in their units
    const userCases = await prisma.case.findMany({
      where: {
        unitId: { in: userUnitIds },
        OR: [
          {
            prosecutors: {
              some: {
                userId: user.id
              }
            }
          },
          {
            paralegalOfficers: {
              some: {
                userId: user.id
              }
            }
          }
        ]
      }
    });

    // Skip if user has no cases
    if (userCases.length === 0) continue;

    // Pick random cases for these tasks
    const targetCases = faker.helpers.arrayElements(userCases, Math.min(3, userCases.length));

    // Create Priority PCD review task
    const pcdReviewDates = generateDueTaskDates();
    await prisma.task.create({
      data: {
        name: 'Priority PCD review',
        reminderType: null,
        reminderDate: pcdReviewDates.reminderDate,
        dueDate: pcdReviewDates.dueDate,
        escalationDate: pcdReviewDates.escalationDate,
        completedDate: null,
        isUrgent: false,
        urgentNote: null,
        caseId: targetCases[0].id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      }
    });
    priorityTasksCreated++;

    // Create Priority resubmitted PCD case task
    const resubmittedDates = generateOverdueTaskDates();
    await prisma.task.create({
      data: {
        name: 'Priority resubmitted PCD case',
        reminderType: null,
        reminderDate: resubmittedDates.reminderDate,
        dueDate: resubmittedDates.dueDate,
        escalationDate: resubmittedDates.escalationDate,
        completedDate: null,
        isUrgent: false,
        urgentNote: null,
        caseId: targetCases.length > 1 ? targetCases[1].id : targetCases[0].id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      }
    });
    priorityTasksCreated++;

    // Create an urgent task
    const urgentDates = generateEscalatedTaskDates();
    await prisma.task.create({
      data: {
        name: faker.helpers.arrayElement(taskNames),
        reminderType: null,
        reminderDate: urgentDates.reminderDate,
        dueDate: urgentDates.dueDate,
        escalationDate: urgentDates.escalationDate,
        completedDate: null,
        isUrgent: true,
        urgentNote: 'This task requires immediate attention due to upcoming court hearing.',
        caseId: targetCases.length > 2 ? targetCases[2].id : targetCases[0].id,
        assignedToUserId: user.id,
        assignedToTeamId: null,
      }
    });
    priorityTasksCreated++;
  }

  console.log(`✅ Created ${priorityTasksCreated} priority PCD and urgent tasks for ${targetUsers.length} users`);

  // -------------------- Create Guaranteed Test Cases for Rachael Harvey and Simon Whatley --------------------
  const rachaelHarvey = await prisma.user.findFirst({
    where: { firstName: "Rachael", lastName: "Harvey" }
  });

  const simonWhatley = await prisma.user.findFirst({
    where: { firstName: "Simon", lastName: "Whatley" }
  });

  // Helper function to create a test case with defendant, charge, and task
  async function createTestCase(user, unitId, timeLimitType, rangeKey, generateFn, defenceLawyers, charges, firstNames, lastNames, pleas, victims) {
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

    return _case;
  }

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

  for (const { user, units } of testUsers) {
    for (let i = 0; i < testCases.length; i++) {
      const { type, range, fn } = testCases[i];
      const unitId = units[i % units.length];

      await createTestCase(user, unitId, type, range, fn, defenceLawyers, charges, firstNames, lastNames, pleas, victims);
    }
    console.log(`✅ Created 17 guaranteed test cases for ${user.firstName} ${user.lastName}`);
  }

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
