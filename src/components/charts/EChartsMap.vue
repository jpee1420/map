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
  return name.toUpperCase()
    .replace(/\bCITY OF\b/g, '')
    .replace(/\bCITY\b/g, '')
    .replace(/\bMUNICIPALITY OF\b/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Auto-detect which CSV column matches the currently visible GeoJSON boundaries.
 * Scans all columns, counts how many unique values match boundary names, picks best.
 */
const geoColumn = computed(() => {
  const geo = mapStore.filteredGeoJSON || mapStore.geoJSON;
  const ds = dataStore.dataset;
  if (!geo?.features?.length || !ds?.data?.length || !ds.columns?.length) return null;

  // Build set of boundary names (uppercase + normalized)
  const boundaryNames = new Set<string>();
  const normalizedBoundaryNames = new Set<string>();
  geo.features.forEach((f: any) => {
    const name = f.properties?.name || f.properties?.ADM1_EN || f.properties?.ADM2_EN || f.properties?.ADM3_EN;
    if (name) {
      boundaryNames.add(name.toUpperCase());
      normalizedBoundaryNames.add(normalize(name));
    }
  });

  if (boundaryNames.size === 0) return null;

  let bestCol: string | null = null;
  let bestScore = 0;

  for (const col of ds.columns) {
    // Sample up to 500 rows for performance
    const sampleRows = ds.data.slice(0, 500);
    const uniqueValues = new Set<string>();
    for (const row of sampleRows) {
      const val = row[col];
      if (val != null && val !== '') uniqueValues.add(String(val).toUpperCase());
    }

    // Count matches
    let matches = 0;
    for (const val of uniqueValues) {
      if (boundaryNames.has(val) || normalizedBoundaryNames.has(normalize(val))) {
        matches++;
      }
    }

    // Score = fraction of boundary names matched by this column
    const score = matches / boundaryNames.size;
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestScore >= 0.3 ? bestCol : null;
});

/**
 * Build the GeoJSON name lookup map from the current geoJSON.
 */
const geoNameMap = computed(() => {
  const map = new Map<string, string>();
  if (mapStore.geoJSON?.features) {
    mapStore.geoJSON.features.forEach((feature: any) => {
      const geoName = feature.properties?.name || feature.properties?.ADM1_EN || feature.properties?.ADM2_EN || feature.properties?.ADM3_EN;
      if (geoName) {
        map.set(geoName.toUpperCase(), geoName);
        map.set(normalize(geoName), geoName);
      }
    });
  }
  return map;
});

const matchGeoName = (raw: string): string => {
  return geoNameMap.value.get(raw.toUpperCase()) || geoNameMap.value.get(normalize(raw)) || raw;
};

const mapData = computed(() => {
  const data = processedData.value;
  const geoDim = geoColumn.value;

  if (!data.length || !geoDim) return [];

  // No metric field → no data visualization
  const metricFields = pivotFields.value.filter(
    (f: any) => f.fieldType === 'metric',
  );
  if (metricFields.length === 0) return [];

  const breakdownFields = pivotFields.value.filter(
    (f: any) => f.fieldType === 'breakdown',
  );

  // Only use explicit breakdown fields — dimension fields do NOT trigger breakdown
  const bdFields = breakdownFields;

  // Determine the breakdown dimension name
  const breakdownDimName = bdFields.length > 0
    ? bdFields.map((f: any) => f.displayName || f.column).join(' / ')
    : undefined;

  // Group raw rows by the auto-detected geographic column
  const groups = new Map<string, {
    rows: Array<Record<string, unknown>>;
    breakdowns: Map<string, number>;
  }>();

  for (const row of data) {
    const geoRaw = String(row[geoDim] || '');
    const matchedGeo = matchGeoName(geoRaw);

    if (!groups.has(matchedGeo)) {
      groups.set(matchedGeo, { rows: [], breakdowns: new Map() });
    }
    const group = groups.get(matchedGeo)!;
    group.rows.push(row);

    // Build breakdown from breakdown/dimension fields
    if (bdFields.length > 0) {
      const bdKey = bdFields.map((f: any) => String(row[f.column] || 'Unknown')).join(' - ');
      group.breakdowns.set(bdKey, (group.breakdowns.get(bdKey) || 0) + 1);
    }
  }

  // Aggregate each group
  return Array.from(groups.entries()).map(([geoName, group]) => {
    // Compute main value: use first metric (aggregated), or default to record count
    let mainValue: number;

    if (metricFields.length > 0) {
      const mf = metricFields[0]!;
      if (mf.aggregation === 'count') {
        mainValue = group.rows.length;
      } else {
        const nums = group.rows
          .map((r: any) => Number(r[mf.column]))
          .filter((n: number) => !isNaN(n));
        if (mf.aggregation === 'sum') mainValue = nums.reduce((a: number, b: number) => a + b, 0);
        else if (mf.aggregation === 'avg') mainValue = nums.length ? nums.reduce((a: number, b: number) => a + b, 0) / nums.length : 0;
        else if (mf.aggregation === 'min') mainValue = nums.length ? Math.min(...nums) : 0;
        else if (mf.aggregation === 'max') mainValue = nums.length ? Math.max(...nums) : 0;
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
      item.breakdowns = Array.from(group.breakdowns.entries()).map(([label, count]) => ({
        label,
        value: count,
        percentage: mainValue > 0
          ? Math.round((count / group.rows.length) * 1000) / 10
          : 0,
      }));
    }

    return item;
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

const currentMapName = ref("PH_REGIONS");

function getOptions() {
  const hasData = mapData.value.length > 0;

  // Get color scale from first metric field if configured
  const firstMetric = pivotFields.value.find((f: any) => f.fieldType === 'metric');
  const colorScale = firstMetric?.colorScale;
  const defaultColors = [
    "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4",
    "#4eb3d3", "#2b8cbe", "#0868ac", "#084081",
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
        const metricEntries = Object.entries(dataItem).filter(([key, val]) => 
          key !== 'name' && typeof val === 'number'
        );
        
        if (metricEntries.length > 0) {
          html += '<div style="display: flex; flex-direction: column; gap: 4px;">';
          metricEntries.forEach(([key, val]) => {
            const formattedVal = typeof val === 'number' ? val.toLocaleString() : val;
            html += `<div style="display: flex; justify-content: space-between; gap: 16px;">
              <span style="color: #6b7280;">${key}:</span>
              <span style="font-weight: 600; color: #3b82f6;">${formattedVal}</span>
            </div>`;
          });
          html += '</div>';
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
  chartInstance.value.setOption(getOptions(), true);
}

watch([mapData, visualMapRange, pivotFields], () => {
  chartInstance.value?.setOption(getOptions(), true);
}, { deep: true });

// Watch for geoJSON changes (initial load)
watch(
  () => mapStore.geoJSON,
  (newGeo) => {
    if (newGeo && chartInstance.value) {
      const mapName =
        mapStore.activeLevel === "region" ? "PH_REGIONS" : "PH_CUSTOM";
      registerAndRenderMap(newGeo, mapName);
    }
  },
  { immediate: true },
);

// Watch for filtered GeoJSON changes (from map view controls)
watch(
  () => mapStore.filteredGeoJSON,
  (newGeo) => {
    if (newGeo && chartInstance.value) {
      const mapName =
        mapStore.visibleSubBoundaryPcodes.size > 0
          ? "PH_FILTERED"
          : mapStore.activeLevel === "region"
            ? "PH_REGIONS"
            : "PH_CUSTOM";

      registerAndRenderMap(newGeo, mapName);
    }
  },
  { deep: true },
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
    console.log("Clicked:", clickedName);

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

    // Restore map state from store (preserves state when switching tabs)
    if (mapStore.geoJSON) {
      // GeoJSON already loaded — re-register and render with current state
      const geo = mapStore.filteredGeoJSON || mapStore.geoJSON;
      const mapName = mapStore.visibleSubBoundaryPcodes.size > 0
        ? "PH_FILTERED"
        : mapStore.activeLevel === "region"
          ? "PH_REGIONS"
          : "PH_CUSTOM";
      echarts.registerMap(mapName, geo);
      currentMapName.value = mapName;
      chartInstance.value.setOption(getOptions());
    } else {
      // First load — use current active level from store
      const geoData = await mapStore.loadMapData(mapStore.activeLevel);
      if (geoData) {
        const mapName = mapStore.activeLevel === "region" ? "PH_REGIONS" : "PH_CUSTOM";
        echarts.registerMap(mapName, geoData);
        currentMapName.value = mapName;
        chartInstance.value.setOption(getOptions());
      }
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
    />
  </div>
</template>
