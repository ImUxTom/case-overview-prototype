---
title: Exporting DGA cases iteration
date: 2026-03-23
---

We previously [designed a page for exporting DGA cases](https://cps-new-design-history-2189687bc35a.herokuapp.com/manage-cases/exporting-dga-cases/).

We've added a question to stop users from accidentally sharing personal or sensitive information outside of CPS.

## What we changed

### Added a question about sharing outside the CPS

Legal managers sometimes share the export with police forces. The 'reason for outcome' column can contain sensitive or personal information that should not be shared outside the CPS.

We added a "Are you sharing this export outside the CPS?" question with Yes and No options. Choosing Yes removes the 'reason for outcome' column from the exported spreadsheet. The hint text on the Yes option explains this: "The 'reason for outcome' column will be removed because it may contain sensitive or personal information."

![The export page for February 2026 - Metropolitan Police. The heading reads "Export cases that had a DGA". Below is the new question "Are you sharing this export outside the CPS?" with Yes and No radios. Yes has hint text explaining the reason for outcome column will be removed. Below that is the existing "Time period" section with week checkboxes.](exporting-dga-cases-iteration/export.png)

## Error messages

### Are you sharing this export outside the CPS?

- Nothing selected: "Select yes if you are sharing this export outside the CPS"

### Time period

- Nothing selected: "Select a time period"
