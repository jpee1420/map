<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from "vue";
import * as echarts from "echarts";
import { useDataStore } from "@/stores/dataStore";
import { useUIStore } from "@/stores/uiStore";
import { useChartData } from "@/composables/useChartData";

const props = defineProps<{
  tabId: string;
  type: "bar" | "line" | "pie" | "scatter";
}>();

const dataStore = useDataStore();
const uiStore = useUIStore();
const chartContainer = ref<HTMLElement | null>(null);
const chartInstance = shallowRef<echarts.EChartsType | null>(null);

const activeTab = computed(() =>
  uiStore.tabs.find((t) => t.id === props.tabId),
);

// Extract reactive configuration from active tab
const filters = computed(() => activeTab.value?.filters || []);
const pivotFields = computed(() => activeTab.value?.pivotFields || []);

const { chartData } = useChartData(
  dataStore.dataset,
  filters.value,
  pivotFields.value,
);

function getOptions() {
  const { dimensions, source } = chartData.value;

  // Basic series generation
  const series = dimensions.slice(1).map((dim) => ({
    type: props.type,
    name: dim,
    encode: {
      x: props.type === "pie" ? undefined : dimensions[0],
      y: props.type === "pie" ? undefined : dim,
      itemName: props.type === "pie" ? dimensions[0] : undefined,
      value: props.type === "pie" ? dim : undefined,
    },
  }));

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {},
    dataset: {
      dimensions: dimensions,
      source: source,
    },
    xAxis: props.type === "pie" ? undefined : { type: "category" },
    yAxis: props.type === "pie" ? undefined : {},
    series: series,
  };
}

watch([chartData, () => props.type], () => {
  chartInstance.value?.setOption(getOptions(), true); // true for notMerge to clear old series
});

watch(
  () => props.tabId,
  () => {
    chartInstance.value?.resize();
  },
);

const resizeObserver = new ResizeObserver(() => {
  chartInstance.value?.resize();
});

onMounted(() => {
  if (chartContainer.value) {
    chartInstance.value = echarts.init(chartContainer.value);
    chartInstance.value.setOption(getOptions());
    resizeObserver.observe(chartContainer.value);
  }
});

onUnmounted(() => {
  chartInstance.value?.dispose();
  resizeObserver.disconnect();
});
</script>

<template>
  <div class="w-full h-full relative">
    <div
      v-if="chartData.source.length === 0"
      class="absolute inset-0 flex items-center justify-center text-gray-400"
    >
      No data available. Import data and adds value fields to visualize.
    </div>
    <div ref="chartContainer" class="w-full h-full"></div>
  </div>
</template>
