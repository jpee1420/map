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

const { chartData } = useChartData(
  () => dataStore.dataset,
  filters,
  pivotFields,
);

const mapData = computed(() => {
  const { dimensions, source } = chartData.value;

  if (!dimensions.length || !source.length) return [];

  const nameCol = dimensions[0];
  const valueCol = dimensions[1];

  if (!nameCol || !valueCol) return [];

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

  // Build a lookup map of GeoJSON boundary names
  const geoNameMap = new Map<string, string>();
  if (mapStore.geoJSON?.features) {
    mapStore.geoJSON.features.forEach((feature: any) => {
      const geoName = feature.properties?.name || feature.properties?.ADM1_EN || feature.properties?.ADM2_EN || feature.properties?.ADM3_EN;
      if (geoName) {
        geoNameMap.set(geoName.toUpperCase(), geoName);
        geoNameMap.set(normalize(geoName), geoName);
      }
    });
  }

  // Helper to resolve a raw name to a GeoJSON boundary name
  const matchGeoName = (raw: string): string => {
    return geoNameMap.get(raw.toUpperCase()) || geoNameMap.get(normalize(raw)) || raw;
  };

  // Detect multi-dimension: composite key contains " - " separator
  const dimFields = pivotFields.value.filter((f: any) => f.fieldType === 'dimension');
  const isMultiDim = dimFields.length > 1;

  if (isMultiDim) {
    // Multi-dimension: group rows by the geographic (first) dimension
    const breakdownDimName = dimFields.slice(1).map((f: any) => f.column).join(' / ');

    const groups = new Map<string, {
      total: number;
      breakdowns: Map<string, number>;
    }>();

    for (const row of source) {
      const compositeKey = String(row[nameCol] || '');
      // Split composite key: first part = geographic, rest = breakdown category
      const sepIdx = compositeKey.indexOf(' - ');
      const geoRaw = sepIdx >= 0 ? compositeKey.substring(0, sepIdx) : compositeKey;
      const breakdownLabel = sepIdx >= 0 ? compositeKey.substring(sepIdx + 3) : 'Other';
      const value = Number(row[valueCol]) || 0;

      const matchedGeo = matchGeoName(geoRaw);

      if (!groups.has(matchedGeo)) {
        groups.set(matchedGeo, { total: 0, breakdowns: new Map() });
      }
      const group = groups.get(matchedGeo)!;
      group.total += value;
      group.breakdowns.set(
        breakdownLabel,
        (group.breakdowns.get(breakdownLabel) || 0) + value,
      );
    }

    return Array.from(groups.entries()).map(([geoName, group]) => ({
      name: geoName,
      value: group.total,
      breakdownDimension: breakdownDimName,
      breakdowns: Array.from(group.breakdowns.entries()).map(([label, val]) => ({
        label,
        value: val,
        percentage: group.total > 0
          ? Math.round((val / group.total) * 1000) / 10
          : 0,
      })),
    }));
  }

  // Single dimension: simple name→value mapping
  return source.map((row: Record<string, unknown>) => {
    const rawName = String(row[nameCol] || '');
    const matchedName = matchGeoName(rawName);

    return {
      name: matchedName,
      value: row[valueCol],
      ...row,
    };
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
            color: [
              "#e0f3db",
              "#ccebc5",
              "#a8ddb5",
              "#7bccc4",
              "#4eb3d3",
              "#2b8cbe",
              "#0868ac",
              "#084081",
            ],
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

watch([mapData, visualMapRange], () => {
  chartInstance.value?.setOption(getOptions());
});

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

    // Load and register the initial map
    const geoData = await mapStore.loadMapData("region");
    if (geoData) {
      echarts.registerMap("PH_REGIONS", geoData);
      currentMapName.value = "PH_REGIONS";
      chartInstance.value.setOption(getOptions());
    }

    chartInstance.value.on("click", onMapClick);
    chartInstance.value.on("georoam", () => {
      // Small trigger to force reactivity if needed, or component can listen directly
    });
    
    resizeObserver.observe(chartContainer.value);
  }
});

onUnmounted(() => {
  chartInstance.value?.dispose();
  resizeObserver.disconnect();
});
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
