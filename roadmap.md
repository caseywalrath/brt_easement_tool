# Project Roadmap: Multi-Dimensional Data and Collaborative Workflow

This document is a "plan to plan." It captures architectural directions for two upcoming expansions of the Federal BRT Easement Impacts app, before any specific implementation work begins.

The two dimensions being considered:

1. **Display categories** - moving from a single Easement Impact axis to multiple parallel data dimensions (parcel survey status, ROW plans, property owner outreach, etc.)
2. **Data management** - giving project teams a way to update their own data and see it on the map without involving a developer

Neither problem requires a decision today. The goal is to surface tradeoffs, identify the lowest-cost paths, and make sure the current architecture does not have to be rebuilt to support whichever option is eventually chosen.

---

## Part 1: Display Categories

### Current state

The app exposes a single classification axis: Easement Impact (Extra High, High, Medium, Low, Other).

This is wired through three layers:
- **Data**: `impactCategory` field on each row in `data/row-impacts.json`
- **Configuration**: `categoryOrder` and `categoryColors` in `src/config.js`
- **Render path**: `src/data-model.js` normalizes the field; `src/map.js` paints the map fill from a hard-coded `match` expression on `displayImpact`; `src/ui.js` builds the filter checklist; `styles.css` defines `--impact-*` CSS variables and `.impact-*` / `.record-card.*` classes that hard-code colors per category

The existing pattern is good: priority order and colors are config-driven, and most of the runtime accepts any string value. The tightly coupled bits are the literal `match` expression in the Mapbox paint and the per-category CSS class names.

### What's coming

Three additional dimensions are anticipated, none finalized:
- **Parcel survey status** - likely a yes/no binary, possibly with an "unknown" state
- **ROW plans** - a pipeline status from a separate spreadsheet, format TBD
- **Property owner outreach** - candidate values: none / initial contact / in negotiation / offer made

Each shares the same shape as Easement Impact: a discrete enumeration where each value gets a color, and parcels need to be filterable and color-coded by that value.

The data types differ slightly though:
- Easement Impact is **ordinal** with a clear priority direction
- Outreach is also **ordinal** ("offer made" is further along than "initial contact")
- Survey status is **binary** with a possible third "unknown" state
- ROW plans may be **categorical** (no inherent order) or ordinal depending on how the pipeline is modeled

The architecture should accommodate all three.

### Architectural concept: display schemes

Generalize Easement Impact into one of several "display schemes." A scheme is a self-contained spec describing how a single attribute is shown:

```
{
  id: "easement-impact",
  label: "Easement Impact",
  field: "impactCategory",
  values: [
    { id: "Extra High", color: "#c62828" },
    { id: "High",       color: "#8e24aa" },
    { id: "Medium",     color: "#fdd835" },
    { id: "Low",        color: "#1976d2" },
    { id: "Other",      color: "#78909c" },
  ],
  rollup: "highest-priority",   // how to collapse multi-row parcels into one color
  helperText: "...",
}
```

The rest of the app reads from a registry of these schemes:
- `config.js` exports the scheme list
- `data-model.js` normalizes any scheme's source field
- `map.js` builds the Mapbox `match` expression dynamically from the active scheme's values
- `ui.js` builds the filter checklist and counts dynamically
- `styles.css` stops hard-coding `.impact-extra-high` etc., and instead applies inline color from the scheme

This is a moderate but well-bounded refactor of the current code, and it isolates all future "add another category" work to a config edit.

### UX options

Several patterns can present multiple schemes:

**A. Scheme switcher (single active dimension)**

A dropdown or tab strip at the top of the sidebar selects the active scheme. Switching it replaces the filter checklist and recolors the map. Only one dimension is visible at a time.

- Pros: simple, low cognitive load, the map is unambiguous
- Cons: cannot visually compare two dimensions at once
- Best fit: stakeholder-facing reviews where one question is being answered at a time

**B. Color-by + filter-by**

A "Color by" dropdown picks the active scheme that drives parcel color. A separate "Filter by" panel below allows narrowing visible parcels by any combination of schemes (e.g. show only High-impact parcels that have not been surveyed).

- Pros: combines the clarity of a single color axis with multi-dimensional filtering
- Cons: more controls, requires teaching the distinction between "color" and "filter"
- Best fit: power users and project team workflows

**C. Stacked panels with compound legends**

