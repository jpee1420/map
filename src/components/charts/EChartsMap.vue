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
  dataStore.dataset,
  filters.value,
  pivotFields.value,
);

const mapData = computed(() => {
  const { dimensions, source } = chartData.value;
  if (!dimensions.length || !source.length) return [];

  const nameCol = dimensions[0];
  const valueCol = dimensions[1];

  if (!nameCol || !valueCol) return [];

  return source.map((row: Record<string, unknown>) => ({
    name: row[nameCol],
    value: row[valueCol],
    ...row,
  }));
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
      formatter: (params: any) => {
        if (isNaN(params.value)) return params.name;
        return `${params.name}: ${params.value.toLocaleString()}`;
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
      v-if="chartInstance && mapStore.geoJSON" 
      :chartInstance="chartInstance" 
      :geoData="mapStore.geoJSON"
      :mapData="mapData"
    />
  </div>
</template>
