import { CONFIG } from "./config.js";
import {
  getMatchingRowsForFeature,
  getRollupValue,
  getSchemeById,
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
  initSchemeSwitcher,
  renderDetailPlaceholder,
  renderMissingParcelList,
  renderParcelDetails,
  renderSchemeHeader,
  renderStatusBox,
  renderStatusError,
  renderTooltip,
} from "./ui.js";

const dom = getDomRefs();

const state = {
  activeSchemeId: CONFIG.defaultSchemeId,
  filterSelectionsBySchemeId: buildInitialFilterSelections(CONFIG.schemes),
  mapController: null,
  dataModel: null,
  parcelGeoJson: { type: "FeatureCollection", features: [] },
  hoveredLookupKey: null,
  selectedLookupKey: null,
  filterUi: null,
  schemeSwitcher: null,
  basemapSwitcher: null,
};

void initializeApp();

function buildInitialFilterSelections(schemes) {
  const map = new Map();
  schemes.forEach((scheme) => {
    map.set(scheme.id, new Set(scheme.values.map((entry) => entry.id)));
  });
  return map;
}

function getActiveScheme() {
  return getSchemeById(CONFIG.schemes, state.activeSchemeId);
}

function getActiveSelections() {
  return state.filterSelectionsBySchemeId.get(state.activeSchemeId);
}

async function initializeApp() {
  renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);

  try {
    const rawRows = await loadImpactRows(CONFIG.dataUrl);
    state.dataModel = prepareImpactData(rawRows, CONFIG.schemes);

    state.schemeSwitcher = initSchemeSwitcher({
      dom,
      schemes: CONFIG.schemes,
      activeSchemeId: state.activeSchemeId,
      onSchemeChange: handleSchemeChange,
    });

    const activeScheme = getActiveScheme();
    renderSchemeHeader({ dom, scheme: activeScheme });

    state.filterUi = initFilterUi({
      dom,
      scheme: activeScheme,
      counts: state.dataModel.countsBySchemeId.get(activeScheme.id) || {},
      selectedValues: getActiveSelections(),
      onValueChange: handleValueChange,
      onSelectAll: handleSelectAll,
      onClearAll: handleClearAll,
      onResetView: handleResetView,
    });

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
          defaultScheme: activeScheme,
        });

        state.parcelGeoJson = {
          type: "FeatureCollection",
          features: parcelFeatures,
        };

        state.mapController.addParcelLayers(state.parcelGeoJson, activeScheme);
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

function handleValueChange(valueId, isChecked) {
  const selections = getActiveSelections();
  if (isChecked) selections.add(valueId);
  else selections.delete(valueId);
  applyFilters();
}

function handleSelectAll() {
  const activeScheme = getActiveScheme();
  const selections = getActiveSelections();
  selections.clear();
  activeScheme.values.forEach((entry) => selections.add(entry.id));
  state.filterUi.syncCheckboxUi(selections);
  applyFilters();
}

function handleClearAll() {
  getActiveSelections().clear();
  state.filterUi.syncCheckboxUi(getActiveSelections());
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

function handleSchemeChange(nextSchemeId) {
  if (!state.filterSelectionsBySchemeId.has(nextSchemeId)) return;
  state.activeSchemeId = nextSchemeId;
  const activeScheme = getActiveScheme();

  renderSchemeHeader({ dom, scheme: activeScheme });

  state.filterUi.rerenderFilterList(
    activeScheme,
    state.dataModel.countsBySchemeId.get(activeScheme.id) || {},
    getActiveSelections(),
    handleValueChange,
  );

  if (state.mapController) state.mapController.setActiveColorScheme(activeScheme);

  applyFilters();
  refreshDetailPanelForActiveScheme();
}

function refreshDetailPanelForActiveScheme() {
  const activeScheme = getActiveScheme();

  if (state.selectedLookupKey) {
    const selectedFeature = getFeatureByLookupKey(state.selectedLookupKey);
    if (selectedFeature) {
      renderParcelDetails({
        parcelDetailsEl: dom.parcelDetailsEl,
        feature: selectedFeature,
        matchingRows: getMatchingRowsForFeature(selectedFeature, state.dataModel.rowLookupByParcelKey),
        modeLabel: "Selected",
        activeScheme,
      });
      return;
    }
  }

  if (state.hoveredLookupKey) {
    const hoveredFeature = getFeatureByLookupKey(state.hoveredLookupKey);
    if (hoveredFeature && hoveredFeature.properties.isVisible === 1) {
      renderParcelDetails({
        parcelDetailsEl: dom.parcelDetailsEl,
        feature: hoveredFeature,
        matchingRows: getMatchingRowsForFeature(hoveredFeature, state.dataModel.rowLookupByParcelKey),
        modeLabel: "Hovering",
        activeScheme,
      });
      return;
    }
  }

  renderDetailPlaceholder(dom.parcelDetailsEl, CONFIG.detailPlaceholderText);
}

function applyFilters() {
  const activeScheme = getActiveScheme();

  state.parcelGeoJson.features.forEach((feature) => {
    const matchingRows = getMatchingRowsForFeature(
      feature,
      state.dataModel?.rowLookupByParcelKey || new Map(),
    );
    const visibleRows = matchingRows.filter(isRowVisible);
    feature.properties.displayValue = visibleRows.length
      ? getRollupValue(visibleRows, activeScheme)
      : getRollupValue(matchingRows, activeScheme);
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

function isRowVisible(row) {
  return CONFIG.schemes.every((scheme) => {
    const value = row[scheme.field] || scheme.fallbackValueId;
    const selections = state.filterSelectionsBySchemeId.get(scheme.id);
    return selections ? selections.has(value) : true;
  });
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
      activeScheme: getActiveScheme(),
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
      activeScheme: getActiveScheme(),
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
        activeScheme: getActiveScheme(),
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
