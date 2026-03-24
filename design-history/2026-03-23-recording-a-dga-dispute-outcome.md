---
title: Recording a DGA dispute outcome
date: 2026-03-23
---

We previously [designed a flow for recording a dispute outcome](https://cps-new-design-history-2189687bc35a.herokuapp.com/manage-cases/recording-a-dispute-outcome/).

We've iterated the flow as part of the wider DGA reporting iteration, changing how users reach it and the content on each step.

## What we changed

### Entry and exit points

Previously, users reached the flow from the dedicated DGA case list within the DGA reporting area, and returned to it after completing each outcome. 

The flow now starts from the [DGA reporting page for a case](../2026-03-20-viewing-dga-details-for-a-case/) and returns there on completion.

### Added failure details to the inset

The previous design showed the failure reason category in the inset — for example, "Evidential failure - Medical evidence". This alone did not give legal managers enough information to accurately answer the questions. To record the outcome properly, they needed to know the specific circumstances of the failure in that case.

We added a "Details" field to the inset, which shows the notes describing what actually went wrong — for example, which evidence was missing and what needed to be provided. This is shown on every page of the flow so users do not have to navigate away.

## How it works

Users reach the flow from the [DGA reporting tab on a case](../2026-03-20-viewing-dga-details-for-a-case/), by selecting "Record dispute outcome" for a specific failure reason.

The first question asks whether the police disputed the failure.

![The "Did the police dispute this failure?" page. The caption reads "88D289230/3 - Record dispute outcome". An inset shows the failure reason "Evidential failure - Medical evidence" and its details. Below is a Yes/No radio question.](recording-a-dga-dispute-outcome/step-1-did-police-dispute.png)

### If the police did not dispute the failure

If the user selects ‘No’, they go straight to a check page. Only the dispute question is shown in the summary, since no further details are needed.

![The check page showing "Did the police dispute this failure? No" in a summary list with a Change link. The button reads "Record dispute outcome".](recording-a-dga-dispute-outcome/not-disputed-check.png)

### If the police disputed the failure

If the user selects ‘Yes’, they are asked three further questions:

**Did CPS accept the dispute?**

![The "Did CPS accept the dispute?" page, showing the same failure reason inset and a Yes/No radio.](recording-a-dga-dispute-outcome/disputed-cps-accepted.png)

**Reason for outcome** — a free text field for the legal manager to explain the basis for the decision.

![The "Reason for outcome" page, showing the failure reason inset and a character count text area.](recording-a-dga-dispute-outcome/disputed-reason.png)

**How did you discuss this dispute with the police?** — checkboxes for Email, Meeting, or Phone call.

![The "How did you discuss this dispute with the police?" page, showing the failure reason inset and checkboxes for Email, Meeting, and Phone call.](recording-a-dga-dispute-outcome/disputed-method.png)

The check page shows all four answers with Change links.

![The check page showing all four rows: "Did the police dispute this failure? Yes", "Did CPS accept the dispute? Yes", "Reason for outcome", and "How did you discuss this dispute with the police?" with Change links for each. The button reads "Record dispute outcome".](recording-a-dga-dispute-outcome/disputed-check.png)

### After recording

After confirming, the user is returned to the case's DGA reporting tab with a "DGA dispute outcome recorded" success banner.

![The DGA reporting tab with a green success banner reading "DGA dispute outcome recorded". The failure reason that was updated now shows a summary list with the recorded answers.](recording-a-dga-dispute-outcome/success.png)

## Error messages

### Did the police dispute this failure?

- Nothing selected: "Select yes if the police disputed this failure"

### Did CPS accept the dispute?

- Nothing selected: "Select yes if CPS accepted the dispute"

### Reason for outcome

- Empty: "Enter a reason for outcome"
- Too long: "Reason for outcome must be 200 characters or fewer"

### How did you discuss this dispute with the police?

- Nothing selected: "Select how you discussed this dispute with the police"
