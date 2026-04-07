const CLEANUP_TEXT_PATTERNS = [
  "no row impacts",
  "no design here",
  "no design on this parcel",
  "design does not extend across this parcel",
  "not along federal blvd",
];

export function normalizeImpactCategory(value) {
  const clean = String(value || "").trim();
  if (clean === "Extra High") return "Extra High";
  if (clean === "High") return "High";
  if (clean === "Medium") return "Medium";
  if (clean === "Low") return "Low";
  return "Other";
}

export function normalizeParcelId(value) {
  return String(value || "").trim();
}

export function buildParcelLookupKeys(rawParcelValue) {
  const raw = String(rawParcelValue || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/&|,|\//)
    .map((part) => normalizeParcelId(part))
    .filter(Boolean);
  const keys = new Set();
  parts.forEach((part) => {
    keys.add(part);
    if (/^\d{12}$/.test(part)) keys.add(`0${part}`);
    if (/^\d{14}$/.test(part) && part.endsWith("0")) keys.add(part.slice(0, -1));
  });
  return Array.from(keys);
}

export function categoryClassName(category) {
  return String(category || "Other")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function countRowsByCategory(rows) {
  return rows.reduce((accumulator, row) => {
    accumulator[row.impactCategory] = (accumulator[row.impactCategory] || 0) + 1;
    return accumulator;
  }, {});
}

export function chunkArray(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

export function getHighestCategory(rows, categoryOrder) {
  const categories = rows.map((row) => row.impactCategory);
  for (const category of categoryOrder) {
    if (categories.includes(category)) return category;
  }
  return "Other";
}

export function hasMeaningfulText(value, additionalPlaceholders = []) {
  const clean = String(value ?? "").trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  if (lower === "-" || lower === "n/a" || lower === "na") return false;
  return !additionalPlaceholders.some(
    (entry) => lower === String(entry ?? "").trim().toLowerCase(),
  );
}

export function joinUniqueValues(values, fallback = "N/A") {
  const unique = Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => hasMeaningfulText(value)),
    ),
  );
  return unique.length ? unique.join(" | ") : fallback;
}

export function formatValue(value) {
  const clean = String(value ?? "").trim();
  return hasMeaningfulText(clean) ? clean : "N/A";
}

export function getRecordTitle(record) {
  if (hasMeaningfulText(record.businessName)) return record.businessName;
  if (hasMeaningfulText(record.siteAddress, ["not listed"])) return record.siteAddress;
  return record.parcelNumber;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function prepareImpactData(rawRows) {
  const cleanedRows = [];
  const excludedCleanupRows = [];

  rawRows.forEach((row, index) => {
    const parcelNumber = String(row.parcelNumber || "").trim();
    const notes = String(row.notes || "").trim().toLowerCase();
    const business = String(row.businessName || "").trim().toLowerCase();
    const placeholderRow =
      !hasMeaningfulText(row.impactCategory) &&
      !hasMeaningfulText(row.businessName) &&
      !hasMeaningfulText(row.notes) &&
      !hasMeaningfulText(row.siteAddress, ["not listed"]);
    const cleanupRow = CLEANUP_TEXT_PATTERNS.some(
      (pattern) => notes.includes(pattern) || business.includes(pattern),
    );
    const exclude = parcelNumber.includes("X") || placeholderRow || cleanupRow;
    const normalizedRow = {
      ...row,
      uid: `row-${index + 1}`,
      parcelKeys: buildParcelLookupKeys(parcelNumber),
      impactCategory: normalizeImpactCategory(row.impactCategory),
    };

    if (exclude) excludedCleanupRows.push(normalizedRow);
    else cleanedRows.push(normalizedRow);
  });

  const rowLookupByParcelKey = new Map();
  cleanedRows.forEach((row) => {
    row.parcelKeys.forEach((key) => {
      if (!rowLookupByParcelKey.has(key)) rowLookupByParcelKey.set(key, []);
      rowLookupByParcelKey.get(key).push(row);
    });
  });

  return {
    cleanedRows,
    excludedCleanupRows,
    rowLookupByParcelKey,
    categoryCounts: countRowsByCategory(cleanedRows),
  };
}

export function getMatchingRowsForFeature(feature, rowLookupByParcelKey) {
  return rowLookupByParcelKey.get(feature.properties?.lookupKey) || [];
}

export function findMatchingLookupKey(parcelId, rowLookupByParcelKey) {
  if (rowLookupByParcelKey.has(parcelId)) return parcelId;
  if (/^\d{12}$/.test(parcelId) && rowLookupByParcelKey.has(`0${parcelId}`)) {
    return `0${parcelId}`;
  }
  if (
    /^\d{13}$/.test(parcelId) &&
    parcelId.startsWith("0") &&
    rowLookupByParcelKey.has(parcelId.slice(1))
  ) {
    return parcelId.slice(1);
  }
  if (
    /^\d{14}$/.test(parcelId) &&
    parcelId.endsWith("0") &&
    rowLookupByParcelKey.has(parcelId.slice(0, -1))
  ) {
    return parcelId.slice(0, -1);
  }
  return null;
}

export function getUnmatchedParcelIds(rowLookupByParcelKey, parcelGeoJson) {
  const matched = new Set(
    parcelGeoJson.features.map((feature) => feature.properties?.lookupKey).filter(Boolean),
  );
  return Array.from(rowLookupByParcelKey.keys()).filter((key) => !matched.has(key));
}
