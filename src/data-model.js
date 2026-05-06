const CLEANUP_TEXT_PATTERNS = [
  "no row impacts",
  "no design here",
  "no design on this parcel",
  "design does not extend across this parcel",
  "not along federal blvd",
];

export function getSchemeById(schemes, schemeId) {
  return schemes.find((scheme) => scheme.id === schemeId) || schemes[0] || null;
}

export function normalizeSchemeValue(scheme, value) {
  const clean = String(value || "").trim();
  const match = scheme.values.find((entry) => entry.id === clean);
  return match ? match.id : scheme.fallbackValueId;
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

export function valueClassName(valueId) {
  return String(valueId || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function countRowsBySchemeValue(rows, scheme) {
  return rows.reduce((accumulator, row) => {
    const value = row[scheme.field] || scheme.fallbackValueId;
    accumulator[value] = (accumulator[value] || 0) + 1;
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

export function getRollupValue(rows, scheme) {
  if (!rows.length) return scheme.fallbackValueId;

  if (scheme.rollup === "highest-priority") {
    const valuesPresent = new Set(
      rows.map((row) => row[scheme.field] || scheme.fallbackValueId),
    );
    for (const entry of scheme.values) {
      if (valuesPresent.has(entry.id)) return entry.id;
    }
    return scheme.fallbackValueId;
  }

  return scheme.fallbackValueId;
}

export function getValueColor(scheme, valueId) {
  const match = scheme.values.find((entry) => entry.id === valueId);
  if (match) return match.color;
  const fallback = scheme.values.find((entry) => entry.id === scheme.fallbackValueId);
  return fallback ? fallback.color : "#999999";
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

export function prepareImpactData(rawRows, schemes, parcelOverlayByNumber = new Map()) {
  const cleanedRows = [];
  const excludedCleanupRows = [];

  rawRows.forEach((row, index) => {
    const parcelNumber = String(row.parcelNumber || "").trim();
    const notes = String(row.notes || "").trim().toLowerCase();
    const business = String(row.businessName || "").trim().toLowerCase();
    // Placeholder check intentionally tied to Easement Impact: it's about
    // identifying empty rows in the source spreadsheet, not a general scheme
    // concern. When a binary scheme is added it should not be folded in here.
    const placeholderRow =
      !hasMeaningfulText(row.impactCategory) &&
      !hasMeaningfulText(row.businessName) &&
      !hasMeaningfulText(row.notes) &&
      !hasMeaningfulText(row.siteAddress, ["not listed"]);
    const cleanupRow = CLEANUP_TEXT_PATTERNS.some(
      (pattern) => notes.includes(pattern) || business.includes(pattern),
    );
    const exclude = parcelNumber.includes("X") || placeholderRow || cleanupRow;

    const overlay = parcelOverlayByNumber.get(parcelNumber) || {};
    const normalizedRow = {
      ...row,
      ...overlay,
      uid: `row-${index + 1}`,
      parcelKeys: buildParcelLookupKeys(parcelNumber),
    };
    schemes.forEach((scheme) => {
      normalizedRow[scheme.field] = normalizeSchemeValue(scheme, normalizedRow[scheme.field]);
    });

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

  const countsBySchemeId = new Map();
  schemes.forEach((scheme) => {
    countsBySchemeId.set(scheme.id, countRowsBySchemeValue(cleanedRows, scheme));
  });

  return {
    cleanedRows,
    excludedCleanupRows,
    rowLookupByParcelKey,
    countsBySchemeId,
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