Each scheme is its own collapsible panel in the sidebar. The active color scheme is marked. Filters in any panel narrow the map.

- Pros: discoverable, all dimensions visible at once
- Cons: long sidebar, more vertical scrolling, more visual noise

**D. Multi-encoding**

Color drives one scheme; an icon, border style, or hatch pattern drives another. Allows two dimensions on the map simultaneously.

- Pros: dense information
- Cons: hard to read, easy to overwhelm, accessibility concerns; not advised before validating with stakeholders

**Recommendation for the plan-to-plan stage**: target Option B (color-by + filter-by) as the eventual UX, but prototype with Option A first. Option A is a near-trivial extension of the current sidebar - a single dropdown above the existing checklist - and it validates the underlying scheme registry without committing to the more involved UI of Option B.

### What this means for the current codebase

The CSS and JS architecture needs three small adjustments before any second dimension is added:

1. **Replace hard-coded category classes with data-driven inline color application.** `.impact-extra-high`, `.impact-high`, etc. should not encode colors in `styles.css`. The colors should come from the active scheme and be applied via inline `style="..."`. Class names can stay as structural hooks for layout.

2. **Replace the hard-coded match expression in `src/map.js`.** The fill paint should be built from the active scheme's values list, not literal `"Extra High", "#c62828", ...` rows.

3. **Move the existing Easement Impact configuration into the new scheme structure**, even before adding a second scheme. This is a no-op rename that proves the registry works and gives a single, clean diff to review.

After those three adjustments, adding survey status or outreach status is a config-only change plus a minimal UI affordance to choose between schemes.

### Open questions for Part 1

- Do all schemes share the same parcel-rollup rule (highest-priority value wins)? Easement Impact and Outreach both want "highest." Survey status is binary and the rollup question is different (any unsurveyed row makes the parcel "unsurveyed"? or any surveyed row is enough?). ROW plans depend on whether the pipeline is ordinal.
   Developer response: probably yes, make note of implications when presenting plan
- Do binary fields need an explicit "unknown / not set" state, and what color does it get? Probably yes, and probably a neutral gray.
   Developer response: Recommend transparent with a grey border for unknon / not set.
- Should the legend ever be visible on the map itself, or stay in the sidebar?
   Developer response: sidebar for now
- When a user switches the active scheme, does the filter selection reset, or is it remembered per scheme?
   Developer response: unsure. Use best judgement, make note of implications when presenting plan
