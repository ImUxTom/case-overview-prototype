const { faker } = require('@faker-js/faker');
const { generateDueTaskDates, generateOverdueTaskDates, generateEscalatedTaskDates } = require('./task-dates');

async function seedPriorityTasks(prisma, taskNames) {
  // Find Rachael Harvey, Simon Whatley, and Tony Stark
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
}

module.exports = {
  seedPriorityTasks
};
