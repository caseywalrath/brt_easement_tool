// One-shot generator for data/parcel-survey-status.json. Re-run only when the seed or distribution changes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEED = 0x9e3779b1;
const EXPLICIT_COUNT = 100;
const SURVEYED_FRACTION = 0.7;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const inputPath = resolve(repoRoot, "data/row-impacts.json");
const outputPath = resolve(repoRoot, "data/parcel-survey-status.json");

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, rng) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const rows = JSON.parse(readFileSync(inputPath, "utf8").replace(/^﻿/, ""));
const uniqueParcelIds = Array.from(
  new Set(
    rows
      .map((row) => String(row.parcelNumber || "").trim())
      .filter((id) => id && !id.includes("X")),
  ),
).sort();

const rng = mulberry32(SEED);
const shuffled = shuffle(uniqueParcelIds, rng);
const explicit = shuffled.slice(0, Math.min(EXPLICIT_COUNT, shuffled.length));
const explicitSet = new Set(explicit);
const surveyedCutoff = Math.round(explicit.length * SURVEYED_FRACTION);
const surveyedSet = new Set(explicit.slice(0, surveyedCutoff));

const output = uniqueParcelIds.map((parcelNumber) => ({
  parcelNumber,
  surveyStatus: explicitSet.has(parcelNumber)
    ? surveyedSet.has(parcelNumber)
      ? "Surveyed"
      : "Not Surveyed"
    : "Unknown",
}));

writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

const counts = output.reduce((acc, entry) => {
  acc[entry.surveyStatus] = (acc[entry.surveyStatus] || 0) + 1;
  return acc;
}, {});
console.log(`Wrote ${output.length} parcels to ${outputPath}`);
console.log(counts);
