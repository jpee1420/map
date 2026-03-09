<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from "vue";
import * as echarts from "echarts";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import { useChartData } from "@/composables/useChartData";
import CalloutLayer from "@/components/charts/CalloutLayer.vue";

const props = defineProps<{
  tabId: string;
}>();

const mapStore = useMapStore();
const uiStore = useUIStore();
const dataStore = useDataStore();
const chartContainer = ref<HTMLElement | null>(null);
const chartInstance = shallowRef<echarts.EChartsType | null>(null);

const activeTab = computed(() =>
  uiStore.tabs.find((t) => t.id === props.tabId),
);
const filters = computed(() => activeTab.value?.filters || []);
const pivotFields = computed(() => activeTab.value?.pivotFields || []);

const { processedData } = useChartData(
  () => dataStore.dataset,
  filters,
  pivotFields,
);

// Helper to normalize names for fuzzy matching
const normalize = (name: string): string => {
  return name
    .toUpperCase()
    .replace(/\bCITY OF\b/g, "")
    .replace(/\bCITY\b/g, "")
    .replace(/\bMUNICIPALITY OF\b/g, "")
    .replace(/\s*\(.*?\)\s*/g, "") // Strip alias (e.g. Region I (Ilocos Region) -> Region I)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Auto-detect which CSV column matches the currently visible GeoJSON boundaries.
 *
 * Priority:
 * 1. Header-based: Use `admColumnsByHeader` to pick the correct column for the
 *    current admin level being displayed (sub-boundaries → province/city column,
 *    base level → region/province column).
 * 2. Value-based fallback: Scan all columns, count matches against boundary names.
 */
const geoColumn = computed(() => {
  const geo = mapStore.filteredGeoJSON || mapStore.geoJSON;
  const ds = dataStore.dataset;
  if (!geo?.features?.length || !ds?.data?.length || !ds.columns?.length)
    return null;

  // ── 1. Try header-based detection first ──
  const { regionCol, provinceCol, cityCol } = admColumnsByHeader.value;
  const hasSubBoundaries = mapStore.visibleSubBoundaryPcodes.size > 0;

  if (hasSubBoundaries) {
    // Sub-boundaries are visible → we're showing a level BELOW the active level
    if (mapStore.activeLevel === 'region' && provinceCol) return provinceCol;
    if (mapStore.activeLevel === 'province' && cityCol) return cityCol;
  } else if (mapStore.selectedBoundaryPcode) {
    // A boundary is selected but no sub-boundaries → still showing the selected boundary level
    if (mapStore.activeLevel === 'region' && regionCol) return regionCol;
    if (mapStore.activeLevel === 'province' && provinceCol) return provinceCol;
  } else {
    // No selection → showing all regions at the current level
    if (mapStore.activeLevel === 'region' && regionCol) return regionCol;
    if (mapStore.activeLevel === 'province' && provinceCol) return provinceCol;
  }

  // ── 2. Fall back to value-based detection ──
  const boundaryNames = new Set<string>();
  const normalizedBoundaryNames = new Set<string>();
  geo.features.forEach((f: any) => {
    const name =
      f.properties?.name ||
      f.properties?.ADM1_EN ||
      f.properties?.ADM2_EN ||
      f.properties?.ADM3_EN;
    if (name) {
      boundaryNames.add(name.toUpperCase());
      normalizedBoundaryNames.add(normalize(name));

      const aliasMatch = name.match(/\(([^)]+)\)/);
      if (aliasMatch && aliasMatch[1]) {
        boundaryNames.add(aliasMatch[1].toUpperCase());
        normalizedBoundaryNames.add(normalize(aliasMatch[1]));
      }
    }
  });

  if (boundaryNames.size === 0) return null;

  let bestCol: string | null = null;
  let bestMatches = 0;

  for (const col of ds.columns) {
    const uniqueValues = new Set<string>();
    for (const row of ds.data) {
      const val = row[col];
      if (val != null && val !== "") {
        uniqueValues.add(String(val).toUpperCase());
      }
    }

    let matches = 0;
    for (const val of uniqueValues) {
      if (
        boundaryNames.has(val) ||
        normalizedBoundaryNames.has(normalize(val))
      ) {
        matches++;
      }
    }

    if (matches > bestMatches) {
      bestMatches = matches;
      bestCol = col;
    }
  }

  return bestMatches > 0 ? bestCol : null;
});

