import {
  escapeHtml,
  formatValue,
  getRecordTitle,
  getRollupValue,
  getValueColor,
  joinUniqueValues,
  valueClassName,
} from "./data-model.js";

export function getDomRefs(documentRef = document) {
  return {
    schemeSwitcherEl: documentRef.getElementById("scheme-switcher"),
    schemeLabelEl: documentRef.getElementById("active-scheme-label"),
    schemeHelperTextEl: documentRef.getElementById("scheme-helper-text"),
    filterListEl: documentRef.getElementById("filter-list"),
    parcelDetailsEl: documentRef.getElementById("parcel-details"),
    statusBoxEl: documentRef.getElementById("status-box"),
    missingListEl: documentRef.getElementById("missing-list"),
    tooltipEl: documentRef.getElementById("hover-tooltip"),
    selectAllBtn: documentRef.getElementById("select-all-btn"),
    clearAllBtn: documentRef.getElementById("clear-all-btn"),
    resetViewBtn: documentRef.getElementById("reset-view-btn"),
  };
}

export function initSchemeSwitcher({ dom, schemes, activeSchemeId, onSchemeChange }) {
  dom.schemeSwitcherEl.innerHTML = "";

  const select = document.createElement("select");
  select.className = "scheme-select";
  select.setAttribute("aria-label", "Active display dimension");

  schemes.forEach((scheme) => {
    const option = document.createElement("option");
    option.value = scheme.id;
    option.textContent = scheme.label;
    if (scheme.id === activeSchemeId) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener("change", () => onSchemeChange(select.value));
  dom.schemeSwitcherEl.appendChild(select);

  return {
    syncActiveScheme(schemeId) {
      select.value = schemeId;
    },
  };
}

export function renderSchemeHeader({ dom, scheme }) {
  if (dom.schemeLabelEl) dom.schemeLabelEl.textContent = scheme.label;
  if (dom.schemeHelperTextEl) {
    dom.schemeHelperTextEl.textContent = scheme.helperText || "";
  }
}

export function initFilterUi({
  dom,
  scheme,
  counts,
  selectedValues,
  onValueChange,
  onSelectAll,
  onClearAll,
  onResetView,
}) {
  renderFilterList({ dom, scheme, counts, selectedValues, onValueChange });

  dom.selectAllBtn.addEventListener("click", onSelectAll);
  dom.clearAllBtn.addEventListener("click", onClearAll);
  dom.resetViewBtn.addEventListener("click", onResetView);

  return {
    syncCheckboxUi(currentSelectedValues) {
      dom.filterListEl
        .querySelectorAll("input[type='checkbox']")
        .forEach((checkbox) => {
          checkbox.checked = currentSelectedValues.has(checkbox.value);
        });
    },
    rerenderFilterList(nextScheme, nextCounts, nextSelectedValues, nextOnValueChange) {
      renderFilterList({
        dom,
        scheme: nextScheme,
        counts: nextCounts,
        selectedValues: nextSelectedValues,
        onValueChange: nextOnValueChange,
      });
    },
  };
}

function renderFilterList({ dom, scheme, counts, selectedValues, onValueChange }) {
  dom.filterListEl.innerHTML = "";

  scheme.values.forEach((entry) => {
    const rowElement = document.createElement("label");
    rowElement.className = "checkbox-row";
    rowElement.innerHTML =
      `<div class="checkbox-row-left">` +
      `<input type="checkbox" value="${escapeHtml(entry.id)}"${selectedValues.has(entry.id) ? " checked" : ""} />` +
      `<span class="scheme-dot" style="background:${escapeHtml(entry.color)}"></span>` +
      `<span>${escapeHtml(entry.id)}</span>` +
      `</div>` +
      `<span class="count-pill">${counts[entry.id] || 0}</span>`;

    const checkbox = rowElement.querySelector("input");
    checkbox.addEventListener("change", () => onValueChange(entry.id, checkbox.checked));
    dom.filterListEl.appendChild(rowElement);
  });
}

export function renderDetailPlaceholder(parcelDetailsEl, detailPlaceholderText) {
  parcelDetailsEl.innerHTML = detailPlaceholderText;
}

export function initBasemapSwitcher({ basemaps, activeBasemapId, onBasemapChange }) {
  let containerEl = null;
  let toggleBtn = null;
  let menuEl = null;
  let menuItemButtons = [];
  let isOpen = false;
  let activeId = activeBasemapId;
  let documentClickHandler = null;
  let documentKeydownHandler = null;

  function setMenuOpen(nextState) {
    isOpen = nextState;
    if (!toggleBtn || !menuEl) return;
    toggleBtn.setAttribute("aria-expanded", String(nextState));
    menuEl.hidden = !nextState;
  }

  function syncActiveBasemap(nextActiveBasemapId) {
    activeId = nextActiveBasemapId;

    const activeBasemap = basemaps.find((basemap) => basemap.id === activeId);
    if (toggleBtn) {
      const basemapLabel = activeBasemap?.label || "Basemap";
      toggleBtn.setAttribute("aria-label", `Basemap switcher. Current basemap: ${basemapLabel}.`);
      toggleBtn.title = `Basemap: ${basemapLabel}`;
    }

    menuItemButtons.forEach((button) => {
      const isActive = button.dataset.basemapId === activeId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-checked", String(isActive));
      const indicatorEl = button.querySelector(".basemap-option-indicator");
      if (indicatorEl) indicatorEl.textContent = isActive ? "✓" : "";
    });
  }

  function buildMenuItems() {
    menuItemButtons = basemaps.map((basemap) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "basemap-option";
      button.dataset.basemapId = basemap.id;
      button.setAttribute("role", "menuitemradio");
      button.innerHTML =
        `<span class="basemap-option-label">${escapeHtml(basemap.label)}</span>` +
        `<span class="basemap-option-indicator" aria-hidden="true"></span>`;
      button.addEventListener("click", () => {
        onBasemapChange(basemap.id);
        syncActiveBasemap(basemap.id);
        setMenuOpen(false);
      });
      return button;
    });

    menuItemButtons.forEach((button) => menuEl.appendChild(button));
  }

  return {
    onAdd() {
      containerEl = document.createElement("div");
      containerEl.className = "mapboxgl-ctrl basemap-switcher";

      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "basemap-toggle";
      toggleBtn.setAttribute("aria-haspopup", "menu");
      toggleBtn.innerHTML =
        `<svg class="basemap-toggle-icon" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">` +
        `<path fill="currentColor" d="M8 1.2 1.2 4.5 8 7.8l6.8-3.3zM1.2 8l6.8 3.3L14.8 8 13.4 7.3 8 9.9 2.6 7.3zm0 3.5L8 14.8l6.8-3.3-1.4-.7L8 13.4l-5.4-2.6z"/>` +
        `</svg>` +
        `<span class="visually-hidden">Open basemap options</span>`;
      toggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setMenuOpen(!isOpen);
      });

      menuEl = document.createElement("div");
      menuEl.className = "basemap-menu";
      menuEl.setAttribute("role", "menu");
      menuEl.hidden = true;

      buildMenuItems();
      syncActiveBasemap(activeId);

      containerEl.appendChild(menuEl);
      containerEl.appendChild(toggleBtn);
      containerEl.addEventListener("click", (event) => event.stopPropagation());

      documentClickHandler = (event) => {
        if (containerEl && !containerEl.contains(event.target)) {
          setMenuOpen(false);
        }
      };
      documentKeydownHandler = (event) => {
        if (event.key === "Escape") setMenuOpen(false);
      };

      document.addEventListener("click", documentClickHandler);
      document.addEventListener("keydown", documentKeydownHandler);

      return containerEl;
    },
    onRemove() {
      document.removeEventListener("click", documentClickHandler);
      document.removeEventListener("keydown", documentKeydownHandler);
      containerEl?.remove();
      containerEl = null;
      toggleBtn = null;
      menuEl = null;
      menuItemButtons = [];
    },
    syncActiveBasemap,
  };
}

