# Architecture Overview

## Purpose

This repository contains a static web app for internal review of Federal Boulevard BRT easement impacts.

The app displays parcel geometry from the Colorado public parcel service and joins those parcels to spreadsheet-derived impact records stored in a committed JSON file.

## Current Files

- `index.html`: authoritative page shell
- `styles.css`: app styling
- `src/app.js`: runtime entrypoint and shared state owner
- `src/config.js`: runtime configuration
- `src/data-model.js`: row cleanup, normalization, lookup-key generation, and display formatting helpers
- `src/parcel-service.js`: ArcGIS parcel queries and JSONP fallback
- `src/map.js`: Mapbox initialization, parcel layers, outline updates, and viewport behavior
- `src/ui.js`: filter UI, status box, tooltip, and parcel-detail rendering
- `data/row-impacts.json`: authoritative runtime dataset
- `ROW Impacts_v2.xlsx`: archival spreadsheet reference, not a runtime dependency
- `README.md`: developer handoff and known-issues summary
- `prompt.md`: original LLM generation prompt

## Runtime Structure

The app is now a static multi-file application.

1. `index.html` defines the sidebar and map container only.
2. `styles.css` contains all layout and presentation rules.
3. `src/app.js` loads `data/row-impacts.json`, prepares normalized records, creates the map controller, wires UI events, and owns runtime state.
4. Supporting modules isolate configuration, data modeling, parcel-service integration, map behavior, and DOM rendering.

## Data Flow

1. `src/app.js` loads `data/row-impacts.json` with `fetch`.
2. `src/data-model.js` normalizes impact categories, expands parcel lookup keys, and excludes cleanup rows before parcel queries run.
3. `src/parcel-service.js` queries the Colorado parcel service in chunks using spreadsheet parcel IDs.
4. Returned parcel features are matched back to normalized spreadsheet rows and stored in a GeoJSON feature collection.
5. `src/map.js` renders those features in Mapbox.
6. `src/ui.js` renders filters, tooltip content, detail cards, and unmatched parcel summaries from the matched records.

## Cleanup Rules

The current cleanup logic excludes rows that are clearly not intended to map:

- placeholder parcel IDs containing `X`
- placeholder rows with no impact category, no business name, no notes, and `NOT LISTED` address data
- rows whose notes or labels indicate:
  - no ROW impacts
  - no design here
  - no design on this parcel
  - design does not extend across this parcel
  - property not along Federal Boulevard

These rules remain intentionally conservative. Rows with uncertain but still potentially valid notes stay in the dataset.

## Integration Points

- Mapbox GL JS is loaded from the Mapbox CDN.
- Parcel geometry is requested from the Colorado public ArcGIS FeatureServer.
- The app attempts `fetch(...&f=geojson)` first and falls back to JSONP with `f=pjson` if browser fetch fails.

## Runtime Assumptions

- The app must be served over HTTP or HTTPS so `fetch("./data/row-impacts.json")` succeeds.
- Direct `file://` opening of `index.html` is out of scope after this refactor.
- The runtime data contract is the committed JSON file, not the spreadsheet workbook.

## Current Constraints

- The spreadsheet-to-JSON update workflow is still manual.
- The app has no automated tests.
- The Mapbox token remains committed in client-side configuration.

## 2026-04-06 Modularization Pass

This pass changed the app from a single-file implementation to a static multi-file structure.

The same pass also:

- moved runtime data into `data/row-impacts.json`
- moved styling into `styles.css`
- split JavaScript into `src/config.js`, `src/data-model.js`, `src/parcel-service.js`, `src/map.js`, `src/ui.js`, and `src/app.js`
- preserved the cleanup rules from the earlier cleanup pass
