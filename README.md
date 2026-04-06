# brt_easement_tool

Federal BRT Easement Impacts App
README / Developer Handoff
Purpose. This document explains what the web app does, how it is structured, where its data comes from, how parcel matching works, known issues, and what a future developer should know before making changes.
1. App summary
The app is an internal stakeholder-facing map for the Federal Boulevard BRT corridor in Denver, Colorado.
It shows parcel polygons along the corridor and links each parcel to construction easement impact information from the ROW impacts spreadsheet.
Users can filter parcels by impact category, hover over parcels to see quick information, and click parcels to lock full details in the sidebar.
2. Main features
•	Mapbox aerial imagery basemap.
•	Parcel polygons loaded from the Colorado statewide public parcel layer.
•	Impact category filters: Extra High, High, Medium, Low, and Other.
•	Hover tooltip showing Site Address, Property Type, and Business Name/Property Label.
•	Click-to-lock parcel details in the sidebar until the user clicks elsewhere.
•	Data status panel showing loaded parcel count and unmatched parcel IDs.
•	Full spreadsheet support, including duplicate parcel rows tied to the same parcel.
3. Tech stack
•	Plain HTML, CSS, and JavaScript in a single index.html file.
•	Mapbox GL JS for the map.
•	Colorado statewide parcel FeatureServer for parcel geometry.
•	Embedded spreadsheet data converted into a JavaScript array inside the HTML file.
4. Data sources
Primary project spreadsheet
•	Source file used for the current working app: ROW Impacts_v2.xlsx.
•	Column A contains parcel numbers.
•	Column B contains impact categories.
•	Other columns provide the values used in parcel detail panels and tooltips.
Public parcel geometry
•	Primary geometry source: Colorado statewide public parcel layer.
•	The app queries the public ArcGIS FeatureServer using parcel IDs from the spreadsheet.
•	Only parcels from the spreadsheet are requested. The app does not draw the full statewide parcel inventory.
5. Important known issues and lessons learned
5.1 Original spreadsheet parcel numbers were missing a leading zero
•	The original ROW impacts spreadsheet did not always match public parcel records exactly.
•	For many parcels, especially Denver parcels, the spreadsheet value was missing a leading zero.
•	Example: original spreadsheet parcel number 232419024000 needed to be corrected to 0232419024000.
•	Because of this, many parcels in the original spreadsheet could not be matched reliably to the public parcel dataset.
•	This issue was corrected in ROW Impacts_v2.xlsx.
•	The current app preserves leading zeros in the JavaScript logic and should not strip them.
5.2 Browser requests to the parcel service could fail
•	A second issue appeared even after parcel numbers were corrected.
•	The browser sometimes returned: “Parcel loading issue. The statewide parcel service could not be reached or returned an unexpected response. Error: Failed to fetch.”
•	This was not only a parcel formatting issue. It was also a front-end request issue when calling the public Colorado parcel service directly from the browser.
•	The working version uses a safer browser-side fallback request pattern rather than relying only on a simple direct fetch call.
5.3 Cleanup / invalid rows
•	Some spreadsheet rows were effectively cleanup cases, placeholders, or rows with notes such as “No ROW impacts here” or “No design here anymore.”
•	Those rows should not be treated as standard mappable parcels.
•	Future spreadsheet updates should continue to distinguish real parcel rows from cleanup rows.
6. How the app is organized
•	CONFIG section: Mapbox token, map defaults, service URL, category order, and category colors.
•	ROW_IMPACTS data section: embedded spreadsheet records used to drive the parcel joins and parcel detail content.
•	Map setup section: initializes the map and parcel layers.
•	Data fetching section: queries the parcel service and converts returned features into map-ready GeoJSON.
•	Filter section: controls which parcels are visible.
•	Interaction section: hover behavior, click-to-lock behavior, and detail rendering.
7. Fields a future developer will most likely edit
•	Mapbox token.
•	Impact colors.
•	Sidebar labels and wording.
•	Tooltip fields.
•	Parcel detail fields.
•	Spreadsheet import / update process when a new ROW spreadsheet is issued.
•	Cleanup-row exclusion logic.
•	Map starting center and zoom.
8. Recommended handoff instructions
•	Keep the latest working app as a downloadable index.html file, not only in canvas.
•	Treat ROW Impacts_v2.xlsx as the corrected baseline spreadsheet unless a newer version supersedes it.
•	When updating parcel data, verify that leading zeros are preserved.
•	If parcel loading breaks again, test the public parcel-service request path first before assuming parcel IDs are wrong.
•	Keep one authoritative working HTML file to avoid confusion between older experimental versions and the current version.
9. Is this enough information for a new developer?
Mostly yes, for a practical handoff. A new developer should be able to understand the app purpose, the core data flow, the major known issues, and the likely places to edit the code. However, the handoff would be stronger if the following items are stored alongside this README:
•	The final approved working index.html file.
•	The exact current spreadsheet used to generate the embedded data.
•	A short changelog showing major app versions and fixes.
•	A note identifying which file is the current production version.
•	Optional: a small script or documented process for regenerating the embedded JavaScript dataset from a new spreadsheet.
10. Suggested next improvement
The best future improvement would be to separate the spreadsheet conversion process from the HTML file so that new spreadsheet versions can be imported more reliably without manually rebuilding the embedded data block each time.
