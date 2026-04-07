import { CONFIG } from "./config.js";
import {
  getHighestCategory,
  getMatchingRowsForFeature,
  getUnmatchedParcelIds,
  prepareImpactData,
} from "./data-model.js";
import { createMapController } from "./map.js";
import { fetchAllParcelFeatures } from "./parcel-service.js";
import {
  getDomRefs,
  hideTooltip,
  initBasemapSwitcher,
  initFilterUi,
  renderDetailPlaceholder,
  renderMissingParcelList,
  renderParcelDetails,
  renderStatusBox,
  renderStatusError,
  renderTooltip,
} from "./ui.js";

const dom = getDomRefs();

const state = {
  selectedCategories: new Set(CONFIG.categoryOrder),
  mapController: null,
  dataModel: null,
  parcelGeoJson: { type: "FeatureCollection", features: [] },
  hoveredLookupKey: null,
  selectedLookupKey: null,
  syncCheckboxUi: () => {},
  basemapSwitcher: null,
};

void initializeApp();

async function initializeApp() {
  renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);

  try {
    const rawRows = await loadImpactRows(CONFIG.dataUrl);
    state.dataModel = prepareImpactData(rawRows);
    const filterUi = initFilterUi({
      dom,
      categoryOrder: CONFIG.categoryOrder,
      categoryCounts: state.dataModel.categoryCounts,
      selectedCategories: state.selectedCategories,
      onCategoryChange: handleCategoryChange,
      onSelectAll: handleSelectAll,
      onClearAll: handleClearAll,
      onResetView: handleResetView,
    });
    state.syncCheckboxUi = filterUi.syncCheckboxUi;

    state.mapController = createMapController(CONFIG);
    state.basemapSwitcher = initBasemapSwitcher({
      basemaps: CONFIG.basemaps,
      activeBasemapId: state.mapController.getActiveBasemap(),
      onBasemapChange: handleBasemapChange,
    });
    state.mapController.addControl(state.basemapSwitcher, "bottom-right");
    state.mapController.onLoad(async () => {
      try {
        const parcelFeatures = await fetchAllParcelFeatures({
          config: CONFIG,
          rowLookupByParcelKey: state.dataModel.rowLookupByParcelKey,
        });

        state.parcelGeoJson = {
          type: "FeatureCollection",
          features: parcelFeatures,
        };

        state.mapController.addParcelLayers(state.parcelGeoJson);
        state.mapController.bindParcelInteractions({
          onHover: handleParcelHover,
          onLeave: handleMouseLeave,
          onMapClick: handleMapClick,
        });

        applyFilters();
        state.mapController.fitMapToFeatures(parcelFeatures);

        const unmatchedParcelIds = getUnmatchedParcelIds(
          state.dataModel.rowLookupByParcelKey,
          state.parcelGeoJson,
        );
        renderStatusBox(dom.statusBoxEl, {
          mappedCount: parcelFeatures.length,
          unmatchedCount: unmatchedParcelIds.length,
          excludedCount: state.dataModel.excludedCleanupRows.length,
        });
        renderMissingParcelList(dom.missingListEl, unmatchedParcelIds);
      } catch (error) {
        console.error(error);
        renderStatusError(dom.statusBoxEl, {
          title: "Parcel loading issue.",
          message:
            "The statewide parcel service could not be reached from the browser, even after a fallback request method. Error: " +
            String(error?.message || "Unknown error"),
        });
      }
    });
  } catch (error) {
    console.error(error);
    renderStatusError(dom.statusBoxEl, {
      title: "Data loading issue.",
      message:
        "The runtime data file could not be loaded. Serve this app over HTTP and confirm data/row-impacts.json is present. Error: " +
        String(error?.message || "Unknown error"),
    });
  }
}

async function loadImpactRows(dataUrl) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Expected row-impacts.json to contain an array");
  return rows;
}

function handleCategoryChange(category, isChecked) {
  if (isChecked) state.selectedCategories.add(category);
  else state.selectedCategories.delete(category);
  applyFilters();
}

function handleSelectAll() {
  state.selectedCategories.clear();
  CONFIG.categoryOrder.forEach((category) => state.selectedCategories.add(category));
  state.syncCheckboxUi();
  applyFilters();
}

function handleClearAll() {
  state.selectedCategories.clear();
  state.syncCheckboxUi();
  applyFilters();
}

function handleResetView() {
  if (state.mapController) state.mapController.resetView();
}

function handleBasemapChange(basemapId) {
  if (!state.mapController || !state.basemapSwitcher) return;
  state.mapController.setActiveBasemap(basemapId);
  state.basemapSwitcher.syncActiveBasemap(state.mapController.getActiveBasemap());
}

