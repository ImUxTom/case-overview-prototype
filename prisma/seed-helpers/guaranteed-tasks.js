const { faker } = require('@faker-js/faker');
const { generatePendingTaskDates, generateDueTaskDates, generateOverdueTaskDates, generateEscalatedTaskDates } = require('./task-dates');

async function seedGuaranteedTasks(prisma, users, taskNames) {
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
}

module.exports = {
  seedGuaranteedTasks
};
