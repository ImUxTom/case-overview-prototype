const { faker } = require('@faker-js/faker');

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

module.exports = {
  futureDateAt10am,
  getOverdueDate,
  getTodayDate,
  getTomorrowDate
};