/**
 * Build a structured feature lookup from the currently visible GeoJSON.
 * Each entry stores the feature's display name plus its parent ADM names
 * so we can disambiguate names that exist at multiple admin levels.
 */
interface GeoFeatureEntry {
  name: string;
  nameUpper: string;
  nameNorm: string;
  pcode: string;
  adm1: string;
  adm2: string;
  adm3: string;
  adm2_pcode: string;
  adm3_pcode: string;
}

const featureLookup = computed<GeoFeatureEntry[]>(() => {
  const geo = mapStore.filteredGeoJSON || mapStore.geoJSON;
  if (!geo?.features?.length) return [];

  return geo.features.map((f: any) => {
    const props = f.properties || {};
    const name: string =
      props.name || props.ADM1_EN || props.ADM2_EN || props.ADM3_EN || '';
    return {
      name,
      nameUpper: name.toUpperCase(),
      nameNorm: normalize(name),
      pcode: (props.pcode || '') as string,
      adm1: (props.ADM1_EN || '') as string,
      adm2: (props.ADM2_EN || '') as string,
      adm3: (props.ADM3_EN || '') as string,
      adm2_pcode: (props.ADM2_PCODE || '') as string,
      adm3_pcode: (props.ADM3_PCODE || '') as string,
    };
  }).filter((e: GeoFeatureEntry) => e.name);
});

/**
 * Auto-detect which CSV columns correspond to each admin level by
 * matching column HEADERS against known patterns.
 *
 * ADM1 (Region):       region, regions
 * ADM2 (Province):     province, provinces
 * ADM3 (City/Muni):    municipality, municipalities, city, cities,
 *                      municipality/city, municipalities/cities,
 *                      city/municipality, cities/municipalities, etc.
 *
 * Falls back to value-based matching when headers don't match.
 */
const ADM1_PATTERNS = /^(region|regions)$/i;
const ADM2_PATTERNS = /^(province|provinces)$/i;
const ADM3_PATTERNS = /^(municipality|municipalities|city|cities|municip.*cit.*|cit.*municip.*|municipality\s*\/\s*city|city\s*\/\s*municipality|municipalities\s*\/\s*cities|cities\s*\/\s*municipalities|barangay|barangays)$/i;

const admColumnsByHeader = computed<{
  regionCol: string | null;
  provinceCol: string | null;
  cityCol: string | null;
}>(() => {
  const ds = dataStore.dataset;
  if (!ds?.columns?.length) return { regionCol: null, provinceCol: null, cityCol: null };

  let regionCol: string | null = null;
  let provinceCol: string | null = null;
  let cityCol: string | null = null;

  for (const col of ds.columns) {
    const headerTrimmed = col.trim();
    if (ADM1_PATTERNS.test(headerTrimmed)) regionCol = col;
    else if (ADM2_PATTERNS.test(headerTrimmed)) provinceCol = col;
    else if (ADM3_PATTERNS.test(headerTrimmed)) cityCol = col;
  }

  // If header matching found nothing, fall back to value-based scan
  if (!regionCol && !provinceCol && !cityCol && ds.data?.length) {
    const regionNames = new Set<string>();
    const regionNorms = new Set<string>();
    mapStore.regionList.forEach((r: { name: string }) => {
      regionNames.add(r.name.toUpperCase());
      regionNorms.add(normalize(r.name));
      const alias = r.name.match(/\(([^)]+)\)/);
      if (alias?.[1]) {
        regionNames.add(alias[1].toUpperCase());
        regionNorms.add(normalize(alias[1]));
      }
    });

    const provinceNames = new Set<string>();
    const provinceNorms = new Set<string>();
    mapStore.provinceList.forEach((p: { name: string }) => {
      provinceNames.add(p.name.toUpperCase());
      provinceNorms.add(normalize(p.name));
    });

    let bestRegionScore = 0;
    let bestProvinceScore = 0;

    for (const col of ds.columns) {
      const uniqueVals = new Set<string>();
      for (const row of ds.data) {
        const v = row[col];
        if (v != null && v !== '') uniqueVals.add(String(v).toUpperCase());
      }

      let regionMatches = 0;
      let provinceMatches = 0;
      for (const v of uniqueVals) {
        const n = normalize(v);
        if (regionNames.has(v) || regionNorms.has(n)) regionMatches++;
        if (provinceNames.has(v) || provinceNorms.has(n)) provinceMatches++;
      }

      if (regionMatches > bestRegionScore) {
        bestRegionScore = regionMatches;
        regionCol = col;
      }
      if (provinceMatches > bestProvinceScore) {
        bestProvinceScore = provinceMatches;
        provinceCol = col;
      }
    }
  }

  return { regionCol, provinceCol, cityCol };
});