export function renderStatusBox(statusBoxEl, { mappedCount, unmatchedCount, excludedCount }) {
  statusBoxEl.innerHTML =
    `<strong>Query complete.</strong><br />` +
    `Parcel polygons loaded: <strong>${mappedCount}</strong><br />` +
    `Parcel IDs still unmatched: <strong>${unmatchedCount}</strong><br />` +
    `Cleanup / placeholder rows excluded from map query: <strong>${excludedCount}</strong><br />` +
    `Request mode: <strong>fetch with JSONP fallback</strong>`;
}

export function renderStatusError(statusBoxEl, { title, message }) {
  statusBoxEl.innerHTML =
    `<strong>${escapeHtml(title)}</strong><br />` +
    `${escapeHtml(message)}`;
}

export function renderMissingParcelList(missingListEl, missingParcelIds) {
  const uniqueIds = Array.from(new Set(missingParcelIds));
  if (!uniqueIds.length) {
    missingListEl.innerHTML = "";
    return;
  }

  const preview = uniqueIds.slice(0, 30);
  missingListEl.innerHTML = preview.map((parcelId) => `<li>${escapeHtml(parcelId)}</li>`).join("");
  if (uniqueIds.length > preview.length) {
    missingListEl.innerHTML += `<li>...and ${uniqueIds.length - preview.length} more</li>`;
  }
}

