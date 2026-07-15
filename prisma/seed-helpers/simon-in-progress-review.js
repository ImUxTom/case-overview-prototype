const { faker } = require('@faker-js/faker');
const statuses = require('../../app/data/case-statuses');
const elementsByChargeCode = require('../../app/data/elements');
const { generateDocumentsData } = require('./documents');
const { createDirectionsForCase } = require('./directions');
const { createVictimWitness, SIMON_UNITS } = require('./simon-cases');
const { buildCandidates, findParagraphOccurrence } = require('./case-review-annotations');

// A single burglary charge so the elements, annotations and document content
// (fibres and DNA at the point of entry) all tell the same story.
const CHARGE_CODE = 'B11';
const CASE_REFERENCE = '52SW200001';

const REVIEW_SUMMARY = 'Reviewed all material on the case file. The witness accounts are consistent and corroborated by CCTV footage, forensic findings and the medical report. Each element of the offence is made out and there is a realistic prospect of conviction. Prosecution is required in the public interest given the seriousness of the offence and its impact on the victim.';

// One reasoning per B11 element, in element order.
const ELEMENT_REASONINGS = [
  'DNA and clothing fibres recovered from the rear window frame place the defendant at the point of entry.',
  'Entry was through a rear window at night and there is no suggestion the defendant had permission to enter.',
  'Property was taken from the premises and recovered nearby, supporting an intent to steal.'
];

// Simon has a review that is all but ready to submit: every document
// reviewed and annotated, summary written, all elements assessed as strong
// and a decision to charge. The charging decision and information request
// answer live in the session during a live review, so they are stored on the
// review row and hydrated into the session when the review is opened (see
// hydrateSeededReviewSession in app/helpers/caseReview.js). Runs after
// seedElements, so it creates its own (all strong) elements.
async function seedSimonInProgressReview(prisma, dependencies, config) {
  const { defenceLawyers, victims, policeUnits } = dependencies;
  const { charges, firstNames, lastNames, types, complexities, ukCities, documentNames, documentTypes } = config;

  const simonWhatley = await prisma.user.findFirst({
    where: { firstName: 'Simon', lastName: 'Whatley' }
  });

  if (!simonWhatley) {
    console.log('⚠️ Simon Whatley not found, skipping in-progress review');
    return 0;
  }

  const burglaryCharge = charges.find(charge => charge.code === CHARGE_CODE);

  const defendant = await prisma.defendant.create({
    data: {
      firstName: faker.helpers.arrayElement(firstNames),
      lastName: faker.helpers.arrayElement(lastNames),
      gender: faker.helpers.arrayElement(['Male', 'Female', 'Unknown']),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 75, mode: 'age' }),
      remandStatus: null,
      status: statuses.NOT_CHARGED,
      needsReview: true,
      defenceLawyer: { connect: { id: faker.helpers.arrayElement(defenceLawyers).id } },
      charges: {
        create: {
          chargeCode: burglaryCharge.code,
          description: burglaryCharge.description,
          status: 'Pre-charge',
          offenceDate: faker.date.past(),
          plea: null,
          isCount: false
        }
      }
    },
    include: { charges: true }
  });

  const victimIds = faker.helpers.arrayElements(victims, faker.number.int({ min: 1, max: 2 })).map(v => ({ id: v.id }));
  const documentsData = generateDocumentsData(documentNames, documentTypes, 5);

  const _case = await prisma.case.create({
    data: {
      reference: CASE_REFERENCE,
      type: faker.helpers.arrayElement(types),
      complexity: faker.helpers.arrayElement(complexities),
      unit: { connect: { id: SIMON_UNITS.NORTH_YORKSHIRE_MAGISTRATES_COURT } },
      policeUnit: { connect: { id: faker.helpers.arrayElement(policeUnits).id } },
      defendants: { connect: { id: defendant.id } },
      victims: { connect: victimIds },
      location: {
        create: {
          name: faker.company.name(),
          line1: faker.location.streetAddress(),
          line2: faker.location.secondaryAddress(),
          town: faker.helpers.arrayElement(ukCities),
          postcode: faker.location.zipCode('WD# #SF'),
        },
      },
      documents: {
        createMany: {
          data: documentsData,
        },
      },
    }
  });

  await prisma.caseProsecutor.create({
    data: {
      caseId: _case.id,
      userId: simonWhatley.id,
      isLead: true
    }
  });

  const dueDate = faker.date.soon({ days: 5 });
  dueDate.setHours(23, 59, 59, 999);
  await prisma.task.create({
    data: {
      name: 'Make charging decision',
      reminderType: null,
      reminderDate: new Date(dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
      dueDate,
      escalationDate: new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      completedDate: null,
      caseId: _case.id,
      assignedToUserId: simonWhatley.id
    }
  });

  await createDirectionsForCase(prisma, _case.id, defendant.id, faker.number.int({ min: 1, max: 3 }));
  await createVictimWitness(prisma, _case.id, config);

  const elements = [];
  const elementDescriptions = elementsByChargeCode[burglaryCharge.code];
  for (const [index, description] of elementDescriptions.entries()) {
    const element = await prisma.element.create({
      data: {
        chargeId: defendant.charges[0].id,
        description,
        order: index,
        strength: 'Strong',
        strengthReasoning: ELEMENT_REASONINGS[index]
      }
    });
    elements.push(element);
  }

  const review = await prisma.caseReview.create({
    data: {
      caseId: _case.id,
      userId: simonWhatley.id,
      status: 'in_progress',
      summary: REVIEW_SUMMARY,
      summaryComplete: true,
      chargingDecisionComplete: true,
      strengthAssessmentComplete: true,
      decision: 'Charge'
    }
  });

  const documents = await prisma.document.findMany({ where: { caseId: _case.id } });

  for (const document of documents) {
    const docReview = await prisma.caseReviewDocument.create({
      data: { caseReviewId: review.id, documentId: document.id, status: 'reviewed' }
    });

    // No information-request annotations - the review answers no to the
    // information request question.
    const candidates = buildCandidates(document).filter(snippet => snippet.type !== 'information-request');

    for (const snippet of candidates) {
      const element = snippet.type === 'evidence' ? faker.helpers.arrayElement(elements) : null;
      const { paragraphIndex, occurrenceIndex } = findParagraphOccurrence(document, snippet.selectedText);

      const annotation = await prisma.caseReviewAnnotation.create({
        data: {
          caseReviewDocumentId: docReview.id,
          type: snippet.type,
          selectedText: snippet.selectedText,
          paragraphIndex,
          occurrenceIndex,
          note: element ? `${element.description}: ${snippet.note}` : snippet.note
        }
      });

      if (element) {
        await prisma.caseReviewAnnotationElement.create({
          data: {
            annotationId: annotation.id,
            elementId: element.id,
            reasoning: snippet.note
          }
        });
      }
    }
  }

  return 1;
}

module.exports = { seedSimonInProgressReview };