function applyFilters() {
  state.parcelGeoJson.features.forEach((feature) => {
    const matchingRows = getMatchingRowsForFeature(
      feature,
      state.dataModel?.rowLookupByParcelKey || new Map(),
    );
    const visibleRows = matchingRows.filter((row) => state.selectedCategories.has(row.impactCategory));
    feature.properties.displayImpact = visibleRows.length
      ? getHighestCategory(visibleRows, CONFIG.categoryOrder)
      : getHighestCategory(matchingRows, CONFIG.categoryOrder);
    feature.properties.isVisible = visibleRows.length ? 1 : 0;
  });

  if (state.mapController) {
    state.mapController.setParcelData(state.parcelGeoJson);
  }

  if (state.selectedLookupKey) {
    const selectedFeature = getFeatureByLookupKey(state.selectedLookupKey);
    if (!selectedFeature || selectedFeature.properties.isVisible !== 1) clearSelection();
  }

  if (state.hoveredLookupKey) {
    const hoveredFeature = getFeatureByLookupKey(state.hoveredLookupKey);
    if (!hoveredFeature || hoveredFeature.properties.isVisible !== 1) {
      state.hoveredLookupKey = null;
      if (state.mapController) state.mapController.updateHoverOutline(null);
      hideTooltip(dom.tooltipEl);
      if (!state.selectedLookupKey) {
        renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);
      }
    }
  }

  if (state.mapController) {
    state.mapController.updateHoverOutline(state.hoveredLookupKey);
    state.mapController.updateSelectedOutline(state.selectedLookupKey);
  }
}

function handleParcelHover(event) {
  const feature = event.features?.find((candidate) => candidate.properties?.isVisible === 1);
  if (!feature) {
    handleMouseLeave();
    return;
  }

  state.mapController.getCanvas().style.cursor = "pointer";
  state.hoveredLookupKey = feature.properties.lookupKey;
  state.mapController.updateHoverOutline(state.hoveredLookupKey);

  const matchingRows = getMatchingRowsForFeature(feature, state.dataModel.rowLookupByParcelKey);
  if (!state.selectedLookupKey) {
    renderParcelDetails({
      parcelDetailsEl: dom.parcelDetailsEl,
      feature,
      matchingRows,
      modeLabel: "Hovering",
      categoryColors: CONFIG.categoryColors,
      categoryOrder: CONFIG.categoryOrder,
    });
  }

  renderTooltip({
    tooltipEl: dom.tooltipEl,
    point: event.point,
    matchingRows,
    mapContainer: state.mapController.getContainer(),
  });
}

function handleMouseLeave() {
  state.hoveredLookupKey = null;
  if (state.mapController) {
    state.mapController.updateHoverOutline(null);
    state.mapController.getCanvas().style.cursor = "";
  }
  hideTooltip(dom.tooltipEl);
  if (!state.selectedLookupKey) {
    renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);
  }
}

function handleMapClick(event) {
  const clickedFeature = state.mapController.queryVisibleFeatureAtPoint(event.point);
  if (clickedFeature) {
    const lookupKey = clickedFeature.properties.lookupKey;
    if (state.selectedLookupKey === lookupKey) {
      clearSelection();
      return;
    }

    state.selectedLookupKey = lookupKey;
    state.mapController.updateSelectedOutline(state.selectedLookupKey);
    renderParcelDetails({
      parcelDetailsEl: dom.parcelDetailsEl,
      feature: clickedFeature,
      matchingRows: getMatchingRowsForFeature(clickedFeature, state.dataModel.rowLookupByParcelKey),
      modeLabel: "Selected",
      categoryColors: CONFIG.categoryColors,
      categoryOrder: CONFIG.categoryOrder,
    });
    return;
  }

  clearSelection();
}

function clearSelection() {
  state.selectedLookupKey = null;
  if (state.mapController) state.mapController.updateSelectedOutline(null);

  if (state.hoveredLookupKey) {
    const hoveredFeature = getFeatureByLookupKey(state.hoveredLookupKey);
    if (hoveredFeature && hoveredFeature.properties.isVisible === 1) {
      renderParcelDetails({
        parcelDetailsEl: dom.parcelDetailsEl,
        feature: hoveredFeature,
        matchingRows: getMatchingRowsForFeature(hoveredFeature, state.dataModel.rowLookupByParcelKey),
        modeLabel: "Hovering",
        categoryColors: CONFIG.categoryColors,
        categoryOrder: CONFIG.categoryOrder,
      });
      return;
    }
  }

  renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);
}

function getFeatureByLookupKey(lookupKey) {
  return (
    state.parcelGeoJson.features.find((feature) => feature.properties?.lookupKey === lookupKey) ||
    null
  );
}
