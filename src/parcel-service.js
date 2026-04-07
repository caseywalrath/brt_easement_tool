import { chunkArray, findMatchingLookupKey, normalizeParcelId } from "./data-model.js";

function jsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `parcelJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let timer = null;

    const cleanup = () => {
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
      if (timer) clearTimeout(timer);
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src = `${url}&f=pjson&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP request failed"));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP request timed out"));
    }, 25000);

    document.body.appendChild(script);
  });
}

async function arcgisQuery(baseUrl, params) {
  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(`${url}&f=geojson`, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const geojson = await response.json();
    if (Array.isArray(geojson.features)) return geojson.features;
    throw new Error("Unexpected geojson response");
  } catch (fetchError) {
    const pjson = await jsonpRequest(url);
    const features = Array.isArray(pjson.features) ? pjson.features : [];

    return features
      .map((feature) => ({
        type: "Feature",
        properties: feature.attributes || {},
        geometry: esriGeometryToGeoJSON(feature.geometry),
      }))
      .filter((feature) => feature.geometry);
  }
}

function esriGeometryToGeoJSON(geometry) {
  if (!geometry) return null;
  if (Array.isArray(geometry.rings)) return { type: "Polygon", coordinates: geometry.rings };
  return null;
}

export async function fetchAllParcelFeatures({ config, rowLookupByParcelKey }) {
  const uniqueLookupKeys = Array.from(rowLookupByParcelKey.keys());
  const chunks = chunkArray(uniqueLookupKeys, config.parcelQueryChunkSize);
  const collectedFeatures = [];
  const collectedLookupKeys = new Set();

  for (const chunk of chunks) {
    const where = chunk
      .map((parcelId) => `parcel_id='${parcelId.replace(/'/g, "''")}'`)
      .join(" OR ");
    const params = new URLSearchParams({
      where,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
    });
    const features = await arcgisQuery(config.statewideParcelServiceUrl, params);

    features.forEach((feature) => {
      const parcelId = normalizeParcelId(feature.properties?.parcel_id || "");
      const matchedLookupKey = findMatchingLookupKey(parcelId, rowLookupByParcelKey);
      if (!matchedLookupKey || collectedLookupKeys.has(matchedLookupKey)) return;

      collectedLookupKeys.add(matchedLookupKey);
      feature.properties = {
        ...feature.properties,
        lookupKey: matchedLookupKey,
        parcelDisplayId: parcelId,
        countyName: feature.properties?.county || feature.properties?.County || "",
        serviceAddress:
          feature.properties?.situs_address || feature.properties?.site_address || "",
        displayImpact: "Other",
        isVisible: 1,
      };
      collectedFeatures.push(feature);
    });
  }

  return collectedFeatures;
}
