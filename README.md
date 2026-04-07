# Federal BRT Easement Impacts

## Purpose

This repository contains a static web app for internal review of Federal Boulevard BRT easement impacts in the Denver corridor.

The app displays parcel geometry from the Colorado public parcel service and joins those parcels to spreadsheet-derived impact records stored in a committed JSON data file.

## Current Status

The app is no longer a single-file implementation.

It now uses:
- `index.html` as the page shell
- `styles.css` for presentation
- `src/*.js` ES modules for runtime logic
- `data/row-impacts.json` as the authoritative runtime dataset

The workbook `ROW Impacts_v2.xlsx` is retained as an archival reference only. It is not loaded directly by the browser at runtime.

## Main Features

- Mapbox satellite basemap
- Parcel polygons loaded from the Colorado statewide public parcel layer
- Impact category filters: Extra High, High, Medium, Low, and Other
- Hover tooltip with parcel summary information
- Click-to-lock parcel details in the sidebar
- Support for multiple spreadsheet rows tied to the same parcel
- Cleanup-row exclusion before parcel queries are sent
- Unmatched parcel reporting
- Leading-zero parcel matching support

## Repository Layout

- `index.html`: authoritative page shell
- `styles.css`: application styling
- `src/app.js`: runtime entrypoint and state owner
- `src/config.js`: configuration values
- `src/data-model.js`: cleanup rules, normalization, parcel lookup-key generation, and formatting helpers
- `src/parcel-service.js`: ArcGIS parcel queries and JSONP fallback
- `src/map.js`: Mapbox setup, parcel layers, outline behavior, and map viewport control
- `src/ui.js`: filter UI, tooltip, detail rendering, and status rendering
- `data/row-impacts.json`: authoritative runtime dataset
- `ROW Impacts_v2.xlsx`: archival spreadsheet reference
- `prompt.md`: original LLM generation prompt
- `architecture_overview.md`: architecture and maintenance notes

## Runtime Data Contract

The browser loads `data/row-impacts.json` at runtime.

That file must remain a JSON array of row objects using the current field set, including:
- `parcelNumber`
- `impactCategory`
- `station`
- `county`
- `siteAddress`
- `propertyType`
- `businessName`
- `opportunityToRestripe`
- `restripingOptions`
- `widthFromBOWToBuilding`
- `originalOrder`
- `rollPlotViewport`
- `designSegment`
- `notes`
- `sourceRow`

If this structure changes, the app logic in `src/data-model.js`, `src/app.js`, and `src/ui.js` will need to be updated.

## How The App Works

1. `src/app.js` loads `data/row-impacts.json`.
2. `src/data-model.js` normalizes impact categories, expands parcel lookup keys, and excludes cleanup rows.
3. `src/parcel-service.js` queries the Colorado parcel service for only the parcel IDs present in the runtime dataset.
4. Returned parcel features are matched back to the normalized rows.
5. `src/map.js` renders parcel polygons and interaction outlines in Mapbox.
6. `src/ui.js` renders filter controls, hover tooltips, detail cards, and data status messages.

## Cleanup Rules

The current cleanup logic excludes rows that are clearly not intended to map.

Excluded cases include:
- placeholder parcel IDs containing `X`
- placeholder rows with no impact category, no business name, no notes, and `NOT LISTED` address data
- rows whose notes or labels indicate:
- `no ROW impacts`
- `no design here`
- `no design on this parcel`
- `design does not extend across this parcel`
- `property not along Federal Boulevard`

These rules are intentionally conservative. Rows with uncertain but still potentially valid notes remain in the dataset.

## Known Issues And Constraints

- The spreadsheet-to-JSON update workflow is still manual.
- The app has no automated tests.
- The app depends on a live public parcel service.
- The parcel-service integration may still fail in some browser/network conditions even with JSONP fallback.
- The Mapbox token is committed in client-side configuration.
- The app must be served over HTTP or HTTPS. Direct `file://` opening is not supported.

## Important Historical Issues

### Leading zeros in parcel IDs

Previous spreadsheet versions did not always preserve parcel numbers exactly.

This was especially important for Denver parcels. Example:
- spreadsheet value: `232419024000`
- corrected parcel value: `0232419024000`

The current logic preserves leading zeros and also generates lookup-key variants to improve matching. Do not strip leading zeros during future data updates.

### Browser access to the parcel service

The statewide parcel service may reject or fail browser requests intermittently.

The current implementation:
- attempts `fetch(...&f=geojson)` first
- falls back to JSONP with `f=pjson` if the primary path fails

If parcel loading breaks again, test the parcel-service request path before assuming parcel IDs are wrong.

## How To Run Locally

The app must be served from a local HTTP server.

Example using Python:

1. Open a terminal in the repository root.
2. Run:
   `python -m http.server 8123`
3. Open:
   `http://127.0.0.1:8123/index.html`

Do not open `index.html` directly from disk.

## How To Update The Data

Current process:
1. Start with the latest spreadsheet source.
2. Preserve parcel numbers exactly, including leading zeros.
3. Preserve the current field set expected by `data/row-impacts.json`.
4. Regenerate or manually update `data/row-impacts.json`.
5. Verify that cleanup rows are still excluded correctly.
6. Serve the app locally over HTTP.
7. Confirm filters, parcel loading, tooltip content, sidebar details, and unmatched parcel reporting still behave correctly.

At present there is no committed spreadsheet-to-JSON conversion script. That is still a recommended improvement.

## Minimum Validation Checklist

Before merging future changes, verify:
- the page loads over HTTP without a data-loading error
- filter counts render
- parcel polygons appear
- hover tooltip works
- click-to-lock parcel details works
- at least one parcel with multiple rows renders multiple detail cards
- unmatched parcel reporting still appears in the status area
- missing business names fall back to site address or parcel number

## GitHub Workflow

Recommended workflow:
1. Create a feature branch from `main`
2. Make the change on that branch
3. Open a pull request into `main`
4. Review the diff
5. Merge the pull request
6. Delete the feature branch after merge

Avoid making substantive edits directly on `main`.

## Recommended Next Improvements

- Add a repeatable spreadsheet-to-JSON conversion script
- Add basic validation for `data/row-impacts.json`
- Add a lightweight smoke test for app boot and data loading
- Decide whether to keep the Mapbox token committed in client-side configuration
- Consider a cached parcel-geometry path if the live public service remains unstable
