export const CONFIG = {
  dataUrl: "./data/row-impacts.json",
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
      label: "Streets",
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
  ],
  categoryOrder: ["Extra High", "High", "Medium", "Low", "Other"],
  categoryColors: {
    "Extra High": "#c62828",
    High: "#8e24aa",
    Medium: "#fdd835",
    Low: "#1976d2",
    Other: "#78909c",
  },
  detailPlaceholderText:
    "Hover over a parcel to preview its details. Click a parcel to keep the details visible until you click elsewhere on the map.",
};
