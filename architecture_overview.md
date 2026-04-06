# Architecture Overview

## Purpose

This repository contains a single-file web app for internal review of Federal Boulevard BRT easement impacts.

The app displays parcel geometry from the Colorado public parcel service and joins those parcels to spreadsheet-derived impact records embedded in the page.

## Current Files

- `index.html`: authoritative app file
- `ROW Impacts_v2.xlsx`: source spreadsheet used to derive the embedded dataset
- `README.md`: developer handoff and known-issues summary
- `prompt.md`: original LLM generation prompt

## Runtime Structure

The app is intentionally flat.

1. HTML defines a two-panel layout with a sidebar and a map canvas.
2. CSS applies CDOT-inspired colors and responsive layout rules.
3. JavaScript contains:
   - static configuration
   - embedded spreadsheet data as `ROW_IMPACTS`
   - row cleanup and normalization logic
   - parcel-service fetch and JSONP fallback
   - Mapbox layer setup
   - filter, hover, selection, tooltip, and detail rendering logic

## Data Flow

1. `ROW_IMPACTS` is loaded from the embedded JavaScript array.
2. Rows are normalized:
   - impact categories are mapped to `Extra High`, `High`, `Medium`, `Low`, or `Other`
   - parcel IDs are expanded into lookup-key variants to preserve leading-zero matching
3. Cleanup rows are excluded before parcel queries are sent.
4. Remaining parcel IDs are queried against the Colorado parcel service in chunks.
5. Returned parcel features are matched back to spreadsheet rows and rendered in Mapbox.
6. Sidebar details are derived from the matched spreadsheet rows for each parcel.

## Cleanup Rules

The current cleanup pass excludes rows that are clearly not intended to map:

- placeholder parcel IDs containing `X`
- placeholder rows with no impact category, no business name, no notes, and `NOT LISTED` address data
- rows whose notes or labels indicate:
  - no ROW impacts
  - no design here
  - no design on this parcel
  - design does not extend across this parcel
  - property not along Federal Boulevard

These rules are intentionally conservative. Rows with uncertain but still potentially valid notes remain in the dataset.

## Integration Points

- Mapbox GL JS is loaded from the Mapbox CDN.
- Parcel geometry is requested from the Colorado public ArcGIS FeatureServer.
- The app first attempts `fetch(...&f=geojson)` and falls back to JSONP with `f=pjson` if browser fetch fails.

## Current Constraints

- The dataset is embedded directly in `index.html`, which makes spreadsheet updates manual and hard to diff.
- The app has no tests, build step, or automated spreadsheet-to-JSON conversion pipeline.
- The repository currently relies on one authoritative HTML file rather than modular source files.

## 2026-04-06 Cleanup Pass

This document was added during the first local cleanup pass.

The same pass also:

- tightened cleanup-row exclusion logic
- normalized placeholder text handling for UI display
- fixed record-title fallback so missing business names fall back to site address or parcel number