/**
 * Build the GeoJSON name lookup map from the currently filtered GeoJSON.
 * Used as a simple name→displayName resolver when no parent context is needed.
 */
const geoNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const f of featureLookup.value) {
    map.set(f.nameUpper, f.name);
    map.set(f.nameNorm, f.name);
    // Alias from parentheses
    const aliasMatch = f.name.match(/\(([^)]+)\)/);
    if (aliasMatch?.[1]) {
      map.set(aliasMatch[1].toUpperCase(), f.name);
      map.set(normalize(aliasMatch[1]), f.name);
    }
  }
  return map;
});

/**
 * Match a CSV row's geographic value to a GeoJSON feature name,
 * using the row's parent columns (Region, Province) for disambiguation.
 */
function matchGeoNameForRow(
  raw: string,
  row: Record<string, unknown>,
): string {
  const rawUpper = raw.toUpperCase();
  const rawNorm = normalize(raw);
  const features = featureLookup.value;

  // Find all features whose name matches the raw value
  const candidates = features.filter(
    (f) =>
      f.nameUpper === rawUpper ||
      f.nameNorm === rawNorm,
  );

  // No match at all → fall back to simple lookup or raw
  if (candidates.length === 0) {
    return geoNameMap.value.get(rawUpper) || geoNameMap.value.get(rawNorm) || raw;
  }

  // Only one candidate → no ambiguity
  if (candidates.length === 1) return candidates[0]!.name;

  // Multiple candidates → disambiguate using parent columns
  const { regionCol, provinceCol } = admColumnsByHeader.value;

  for (const cand of candidates) {
    let parentMatch = true;

    // Check region parent
    if (regionCol && cand.adm1) {
      const rowRegion = String(row[regionCol] || '');
      const candRegionNorm = normalize(cand.adm1);
      const rowRegionNorm = normalize(rowRegion);
      // Also check alias (e.g., "CAR" matches "Cordillera Administrative Region (CAR)")
      const candRegionAlias = cand.adm1.match(/\(([^)]+)\)/);
      const aliasNorm = candRegionAlias?.[1] ? normalize(candRegionAlias[1]) : '';
      if (
        rowRegionNorm !== candRegionNorm &&
        rowRegionNorm !== aliasNorm &&
        rowRegion.toUpperCase() !== cand.adm1.toUpperCase()
      ) {
        parentMatch = false;
      }
    }

    // Check province parent
    if (parentMatch && provinceCol && cand.adm2) {
      const rowProvince = String(row[provinceCol] || '');
      if (rowProvince && normalize(rowProvince) !== normalize(cand.adm2)) {
        parentMatch = false;
      }
    }

    if (parentMatch) return cand.name;
  }

  // No parent match found — return first candidate as fallback
  return candidates[0]!.name;
}

