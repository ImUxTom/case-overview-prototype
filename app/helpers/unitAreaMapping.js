/**
 * Maps unit names to their CMS areas based on the area-unit relationships
 */
function getAreaForUnit(unitName) {
  if (!unitName) return "Unknown"

  // Dorset
  if (unitName.includes("Dorset Magistrates Court")) {
    return "Dorset"
  }

  // Hampshire and Isle of White
  if (
    unitName.includes("Hampshire Magistrates Court") ||
    unitName.includes("Wessex Crown Court") ||
    unitName.includes("Wessex RASSO") ||
    unitName.includes("Wessex CCU") ||
    unitName.includes("Wessex Fraud")
  ) {
    return "Hampshire and Isle of White"
  }

  // Wiltshire
  if (unitName.includes("Wiltshire Magistrates Court")) {
    return "Wiltshire"
  }

  // North Yorkshire
  if (
    unitName.includes("North Yorkshire Crown Court") ||
    unitName.includes("North Yorkshire Magistrates Court")
  ) {
    return "North Yorkshire"
  }

  // South Yorkshire
  if (
    unitName.includes("South Yorkshire Crown Court") ||
    unitName.includes("South Yorkshire Magistrates Court")
  ) {
    return "South Yorkshire"
  }

  // West Yorkshire
  if (
    unitName.includes("West Yorkshire Crown Court") ||
    unitName.includes("West Yorkshire Magistrates Court") ||
    unitName.includes("Yorkshire and Humberside CCU") ||
    unitName.includes("Yorkshire and Humberside RASSO")
  ) {
    return "West Yorkshire"
  }

  // Humberside
  if (
    unitName.includes("Humberside South Yorkshire RASSO") ||
    unitName.includes("Humberside Crown Court") ||
    unitName.includes("Humberside Magistrates Court")
  ) {
    return "Humberside"
  }

  return "Unknown"
}

/**
 * Gets all available CMS areas
 */
function getAllAreas() {
  return [
    "Dorset",
    "Hampshire and Isle of White",
    "Wiltshire",
    "North Yorkshire",
    "South Yorkshire",
    "West Yorkshire",
    "Humberside"
  ]
}

/**
 * Filters units by CMS area
 */
function filterUnitsByArea(units, area) {
  if (!area) return units

  return units.filter(unit => {
    return getAreaForUnit(unit.name) === area
  })
}

module.exports = {
  getAreaForUnit,
  getAllAreas,
  filterUnitsByArea
}
