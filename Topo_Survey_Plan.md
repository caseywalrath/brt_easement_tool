# Topographic Survey Status — Segment-Based Display Schemes

## Context

`roadmap.md` anticipates additional display dimensions beyond Easement Impact and
Parcel Survey Status. The 2026-05-05 refactor generalized the rendering path so
that *parcel-based* dimensions are now a config-only addition — they hang off the
existing `row-parcels` source via `CONFIG.schemes`.

A new candidate dimension, **Topographic Survey Status**, breaks that assumption.
Its unit of attribution is not a parcel — it is a road segment between two specific
intersections along the corridor. The current architecture has no precedent for
non-parcel features: there is one source (`row-parcels`), one geometry type
(polygons), and one set of layers, all hardcoded in `src/map.js`.

This document describes how to introduce segment-based schemes without disturbing
the existing parcel pipeline.

Decisions confirmed during planning:
- **Display behavior**: when a segment scheme is active, parcels stay visible as a
  neutral underlay (no fill color, faint outline only); segments render colored on
  top.
- **Authoring**: segments are drawn in Google Earth (or equivalent) as KML,
  converted once to GeoJSON via a small edit-time script, and committed to `/data/`.

## Approach

### Data layer

1. **Author segments as KML**, then convert and commit GeoJSON.
   - Source of truth: `data/topo-segments.kml` (committed, human-editable).
   - Converted artifact: `data/topo-segments.geojson` (also committed; what the app
     fetches at runtime).
   - Conversion: a small Node script `scripts/build-segments.js` using
     `@tmcw/togeojson`. Run manually whenever the KML changes; no build pipeline
     needed since the converted GeoJSON is committed.
   - Each segment is a `LineString` with properties:
     `{ segmentId, fromIntersection, toIntersection, name, topoSurveyStatus }`.

2. **Status overlay**: keep status data co-located with geometry for v1 — the
   `topoSurveyStatus` field lives directly on the GeoJSON feature. If future
   dimensions need to attach more attributes per segment, mirror
   `data/parcel-survey-status.json` with a `data/segment-attributes.json` lookup
   keyed by `segmentId`.

### Scheme registry

Extend `CONFIG.schemes` entries with a `geometryKind` field:

```js
{
  id: "topo-survey-status",
  label: "Topographic Survey Status",
  geometryKind: "segment",      // NEW — defaults to "parcel" if absent
  field: "topoSurveyStatus",
  values: [
    { id: "Complete",    color: "#2e7d32" },
    { id: "In Progress", color: "#fdd835" },
    { id: "Not Started", color: "#c62828" },
  ],
  rollup: "single-value",
  fallbackValueId: "Not Started",
  helperText: "Segments are defined between named intersections...",
}
```

Existing parcel schemes implicitly get `geometryKind: "parcel"`.

### Map layers (`src/map.js`)

1. **New source** `topo-segments` loaded from `data/topo-segments.geojson` at map
   init (parallel to `row-parcels`, but loaded directly rather than chunked from
   ArcGIS).

2. **New layers** mirroring the parcel pattern but for lines:
   - `topo-segments-line` — colored line, ~5px, color from active scheme's `match`
     expression on `displayValue`.
   - `topo-segments-hover-outline` — wider white halo on hover.
   - `topo-segments-selected-outline` — cyan halo on selection.
   - `topo-segments-hit-area` — wider transparent line for click/hover hit-testing.

3. **Generalize active-scheme paint.** `setActiveColorScheme(scheme)` currently
   only updates `row-parcels-fill`. Branch on `scheme.geometryKind`:
   - `parcel`: paint `row-parcels-fill` `fill-color` (current behavior).
   - `segment`: paint `topo-segments-line` `line-color`.

4. **Layer-visibility orchestration.** Add `setActiveSchemeGeometry(kind)`:
   - `parcel`: parcel fill at 0.45 opacity; segments hidden.
   - `segment`: parcel fill opacity → 0, parcel outline kept at low opacity
     (~0.5, neutral gray) as a subtle context layer; segment layers visible.

5. **Hit-testing.** `bindParcelInteractions` becomes geometry-aware. When the
   active scheme is segment-based, `mousemove` / `click` query
   `topo-segments-hit-area` instead of `row-parcels-hit-area`.

