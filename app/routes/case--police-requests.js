const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { addTimeLimitDates } = require('../helpers/timeLimit')
const { addCaseStatus } = require('../helpers/caseStatus')

function getPoliceRequestStatus(request) {
  const allReceived = request.items.every((item) => item.receivedDate !== null)
  const someReceived = request.items.some((item) => item.receivedDate !== null)
  const now = new Date()

  if (allReceived) return 'Received'
  if (someReceived) return 'Partially received'
  if (new Date(request.deadline) < now) return 'Overdue'
  return 'Sent'
}

module.exports = (router) => {
  router.get('/cases/:caseId/police-requests', async (req, res) => {
    const caseId = parseInt(req.params.caseId)

    let _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        defendants: { include: { charges: true } },
        witnesses: true,
        dga: true,
      },
    })

    _case = addTimeLimitDates(_case)
    addCaseStatus(_case)

    const policeRequests = await prisma.policeRequest.findMany({
      where: { caseId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { sentDate: 'desc' },
    })

    const policeRequestsWithStatus = policeRequests.map((request) => ({
      ...request,
      status: getPoliceRequestStatus(request),
      receivedCount: request.items.filter((item) => item.receivedDate !== null).length,
    }))

    res.render('cases/police-requests/index', { _case, policeRequests: policeRequestsWithStatus })
  })

  router.get('/cases/:caseId/police-requests/:requestId', async (req, res) => {
    const caseId = parseInt(req.params.caseId)
    const requestId = parseInt(req.params.requestId)

    const _case = await prisma.case.findUnique({
      where: { id: caseId },
      include: { defendants: true, witnesses: true },
    })

    const policeRequest = await prisma.policeRequest.findUnique({
      where: { id: requestId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    policeRequest.status = getPoliceRequestStatus(policeRequest)
    policeRequest.itemRows = policeRequest.items.map((item) => ({
      key: { text: item.description },
      value: {
        text: item.receivedDate
          ? 'Received ' + new Date(item.receivedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Outstanding',
      },
    }))

    res.render('cases/police-requests/show', { _case, policeRequest })
  })
}
