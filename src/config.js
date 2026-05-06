export const CONFIG = {
  dataUrl: "./data/row-impacts.json",
  parcelSurveyStatusUrl: "./data/parcel-survey-status.json",
  mapboxToken: "pk.eyJ1Ijoid2FsdGVyc2NoZWliIiwiYSI6ImNtbTVnY2lkYTA2ZmYycW9tbG5nMnoxbmYifQ.tMOP6wo0LKSy0gCsmfrCQQ",
  initialCenter: [-105.0255, 39.7489],
  initialZoom: 12.8,
  initialPitch: 0,
  initialBearing: 0,
  parcelQueryChunkSize: 40,
  statewideParcelServiceUrl:
    "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query",
  basemaps: [
    {
      id: "satellite",
      label: "Satellite",
      sourceType: "raster",
      source: {
        url: "mapbox://mapbox.satellite",
        tileSize: 256,
      },
      attribution: "",
      isDefault: true,
    },
    {
      id: "streets",
      label: "OpenStreetMap",
      sourceType: "raster",
      source: {
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
      },
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      isDefault: false,
    },
    {
      id: "esri-world",
      label: "Esri World",
      sourceType: "raster",
      source: {
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
      },
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      isDefault: false,
    },
    {
      id: "carto-positron",
      label: "Light",
      sourceType: "raster",
      source: {
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 20,
      },
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      isDefault: false,
    },
  ],
  schemes: [
    {
      id: "easement-impact",
      label: "Easement Impact",
      field: "impactCategory",
      values: [
        { id: "Extra High", color: "#c62828" },
        { id: "High", color: "#8e24aa" },
        { id: "Medium", color: "#fdd835" },
        { id: "Low", color: "#1976d2" },
        { id: "Other", color: "#78909c" },
      ],
      rollup: "highest-priority",
      fallbackValueId: "Other",
      helperText:
        "Parcels with multiple spreadsheet rows stay visible if at least one matching row is checked.",
    },
    {
      id: "parcel-survey-status",
      label: "Parcel Survey Status",
      field: "surveyStatus",
      values: [
        { id: "Not Surveyed", color: "#c62828" },
        { id: "Unknown", color: "#fdd835" },
        { id: "Surveyed", color: "#2e7d32" },
      ],
      rollup: "highest-priority",
      fallbackValueId: "Unknown",
      helperText:
        "Synthetic prototype data: 100 parcels are flagged Surveyed or Not Surveyed; the rest default to Unknown.",
    },
  ],
  defaultSchemeId: "easement-impact",
  detailPlaceholderText:
    "Hover over a parcel to preview its details. Click a parcel to keep the details visible until you click elsewhere on the map.",
};