- Do we want the parcel detail card to show all dimensions for a parcel regardless of which scheme is active? (Probably yes - the detail panel is the place to see everything.)
   Developer response: yes. Hover-over pop-up may be modified to show other relevant details (ie, potentially a "Notes or other open-ended field updated by the project team
---

## Part 2: Data Management

### Current state

`data/row-impacts.json` is the single source of truth at runtime. It is committed to the repo and refreshed manually by a developer from `ROW Impacts_v2.xlsx` (which is itself archival; the canonical spreadsheet lives elsewhere). The page fetches the JSON on load.

There is one editor (a developer) and one source spreadsheet for one team's data. Adding survey, ROW plans, and outreach data multiplies both: more teams, more spreadsheets, more update cadences, more chances to introduce error.

### Goals and constraints

- **Goal**: project team members update their own data and see it reflected on the map quickly.
- **Constraint**: no IT support, no company server, no persistent infrastructure we operate.
- **Constraint**: contributors are non-coders. Any editing surface must be no harder than a spreadsheet.
- **Constraint**: a small team aided by coding agents has to build and maintain this. Keep the surface area small.
- **Preference**: cloud-based and free or near-free. Avoid lock-in to a service that could disappear or pull its free tier.
- **Soft requirement**: an audit trail so changes can be traced or reverted.

### Default path: separate spreadsheets, periodic developer sync

This is the simplest option, the most aligned with original project requirements, and what we will fall back to if no alternative below proves out.

- Each team maintains its own spreadsheet (Google Sheets or Excel)
- Sheets are joined on the parcel ID column
- A developer periodically:
  1. Pulls the latest sheets
  2. Joins them against the master spreadsheet
  3. Regenerates `data/row-impacts.json`
  4. Commits and pushes
- The web app continues to read a static JSON file with no changes to its runtime model

What this needs to be sustainable:
- A documented and ideally scripted spreadsheet-to-JSON conversion (already on the README's "next improvements" list)
- A schema check that catches missing columns, bad parcel IDs, dropped leading zeros
- A clear contract per team for what their sheet must contain, including the join column

Tradeoffs:
- Pro: zero new infrastructure; no auth to manage; current architecture survives unchanged
- Pro: developer becomes a forcing function for data quality before it goes public
- Con: changes are not visible until a developer picks them up (hours to days)
- Con: developer time is the bottleneck and a single point of failure
- Con: "I emailed you the new spreadsheet" workflow is fragile

### Alternatives that meet the constraints

Each option below preserves the static web app and changes only what it reads from. Options that allow editing inside the web app itself are noted explicitly.

**Option A: Google Sheets as a published CSV**

Each team's sheet is published to the web (File → Share → Publish to web → CSV). The app fetches each CSV at load and joins client-side.

- Edits propagate within a few minutes (Google's publish cache lag).
- Free at any reasonable scale.
- Auth is handled implicitly by sheet ACLs: anyone with edit access to the sheet can update; the published CSV is read-only for the public.
- The sheet is the schema and the audit trail (revision history is built in).
- **Risk**: published CSVs are public on the internet. If outreach data includes contact details, negotiation status, or offer amounts, this is disqualifying.
- Risk: Sheets is forgiving about types - leading zeros, dates, and stray rows will bite us the same way Excel did.
- Risk: Google publish-to-web cache can lag unpredictably; not suitable for live demos.
- Editing in the web app: no, editing happens in Sheets.
- Implementation effort: low. One fetch per team's sheet plus a join.

**Option B: Airtable**

Each team's data lives in an Airtable base. The app reads via Airtable's REST API with a token.

- Editor experience is materially nicer than a spreadsheet (column types, picklists for outreach status, validation, attachments for survey notes).
- Built-in forms allow non-coders to add records.
- Free tier exists but caps records and API calls; the corridor's parcel count likely fits but worth verifying.
- **Risk**: API requires a token in the client. Read-only scoped tokens are possible but still expose the dataset to anyone who reads the token off the page. Not safe for sensitive data.
- Risk: vendor lock - Airtable has tightened its free tier before and could again.
- Editing in the web app: not directly, but Airtable forms and embeds get close.
- Implementation effort: low to moderate. Plan for token rotation and a thin caching layer if rate limits bite.

**Option C: Static JSON committed via GitHub web UI or a form-to-PR pipeline**

Teams edit a JSON or CSV file directly through the GitHub web UI. Each save is a commit; PRs and merges become the audit trail. Optionally, a simple web form posts to a GitHub Action that opens a PR.

- Strongest audit trail of any option (git history).
- Zero ongoing cost beyond the existing repo.
- Editing JSON in a web UI is hostile to non-coders. CSV is a stretch.
- A form-to-PR pipeline is buildable but is non-trivial glue code; coding agents can produce it but it then needs maintenance.
- Editing in the web app: no, but a form-to-PR setup approximates it.
- Best as a developer's editing path, not a team member's.

**Option D: Supabase (managed Postgres + auth)**

A real database with row-level security, hosted free up to a generous threshold. The web app reads via the REST or JS client, optionally with anonymous read tokens. Editors authenticate with email magic link.

- Strongest model: schema enforcement, real auth, real audit logs (with a small amount of setup), per-team write permissions, real-time subscriptions if wanted.
- Edits appear instantly.
- **This is the option that genuinely supports editing inside the web app**: the app can include forms that write back to the database, with row-level security enforcing who can change what.
- Risk: highest learning curve and the highest ongoing operational burden (monitoring, backups, schema migrations, vendor risk if they change pricing).
- Risk: a team with coding agents can stand it up, but cannot maintain it casually. Plan for 2-3 days of focused work to set up and a runbook for the inevitable "it broke" moment.
- Implementation effort: high.

**Option E: Firebase (Firestore)**

Similar shape to Supabase, with a different document/collection model and first-class real-time updates. Free tier is also generous. Same general tradeoffs as D, including the "yes, supports in-app editing" property.

**Option F: Hybrid: Sheets for editing, JSON for serving**

Editing stays in Google Sheets (or Airtable) for the team. A scheduled job - GitHub Action on a cron, or a free-tier serverless function - pulls the sheet, validates it, and writes JSON back to the repo. The app continues to load committed JSON.

- Combines the editor familiarity of Sheets with the audit trail and stability of git.
- Latency: the cron interval, e.g. hourly.
- The committed JSON files act as a backup and as a clear separation between "data being edited" and "data being shown."
- This is the most pragmatic upgrade path from the default. Depending on how it goes, it may be the right destination, not just a stepping stone.
- Editing in the web app: no, but the developer-in-the-loop disappears from the regular workflow.
- Implementation effort: medium. The validation step is where the real work is.

### Local options

Briefly, since the constraints rule most of these out:

- **SQLite on a shared network drive**: only works if all editors are on the same network and someone serves the file. Not viable without IT.
- **Self-hosted on someone's laptop**: requires that laptop to stay on; effectively the same as a server we operate.
- **Local Excel with shared OneDrive/SharePoint**: this is functionally similar to the default path and offers no real-time advantage.

None of these compare favorably with the cloud options for this team's situation. They are mentioned for completeness.

### Comparison

| Option | Edit latency | Auth | Audit | Effort | Cost | Sensitive data safe? | In-app editing |
|---|---|---|---|---|---|---|---|
| Default (manual) | Hours-days | Sheet ACL | Git + sheet history | None | $0 | If sheet stays private | No |
| A. Published Sheets | Minutes | Sheet ACL (public read) | Sheet history | Low | $0 | No | No |
| B. Airtable | Seconds | Airtable + token | Airtable history | Low-med | $0 to $$ | Limited | Indirect |
| C. JSON in repo via form-to-PR | Minutes | GitHub auth | Git | Med | $0 | Yes if repo is private | Approximate |
| D. Supabase | Real-time | Email/OAuth | DB + setup | High | $0 to $ | Yes | Yes |
| E. Firebase | Real-time | Email/OAuth | DB + setup | High | $0 to $ | Yes | Yes |
| F. Sheets → cron → JSON | Minutes-hour | Sheet ACL | Git | Med | $0 | If sheet stays private | No |

### Recommendation

Two-step plan:

1. **Now**: harden the default. Document and eventually script the spreadsheet-to-JSON conversion. Make it accept multiple input sheets, one per team. Add a schema check that fails fast on bad data. This is independent of any longer-term decision and pays for itself immediately.

2. **Next**: prototype Option F (Sheets → cron → JSON) on a single team's data - probably outreach, where data is most operational and the team is most actively waiting on changes. If it holds up, expand to other teams. If it does not, the default path is unchanged and nothing is lost.

Avoid Option A unless we are certain the data is non-sensitive. Avoid Options D/E until the team is past the prototyping phase and has a clear, validated need for real-time edits or per-team write permissions. They are powerful but the wrong place to start.

### Risks and open questions for Part 2

- Is any of the data sensitive (owner contact info, negotiation status, dollar amounts)? This single answer disqualifies several options outright.
- How many editors per team? One editor per team is materially easier than several concurrent editors on the same dataset.
- Is "minutes of latency" acceptable, or is "instant" actually required for stakeholder-facing demos?
- What is the cost of a bad data update reaching the map - embarrassing or harmful? This sets how much validation effort is worth.
- Do we need offline / disconnected editing for any team?
- If we use a cron-driven sync (Option F), who watches the cron and how do they find out when it fails?

---

## Part 3: Cross-cutting concerns

A few items affect both dimensions and are worth flagging now:

- **Schema versioning**: once data fields multiply across teams, the runtime data contract in the README will need a version field and a migration plan. A breaking change to the JSON shape currently means hand-fixing the dataset.
- **Mapbox token**: still committed in `src/config.js`. A wider audience means a higher risk of token leakage. Worth rotating to a URL-restricted token before any wider distribution.
- **Tests**: the app has none. Before either dimension lands, a smoke test that boots the app against a fixture JSON and verifies the filter list renders is worth its weight.
- **Hosting**: currently served locally over `python -m http.server`. If team members are going to use the app, it needs a stable hosting target. GitHub Pages from this repo is the obvious zero-cost path.
- **Naming**: "Easement Impact" is currently the only "thing" the sidebar shows. As soon as a second scheme appears, the page title and headings ("Federal BRT Easement Impacts") may feel narrower than the actual app. Worth considering a slightly broader name.

---

## What this document is not

- Not an implementation plan. Each option above needs a sized ticket before it ships.
- Not a final decision. Several open questions are flagged. They should be answered with project stakeholders before more code is written.
- Not exhaustive. Other vendors (Cloudflare D1, Notion API, Sheets via Apps Script) exist and could be revisited if the leading options here do not fit.