### UI (`src/ui.js`, `src/app.js`)

- Scheme switcher needs no structural change — the existing dropdown already lists
  every entry in `CONFIG.schemes`. Selecting the topo entry triggers the new
  geometry-mode logic.
- Filter checklist (`renderFilterList`) is already scheme-driven and works for any
  enumeration; works for segments unchanged.
- Parcel detail card (`renderParcelDetails`) is parcel-specific. For segment
  selection, add a parallel `renderSegmentDetails` showing `name`,
  `fromIntersection`, `toIntersection`, `topoSurveyStatus`, and any notes.
  `src/app.js` dispatches based on `scheme.geometryKind`.
- Hover tooltip: similarly dispatched.

## Files to modify (when implementation begins)

- `src/config.js` — add the `topo-survey-status` scheme with
  `geometryKind: "segment"`.
- `src/map.js` — add `topo-segments` source/layers, generalize
  `setActiveColorScheme`, add `setActiveSchemeGeometry`, update interaction binding.
- `src/data-fetch.js` (or a new small helper) — fetch and parse
  `data/topo-segments.geojson`.
- `src/ui.js` — add `renderSegmentDetails` and segment-aware tooltip.
- `src/app.js` — load segments at startup; dispatch interaction handlers by
  `scheme.geometryKind`.
- `data/topo-segments.kml` — authored geometry.
- `data/topo-segments.geojson` — converted artifact.
- `scripts/build-segments.js` — one-shot KML→GeoJSON converter.
- `roadmap.md` — append a "Segment-based dimensions" subsection documenting the
  `geometryKind` extension and the KML→GeoJSON authoring workflow.

## Reused functions / utilities

- `buildFillColorExpression(scheme)` in `src/map.js` — rename to
  `buildSchemeColorExpression(scheme)` and reuse for line color (the `match`
  expression is identical; only the paint property it feeds differs).
- `getRollupValue` / `getValueColor` in `src/data-model.js` — for segments,
  rollup is a no-op (one row per segment) but the helpers still produce the right
  display values.
- Scheme switcher UI (`initSchemeSwitcher` in `src/ui.js`) — no change needed; it
  iterates `CONFIG.schemes` generically.
- Filter list (`renderFilterList` in `src/ui.js`) — no change needed.
- Basemap layer ordering (`src/map.js`) — segments will be added above parcel
  layers in the same way parcel layers sit above basemaps.

## Alternatives considered (and why not)

- **Hand-authored GeoJSON only (skip KML).** Simpler, but the user prefers Google
  Earth / KML for authoring. The KML-then-convert path costs one small script and
  gives the team a familiar editing surface.
- **Live query from CDOT or ArcGIS roads service at runtime.** Rejected because
  "between specific defined intersections" is a curated business definition;
  deriving it spatially at runtime adds fragile external dependency and complex
  spatial logic for marginal benefit (a few dozen segments is small enough to ship).
- **Separate top-level toggle (segments vs. parcels) outside the scheme switcher.**
  Rejected because it doubles the mental model. Treating segment dimensions as just
  another scheme — with `geometryKind` as the only new concept — keeps the existing
  UX intact.

## Verification (when implemented)

1. Author or stub a small `data/topo-segments.kml` with 3–5 segments covering a
   known stretch of the corridor; run `node scripts/build-segments.js` and verify
   the resulting GeoJSON has correct `LineString` features.
2. Serve the app locally (`python -m http.server 8123`) and confirm:
   - Default load (Easement Impact) is unchanged — parcels render as before.
   - Switching to "Topographic Survey Status" via the scheme dropdown:
     - Parcels fade to neutral outline-only style.
     - Segments appear, colored by status.
     - Filter checklist updates to status values.
     - Hovering a segment shows the segment tooltip; clicking shows segment details.
   - Switching back to a parcel scheme restores parcel coloring and hides segments.
3. Confirm interaction layers don't conflict — clicking a parcel under segment
   mode should not select a parcel; clicking a segment under parcel mode should
   not select a segment.
4. Validate basemap interaction is unaffected (Satellite / OSM / Esri / Light still
   switch correctly with both parcel and segment schemes active).