export function renderTooltip({ tooltipEl, point, matchingRows, mapContainer }) {
  const siteAddress = joinUniqueValues(matchingRows.map((row) => row.siteAddress));
  const propertyType = joinUniqueValues(matchingRows.map((row) => row.propertyType));
  const businessName = joinUniqueValues(matchingRows.map((row) => row.businessName));

  tooltipEl.innerHTML =
    `<strong>Parcel preview</strong>` +
    `<div class="tooltip-row"><span class="tooltip-label">Site Address</span>${escapeHtml(siteAddress)}</div>` +
    `<div class="tooltip-row"><span class="tooltip-label">Property Type</span>${escapeHtml(propertyType)}</div>` +
    `<div class="tooltip-row"><span class="tooltip-label">Property Name</span>${escapeHtml(businessName)}</div>`;

  const mapRect = mapContainer.getBoundingClientRect();
  const tooltipWidth = 320;
  const tooltipHeight = 130;
  let left = point.x + 16;
  let top = point.y + 16;

  if (left + tooltipWidth > mapRect.width - 12) {
    left = Math.max(12, point.x - tooltipWidth - 16);
  }
  if (top + tooltipHeight > mapRect.height - 12) {
    top = Math.max(12, point.y - tooltipHeight - 16);
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.display = "block";
}

export function hideTooltip(tooltipEl) {
  tooltipEl.style.display = "none";
}

export function renderParcelDetails({
  parcelDetailsEl,
  feature,
  matchingRows,
  modeLabel,
  activeScheme,
}) {
  const parcelId = feature.properties?.parcelDisplayId || "Unknown";
  const county = feature.properties?.countyName || "";
  const address = joinUniqueValues(
    [feature.properties?.serviceAddress, ...matchingRows.map((row) => row.siteAddress)],
    "Address not available",
  );
  const rollupValue = getRollupValue(matchingRows, activeScheme);
  const rollupColor = getValueColor(activeScheme, rollupValue);
  const recordsHtml = matchingRows
    .map((record) => {
      const recordValue = record[activeScheme.field] || activeScheme.fallbackValueId;
      const recordColor = getValueColor(activeScheme, recordValue);
      return `
    <article class="record-card" data-scheme-value="${escapeHtml(valueClassName(recordValue))}" style="border-left-color:${escapeHtml(recordColor)}">
      <div class="record-top">
        <div class="record-name">${escapeHtml(formatValue(getRecordTitle(record)))}</div>
        <span class="chip" style="background:${escapeHtml(recordColor)}">${escapeHtml(recordValue)}</span>
      </div>
      <div class="record-grid">
        <div><span class="field-label">Site Address</span><span class="field-value">${escapeHtml(formatValue(record.siteAddress))}</span></div>
        <div><span class="field-label">Property Type</span><span class="field-value">${escapeHtml(formatValue(record.propertyType))}</span></div>
        <div><span class="field-label">Property Name</span><span class="field-value">${escapeHtml(formatValue(record.businessName))}</span></div>
        <div><span class="field-label">Station</span><span class="field-value">${escapeHtml(formatValue(record.station))}</span></div>
        <div><span class="field-label">County</span><span class="field-value">${escapeHtml(formatValue(record.county))}</span></div>
        <div><span class="field-label">Design Segment</span><span class="field-value">${escapeHtml(formatValue(record.designSegment))}</span></div>
        <div><span class="field-label">Roll Plot Viewport</span><span class="field-value">${escapeHtml(formatValue(record.rollPlotViewport))}</span></div>
        <div><span class="field-label">Width from BOW to Building</span><span class="field-value">${escapeHtml(formatValue(record.widthFromBOWToBuilding))}</span></div>
        <div><span class="field-label">Opportunity to Restripe?</span><span class="field-value">${escapeHtml(formatValue(record.opportunityToRestripe))}</span></div>
        <div><span class="field-label">Restriping Options</span><span class="field-value">${escapeHtml(formatValue(record.restripingOptions))}</span></div>
        <div><span class="field-label">Spreadsheet Parcel ID</span><span class="field-value">${escapeHtml(formatValue(record.parcelNumber))}</span></div>
      </div>
      <div class="notes-box"><span class="field-label">Notes</span>${escapeHtml(formatValue(record.notes))}</div>
    </article>`;
    })
    .join("");

  const subtitle = `${escapeHtml(address)}${county ? " &middot; " + escapeHtml(county) + " County" : ""}`;
  const summaryChip = `${escapeHtml(modeLabel)} &middot; ${escapeHtml(rollupValue)}`;

  parcelDetailsEl.innerHTML =
    `<div class="parcel-header">` +
    `<div><h3 class="parcel-title">${escapeHtml(parcelId)}</h3><p class="parcel-subtitle">${subtitle}</p></div>` +
    `<span class="chip" style="background:${escapeHtml(rollupColor)}">${summaryChip}</span>` +
    `</div>` +
    `<div class="helper-text" style="margin:0 0 12px 0;">Showing <strong>${matchingRows.length}</strong> spreadsheet row(s) tied to this parcel.</div>` +
    `<div class="records-stack">${recordsHtml}</div>`;
}