const allAggregatedData = computed(() => {
  const data = processedData.value;
  const geoDim = geoColumn.value;

  if (!data.length || !geoDim) return [];

  // No metric field → no data visualization
  const metricFields = pivotFields.value.filter(
    (f: any) => f.fieldType === "metric",
  );
  if (metricFields.length === 0) return [];

  const breakdownFields = pivotFields.value.filter(
    (f: any) => f.fieldType === "breakdown",
  );

  // Only use explicit breakdown fields — dimension fields do NOT trigger breakdown
  const bdFields = breakdownFields;

  // Determine the breakdown dimension name
  const breakdownDimName =
    bdFields.length > 0
      ? bdFields.map((f: any) => f.displayName || f.column).join(" / ")
      : undefined;

  // Group raw rows by the auto-detected geographic column
  const groups = new Map<
    string,
    {
      rows: Array<Record<string, unknown>>;
      breakdowns: Map<string, number>;
    }
  >();

  for (const row of data) {
    const geoRaw = String(row[geoDim] || "");
    const matchedGeo = matchGeoNameForRow(geoRaw, row);

    if (!groups.has(matchedGeo)) {
      groups.set(matchedGeo, { rows: [], breakdowns: new Map() });
    }
    const group = groups.get(matchedGeo)!;
    group.rows.push(row);

    // Build breakdown from breakdown/dimension fields
    if (bdFields.length > 0) {
      const bdKey = bdFields
        .map((f: any) => String(row[f.column] || "Unknown"))
        .join(" - ");
      group.breakdowns.set(bdKey, (group.breakdowns.get(bdKey) || 0) + 1);
    }
  }

  // Aggregate each group
  return Array.from(groups.entries()).map(([geoName, group]) => {
    // Compute main value: use first metric (aggregated), or default to record count
    let mainValue: number;

    if (metricFields.length > 0) {
      const mf = metricFields[0]!;
      if (mf.aggregation === "count") {
        mainValue = group.rows.length;
      } else {
        const nums = group.rows
          .map((r: any) => Number(r[mf.column]))
          .filter((n: number) => !isNaN(n));
        if (mf.aggregation === "sum")
          mainValue = nums.reduce((a: number, b: number) => a + b, 0);
        else if (mf.aggregation === "avg")
          mainValue = nums.length
            ? nums.reduce((a: number, b: number) => a + b, 0) / nums.length
            : 0;
        else if (mf.aggregation === "min")
          mainValue = nums.length ? Math.min(...nums) : 0;
        else if (mf.aggregation === "max")
          mainValue = nums.length ? Math.max(...nums) : 0;
        else mainValue = nums.reduce((a: number, b: number) => a + b, 0);
      }
    } else {
      mainValue = group.rows.length; // Default: Record Count
    }

    const item: Record<string, unknown> = {
      name: geoName,
      value: mainValue,
    };

    // Add breakdowns if user has configured breakdown dimensions
    if (breakdownDimName && group.breakdowns.size > 0) {
      item.breakdownDimension = breakdownDimName;
      item.breakdowns = Array.from(group.breakdowns.entries()).map(
        ([label, count]) => ({
          label,
          value: count,
          percentage:
            mainValue > 0
              ? Math.round((count / group.rows.length) * 1000) / 10
              : 0,
        }),
      );
    }

    return item;
  });
});

const fixedMapTotal = computed(() => {
  return allAggregatedData.value.reduce((sum, item) => {
    // Only sum data for items that exist in the current map boundaries
    if (!featureLookup.value.some(f => f.name === item.name)) {
      return sum;
    }
    const val = typeof item.value === 'number' ? item.value : 0;
    return sum + val;
  }, 0);
});

const mapData = computed(() => {
  const visibleSubs = mapStore.visibleSubBoundaryPcodes;
  
  if (visibleSubs.size === 0) {
    return allAggregatedData.value;
  }

  return allAggregatedData.value.filter(item => {
    const feature = featureLookup.value.find(f => f.name === item.name);
    if (!feature) return true;
    
    // For NCR at region level, sub-boundaries are cities (ADM3), not provinces (ADM2)
    const isNCR = mapStore.activeLevel === 'region' && mapStore.selectedBoundaryPcode === 'PH13';
    const pcodeToCheck = (mapStore.activeLevel === 'province' || isNCR)
      ? feature.adm3_pcode || feature.pcode
      : feature.adm2_pcode || feature.pcode;
      
    if (pcodeToCheck && !visibleSubs.has(pcodeToCheck)) {
      return false; // exclude if its boundary is unchecked
    }
    return true;
  });
});

const visualMapRange = computed(() => {
  if (mapData.value.length === 0) return { min: 0, max: 100 };
  const values = mapData.value.map((d: any) => d.value as number);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
});

const currentMapName = ref("PH_CURRENT");

