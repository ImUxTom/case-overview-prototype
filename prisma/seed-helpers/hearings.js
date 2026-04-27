const { faker } = require('@faker-js/faker')
const hearingStatuses = require('../../app/data/hearing-statuses')
const statuses = require('../../app/data/case-statuses')
const venues = require('../../app/data/venues')

function randomHearingStatus() {
  return faker.helpers.weightedArrayElement([
    { weight: 30, value: hearingStatuses.PREPARATION_NEEDED },
    { weight: 30, value: hearingStatuses.PENDING },
    { weight: 30, value: hearingStatuses.OUTCOME_NEEDED },
    { weight: 10, value: hearingStatuses.COMPLETE },
  ])
}

// Generate N dates in chronological order, all in the past, with consistent spacing
function completePastDates(count) {
  const now = new Date()
  const lastDaysAgo = faker.number.int({ min: 14, max: 30 })
  const intervals = Array.from({ length: count - 1 }, () => faker.number.int({ min: 30, max: 60 }))
  let totalDaysAgo = lastDaysAgo + intervals.reduce((a, b) => a + b, 0)

  const dates = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - totalDaysAgo)
    d.setHours(10, 0, 0, 0)
    dates.push(d)
    if (i < count - 1) totalDaysAgo -= intervals[i]
  }
  return dates
}

// For CHARGED sequences: previous hearings are all COMPLETE (past),
// the final hearing's date depends on its status
function assignChargedDates(sequence) {
  const now = new Date()
  const lastIdx = sequence.length - 1
  const lastStatus = sequence[lastIdx].status
  const dates = new Array(sequence.length)

  const lastDate = new Date(now)
  if (lastStatus === hearingStatuses.OUTCOME_NEEDED) {
    lastDate.setDate(lastDate.getDate() - faker.number.int({ min: 1, max: 7 }))
  } else if (lastStatus === hearingStatuses.COMPLETE) {
    lastDate.setDate(lastDate.getDate() - faker.number.int({ min: 7, max: 29 }))
  } else {
    lastDate.setDate(lastDate.getDate() + faker.number.int({ min: 7, max: 56 }))
  }
  lastDate.setHours(10, 0, 0, 0)
  dates[lastIdx] = lastDate

  // Work backwards from 30 days ago for all complete prior hearings
  const anchor = new Date(now)
  anchor.setDate(anchor.getDate() - 30)
  for (let i = lastIdx - 1; i >= 0; i--) {
    anchor.setDate(anchor.getDate() - faker.number.int({ min: 30, max: 90 }))
    const d = new Date(anchor)
    d.setHours(10, 0, 0, 0)
    dates[i] = d
  }

  return sequence.map((h, i) => ({ ...h, date: dates[i] }))
}

function buildChargedSequence(isCrownCourt) {
  const sequence = []

  if (isCrownCourt) {
    const ptphStatus = randomHearingStatus()
    sequence.push({ type: 'First hearing', status: hearingStatuses.COMPLETE })
    sequence.push({ type: 'PTPH', status: ptphStatus })

    if (ptphStatus === hearingStatuses.COMPLETE && faker.datatype.boolean({ probability: 0.5 })) {
      const trialStatus = randomHearingStatus()
      sequence.push({ type: 'Trial', status: trialStatus })

      if (trialStatus === hearingStatuses.COMPLETE && faker.datatype.boolean({ probability: 0.5 })) {
        sequence.push({ type: 'Sentencing', status: randomHearingStatus() })
      }
    }
  } else {
    if (!faker.datatype.boolean({ probability: 0.5 })) return []

    const firstStatus = randomHearingStatus()
    sequence.push({ type: 'First hearing', status: firstStatus })

    if (firstStatus === hearingStatuses.COMPLETE && faker.datatype.boolean({ probability: 0.5 })) {
      const trialStatus = randomHearingStatus()
      sequence.push({ type: 'Trial', status: trialStatus })

      if (trialStatus === hearingStatuses.COMPLETE && faker.datatype.boolean({ probability: 0.5 })) {
        sequence.push({ type: 'Sentencing', status: randomHearingStatus() })
      }
    }
  }

  return assignChargedDates(sequence)
}

function buildNotGuiltySequence(isCrownCourt) {
  const types = ['First hearing']

  // 60% also went to trial (which resulted in not guilty); 40% resolved at first hearing
  if (faker.datatype.boolean({ probability: 0.6 })) {
    if (isCrownCourt && faker.datatype.boolean({ probability: 0.5 })) {
      types.push('PTPH')
    }
    types.push('Trial')
  }

  const dates = completePastDates(types.length)
  return types.map((type, i) => ({ type, status: hearingStatuses.COMPLETE, date: dates[i] }))
}

function buildSentencedSequence(isCrownCourt) {
  const types = ['First hearing']

  if (faker.datatype.boolean({ probability: 0.5 })) {
    if (isCrownCourt && faker.datatype.boolean({ probability: 0.5 })) {
      types.push('PTPH')
    }
    types.push('Trial')
  }

  types.push('Sentencing')

  const dates = completePastDates(types.length)
  return types.map((type, i) => ({ type, status: hearingStatuses.COMPLETE, date: dates[i] }))
}

function buildHearingSequence(status, isCrownCourt) {
  if (status === statuses.CHARGED) return buildChargedSequence(isCrownCourt)
  if (status === statuses.NOT_GUILTY) return buildNotGuiltySequence(isCrownCourt)
  if (status === statuses.SENTENCED) return buildSentencedSequence(isCrownCourt)
  return []
}

async function addHearings(prisma, { caseId, unitId, defendants, status }) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { name: true } })
  const isCrownCourt = unit?.name?.includes('Crown Court') ?? false
  const sequence = buildHearingSequence(status, isCrownCourt)
  for (const hearing of sequence) {
    await prisma.hearing.create({
      data: {
        startDate: hearing.date,
        status: hearing.status,
        type: hearing.type,
        venue: faker.helpers.arrayElement(venues),
        caseId,
        defendants: { connect: defendants.map(d => ({ id: d.id })) }
      }
    })
  }
}

module.exports = {
  addHearings
}
