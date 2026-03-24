---
title: Bulk recording DGA dispute outcomes as not disputed
date: 2026-03-24
---

Legal managers sometimes need to record the same outcome — not disputed — across many cases at once, for example at the end of a reporting period. Doing this one case at a time is slow and repetitive.

We added a bulk action to the case list that lets users record multiple DGA dispute outcomes as not disputed in a single flow.

## How it works

Users reach the case list by clicking "Record dispute outcomes" on the [DGA reporting page for a month](../2026-03-20-viewing-dga-details-for-a-case/). The case list is pre-filtered to show cases that are awaiting an outcome for the selected police force and reporting month.

Alongside each case is a checkbox. Above the list are two action buttons: "Select all X cases" and "Record DGA dispute outcomes as not disputed".

![The case list filtered to Metropolitan Police, February 2026, and Awaiting outcome. Each case has a checkbox. Above the list are the buttons "Select all 37 cases" and "Record DGA dispute outcomes as not disputed".](bulk-recording-dga-dispute-outcomes-as-not-disputed/case-list-filtered.png)

Users can select cases individually using the checkboxes, or click "Select all X cases" to select all cases across all pages at once.

After selecting cases, the user clicks "Record DGA dispute outcomes as not disputed". They are taken to a confirmation page that lists all the selected cases.

![The confirmation page, headed "Confirm that you want to record the DGA dispute outcomes for 37 cases as not disputed". Below is a bullet list of all 37 cases shown as URN and defendant name. A "Record DGA dispute outcomes as not disputed" button and a "Cancel" link are at the bottom.](bulk-recording-dga-dispute-outcomes-as-not-disputed/confirmation.png)

If any selected cases already have all their outcomes recorded, they are excluded from the list and a note explains how many were skipped.

After confirming, the user is returned to the case list with a "DGA dispute outcomes recorded as not disputed" success banner. Cases that have been updated no longer appear under the "Awaiting outcome" filter.

![The case list with a green success banner reading "DGA dispute outcomes recorded as not disputed". The list shows "Cases (0)" and "There are no results." because all outcomes have now been recorded.](bulk-recording-dga-dispute-outcomes-as-not-disputed/success.png)