function getOptions() {
  const hasData = mapData.value.length > 0;

  // Get color scale from first metric field if configured
  const firstMetric = pivotFields.value.find(
    (f: any) => f.fieldType === "metric",
  );
  const colorScale = firstMetric?.colorScale;
  const defaultColors = [
    "#e0f3db",
    "#ccebc5",
    "#a8ddb5",
    "#7bccc4",
    "#4eb3d3",
    "#2b8cbe",
    "#0868ac",
    "#084081",
  ];
  const visualMapColors = colorScale
    ? [colorScale.min, colorScale.max]
    : defaultColors;

  return {
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#3b82f6",
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: "#1f2937",
      },
      formatter: (params: any) => {
        const name = params.name || "Unknown";
        const dataItem = mapData.value.find((d: any) => d.name === name);

        if (!dataItem) {
          return `<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${name}</div><div style="color: #6b7280;">No data available</div>`;
        }

        // Build tooltip with all metrics
        let html = `<div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2937;">${name}</div>`;

        // Get all numeric properties as metrics
        const metricEntries = Object.entries(dataItem).filter(
          ([key, val]) => key !== "name" && typeof val === "number",
        );

        if (metricEntries.length > 0) {
          html +=
            '<div style="display: flex; flex-direction: column; gap: 4px;">';
          metricEntries.forEach(([key, val]) => {
            const formattedVal =
              typeof val === "number" ? val.toLocaleString() : val;
            html += `<div style="display: flex; justify-content: space-between; gap: 16px;">
              <span style="color: #6b7280;">${key}:</span>
              <span style="font-weight: 600; color: #3b82f6;">${formattedVal}</span>
            </div>`;
          });
          html += "</div>";
        }

        return html;
      },
    },
    visualMap: hasData
      ? {
          left: "right",
          min: visualMapRange.value.min,
          max: visualMapRange.value.max,
          inRange: {
            color: visualMapColors,
          },
          text: ["High", "Low"],
          calculable: true,
        }
      : null,
    geo: {
      map: currentMapName.value,
      roam: true,
      emphasis: {
        label: { show: true },
        itemStyle: { areaColor: "#fcd34d" },
      },
      itemStyle: {
        areaColor: "#e5e7eb",
        borderColor: "#fff",
      },
      select: {
        itemStyle: {
          areaColor: "#60a5fa",
        },
      },
    },
    series: [
      {
        type: "map",
        geoIndex: 0,
        data: mapData.value,
      },
    ],
  };
}

function registerAndRenderMap(geoData: any, mapName: string) {
  if (!geoData || !chartInstance.value) return;

  echarts.registerMap(mapName, geoData);
  currentMapName.value = mapName;
  // Clear the instance to reset any active pan/zoom state which gets trapped
  // when bounding box shrinks due to sub-boundary removal
  chartInstance.value.clear();
  chartInstance.value.setOption(getOptions(), true);
}

watch(
  [mapData, visualMapRange, pivotFields],
  () => {
    chartInstance.value?.setOption(getOptions(), true);
  },
  { deep: true },
);

// Use ResizeObserver natively in onMounted to handle container fluid resizing

// Single watcher for all map data changes — filteredGeoJSON always returns
// the correct GeoJSON to render (filtered for sub-boundaries, or raw otherwise)
watch(
  () => mapStore.filteredGeoJSON,
  (newGeo) => {
    if (newGeo && chartInstance.value) {
      registerAndRenderMap(newGeo, "PH_CURRENT");
    }
  },
  { deep: true, immediate: true },
);

watch(
  () => props.tabId,
  () => {
    chartInstance.value?.resize();
  },
);

const resizeObserver = new ResizeObserver(() => {
  chartInstance.value?.resize();
});

function onMapClick(params: any) {
  if (params.componentType === "geo") {
    const clickedName = params.name;
    // Find the PCODE for the clicked boundary by name
    const boundary = mapStore.boundariesForLevel.find(
      (b) => b.name === clickedName,
    );
    if (boundary) {
      mapStore.selectBoundary(boundary.pcode);
    }
  }
}

onMounted(async () => {
  if (chartContainer.value) {
    chartInstance.value = echarts.init(chartContainer.value);

    // If GeoJSON already loaded (e.g. tab switch), the immediate watcher handles it.
    // Otherwise, trigger the first load.
    if (!mapStore.geoJSON) {
      await mapStore.loadMapData(mapStore.activeLevel);
    }

    // Re-register from filteredGeoJSON in case it's already available
    const geo = mapStore.filteredGeoJSON;
    if (geo) {
      registerAndRenderMap(geo, "PH_CURRENT");
    }

    chartInstance.value.on("click", onMapClick);
    chartInstance.value.on("georoam", () => {
      // Small trigger to force reactivity if needed
    });

    resizeObserver.observe(chartContainer.value);
  }
});

onUnmounted(() => {
  chartInstance.value?.dispose();
  resizeObserver.disconnect();
});

defineExpose({ chartInstance });
</script>

<template>
  <div class="w-full h-full relative group">
    <div
      v-if="mapStore.isLoading"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 transition-opacity"
    >
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      ></div>
    </div>

    <div ref="chartContainer" class="w-full h-full"></div>

    <!-- Callout Layer Overlay -->
    <CalloutLayer
      v-if="chartInstance && mapStore.filteredGeoJSON && mapStore.showLabels"
      :chartInstance="chartInstance"
      :geoData="mapStore.filteredGeoJSON"
      :mapData="mapData"
      :globalTotal="fixedMapTotal"
    />
  </div>
</template>
