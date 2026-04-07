export function createMapController(config) {
  mapboxgl.accessToken = config.mapboxToken;
  const basemaps = Array.isArray(config.basemaps) ? config.basemaps : [];
  let activeBasemapId = getDefaultBasemapId(basemaps);

  const map = new mapboxgl.Map({
    container: "map",
    style: buildBaseStyle(basemaps, activeBasemapId),
    center: config.initialCenter,
    zoom: config.initialZoom,
    pitch: config.initialPitch,
    bearing: config.initialBearing,
    attributionControl: true,
  });

  map.addControl(new mapboxgl.NavigationControl(), "top-right");

  let parcelInteractionsBound = false;

  function addParcelLayers(parcelGeoJson) {
    if (map.getSource("row-parcels")) return;

    map.addSource("row-parcels", { type: "geojson", data: parcelGeoJson });
    map.addLayer({
      id: "row-parcels-fill",
      type: "fill",
      source: "row-parcels",
      paint: {
        "fill-color": [
          "match",
          ["get", "displayImpact"],
          "Extra High",
          config.categoryColors["Extra High"],
          "High",
          config.categoryColors.High,
          "Medium",
          config.categoryColors.Medium,
          "Low",
          config.categoryColors.Low,
          "Other",
          config.categoryColors.Other,
          "#999999",
        ],
        "fill-opacity": ["case", ["==", ["get", "isVisible"], 1], 0.45, 0],
      },
    });
    map.addLayer({
      id: "row-parcels-outline",
      type: "line",
      source: "row-parcels",
      paint: {
        "line-color": ["case", ["==", ["get", "isVisible"], 1], "#16324a", "rgba(0,0,0,0)"],
        "line-width": ["case", ["==", ["get", "isVisible"], 1], 1.2, 0],
      },
    });
    map.addLayer({
      id: "row-parcels-hover-outline",
      type: "line",
      source: "row-parcels",
      paint: { "line-color": "#ffffff", "line-width": 3 },
      filter: ["==", ["get", "lookupKey"], ""],
    });
    map.addLayer({
      id: "row-parcels-selected-outline",
      type: "line",
      source: "row-parcels",
      paint: { "line-color": "#00e5ff", "line-width": 4 },
      filter: ["==", ["get", "lookupKey"], ""],
    });
    map.addLayer({
      id: "row-parcels-hit-area",
      type: "fill",
      source: "row-parcels",
      paint: { "fill-color": "#000000", "fill-opacity": 0 },
    });
  }

  function bindParcelInteractions({ onHover, onLeave, onMapClick }) {
    if (parcelInteractionsBound) return;

    map.on("mousemove", "row-parcels-hit-area", onHover);
    map.on("mouseleave", "row-parcels-hit-area", onLeave);
    map.on("click", onMapClick);
    parcelInteractionsBound = true;
  }

  function setParcelData(parcelGeoJson) {
    const source = map.getSource("row-parcels");
    if (source) source.setData(parcelGeoJson);
  }

  function updateHoverOutline(lookupKey) {
    if (!map.getLayer("row-parcels-hover-outline")) return;
    map.setFilter("row-parcels-hover-outline", ["==", ["get", "lookupKey"], lookupKey || ""]);
  }

  function updateSelectedOutline(lookupKey) {
    if (!map.getLayer("row-parcels-selected-outline")) return;
    map.setFilter("row-parcels-selected-outline", ["==", ["get", "lookupKey"], lookupKey || ""]);
  }

  function fitMapToFeatures(features) {
    if (!features.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    features.forEach((feature) => extendBoundsWithGeometry(bounds, feature.geometry));

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 40, duration: 0 });
    }
  }

  function queryVisibleFeatureAtPoint(point) {
    return map
      .queryRenderedFeatures(point, { layers: ["row-parcels-hit-area"] })
      .find((feature) => feature.properties?.isVisible === 1);
  }

  function resetView() {
    map.flyTo({
      center: config.initialCenter,
      zoom: config.initialZoom,
      pitch: config.initialPitch,
      bearing: config.initialBearing,
      speed: 0.9,
      curve: 1.2,
    });
  }

  function setActiveBasemap(basemapId) {
    if (!basemaps.some((basemap) => basemap.id === basemapId)) return;

    activeBasemapId = basemapId;
    if (!map.isStyleLoaded()) return;

    basemaps.forEach((basemap) => {
      const layerId = getBasemapLayerId(basemap.id);
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(
        layerId,
        "visibility",
        basemap.id === activeBasemapId ? "visible" : "none",
      );
    });
  }

  return {
    map,
    onLoad(callback) {
      map.on("load", () => {
        setActiveBasemap(activeBasemapId);
        callback();
      });
    },
    addControl(control, position) {
      map.addControl(control, position);
    },
    addParcelLayers,
    bindParcelInteractions,
    setParcelData,
    updateHoverOutline,
    updateSelectedOutline,
    fitMapToFeatures,
    queryVisibleFeatureAtPoint,
    resetView,
    setActiveBasemap,
    getActiveBasemap() {
      return activeBasemapId;
    },
    getCanvas() {
      return map.getCanvas();
    },
    getContainer() {
      return map.getContainer();
    },
  };
}

function buildBaseStyle(basemaps, activeBasemapId) {
  const sources = {};
  const layers = [];

  basemaps.forEach((basemap) => {
    sources[getBasemapSourceId(basemap.id)] = {
      type: basemap.sourceType,
      ...basemap.source,
      ...(basemap.attribution ? { attribution: basemap.attribution } : {}),
    };
    layers.push({
      id: getBasemapLayerId(basemap.id),
      type: basemap.sourceType,
      source: getBasemapSourceId(basemap.id),
      layout: {
        visibility: basemap.id === activeBasemapId ? "visible" : "none",
      },
    });
  });

  return {
    version: 8,
    sources,
    layers,
  };
}

function getDefaultBasemapId(basemaps) {
  return basemaps.find((basemap) => basemap.isDefault)?.id || basemaps[0]?.id || null;
}

function getBasemapSourceId(basemapId) {
  return `basemap-source-${basemapId}`;
}

function getBasemapLayerId(basemapId) {
  return `basemap-layer-${basemapId}`;
}

function extendBoundsWithGeometry(bounds, geometry) {
  if (!geometry) return;
  const coordinates = geometry.coordinates;

  if (geometry.type === "Polygon") {
    coordinates.flat(1).forEach((coordinate) => bounds.extend(coordinate));
    return;
  }

  if (geometry.type === "MultiPolygon") {
    coordinates.flat(2).forEach((coordinate) => bounds.extend(coordinate));
  }
}
