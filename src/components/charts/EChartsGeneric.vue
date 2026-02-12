<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from "vue";
import * as echarts from "echarts";
import { useDataStore } from "@/stores/dataStore";
import { useUIStore } from "@/stores/uiStore";
import { useChartData } from "@/composables/useChartData";

const props = defineProps<{
  tabId: string;
  type: "bar" | "line" | "doughnut" | "hbar" | "stacked";
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
  () => dataStore.dataset,
  filters,
  pivotFields,
);

function getOptions() {
  const { dimensions, source } = chartData.value;

  // Determine ECharts series type from our chart type
  const isDoughnut = props.type === "doughnut";
  const isHorizontal = props.type === "hbar";
  const isStacked = props.type === "stacked";

  // Build series
  const series = dimensions.slice(1).map((dim) => {
    const baseSeries: Record<string, unknown> = {
      type: isDoughnut ? "pie" : props.type === "line" ? "line" : "bar",
      name: dim,
    };

    if (isDoughnut) {
      // Doughnut chart configuration
      baseSeries.radius = ["40%", "70%"];
      baseSeries.center = ["50%", "50%"];
      baseSeries.encode = {
        itemName: dimensions[0],
        value: dim,
      };
      baseSeries.label = {
        show: true,
        formatter: "{b}: {c} ({d}%)",
      };
      baseSeries.emphasis = {
        label: { show: true, fontWeight: "bold" },
      };
    } else if (isHorizontal || isStacked) {
      // Horizontal or stacked bar
      baseSeries.encode = {
        x: dim,
        y: dimensions[0],
      };
      if (isStacked) {
        baseSeries.stack = "total";
      }
    } else {
      // Regular bar/line
      baseSeries.encode = {
        x: dimensions[0],
        y: dim,
      };
    }

    return baseSeries;
  });

  // Build axes based on chart type
  let xAxis: Record<string, unknown> | undefined;
  let yAxis: Record<string, unknown> | undefined;

  if (isDoughnut) {
    xAxis = undefined;
    yAxis = undefined;
  } else if (isHorizontal) {
    xAxis = { type: "value" };
    yAxis = { type: "category" };
  } else {
    xAxis = { type: "category" };
    yAxis = { type: "value" };
  }

  return {
    tooltip: {
      trigger: isDoughnut ? "item" : "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {},
    dataset: {
      dimensions: dimensions,
      source: source,
    },
    grid: isDoughnut ? undefined : { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: xAxis,
    yAxis: yAxis,
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
