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
- The basemap switcher currently defaults to Mapbox satellite and one free OSM streets option. Basemap choice does not persist across reloads.

## 2026-04-06 Modularization Pass

This pass changed the app from a single-file implementation to a static multi-file structure.

The same pass also:

- moved runtime data into `data/row-impacts.json`
- moved styling into `styles.css`
- split JavaScript into `src/config.js`, `src/data-model.js`, `src/parcel-service.js`, `src/map.js`, `src/ui.js`, and `src/app.js`
- preserved the cleanup rules from the earlier cleanup pass

## 2026-04-07 Visual Category Update

This pass sets `Extra High` to red and `High` to purple.

- `src/config.js` remains the authoritative runtime category-color mapping used by map fills and detail chips
- `styles.css` mirrors those category colors for filter dots and record-card accents

## 2026-04-07 Basemap Switcher Pass

This pass added config-driven basemap support and a lower-right basemap switcher control.

- `src/config.js` now defines the available basemaps and the default basemap
- `src/map.js` initializes all configured basemap layers and switches them without resetting parcel state
- `src/ui.js` owns the compact icon-triggered basemap menu
- the app currently supports Mapbox satellite and OpenStreetMap streets

## 2026-05-05 Display Schemes Refactor Pass

This pass generalizes the single hard-coded "Easement Impact" dimension into a configurable registry of display schemes. The visible app is unchanged - only Easement Impact is registered, and the new scheme switcher above the filter list renders as a single-option select. The point is that adding survey, ROW plans, or outreach later is a config-only edit instead of a coordinated change across six files.

- `src/config.js`: replaced `categoryOrder` and `categoryColors` with a `schemes` array (each entry declares `id`, `label`, `field`, `values`, `rollup`, `fallbackValueId`, `helperText`) and a `defaultSchemeId`
- `src/data-model.js`: replaced impact-specific helpers with scheme-aware versions - `getSchemeById`, `normalizeSchemeValue`, `getRollupValue`, `countRowsBySchemeValue`, `valueClassName`, `getValueColor`. The placeholder-row check in `prepareImpactData` stays tied to `impactCategory` by design - it is a spreadsheet-cleanup concern, not a general scheme concern.
- `src/app.js`: state now holds `activeSchemeId` and `filterSelectionsBySchemeId` (a `Map<schemeId, Set<valueId>>`); `applyFilters` AND-combines selections across all schemes, so adding a second scheme automatically composes
- `src/map.js`: the parcel-fill `match` expression is built dynamically from the active scheme's values; `setActiveColorScheme` rebuilds the paint property when the user switches schemes
- `src/parcel-service.js`: initial `displayValue` for fetched parcels comes from `defaultScheme.fallbackValueId` instead of the literal `"Other"`
- `src/ui.js`: scheme switcher `<select>` at the top of the panel; filter list and detail card render colors inline from `scheme.values` instead of CSS classes
- `styles.css`: removed `--impact-*` variables and `.impact-*` / `.record-card.<category>` color-binding classes; `.impact-dot` is now `.scheme-dot`
- `index.html`: the panel `<h2>` is now a runtime-populated `id="active-scheme-label"`, and a scheme-switcher container plus runtime helper-text element were added

Filter selection is preserved per scheme: switching dimensions and back restores the previous filter state. This matches what the eventual "color-by + filter-by" UX (Option B in the roadmap) will need natively.

Forward compatibility verified by adding a fake second scheme against an existing row field and confirming the dropdown switches dimensions, recolors the map, and preserves per-scheme filter state.
