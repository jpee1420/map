<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from "vue";
import * as echarts from "echarts";
import { useDataStore } from "@/stores/dataStore";
import { useUIStore } from "@/stores/uiStore";
import { useChartData } from "@/composables/useChartData";

const props = defineProps<{
  tabId: string;
  type: "bar" | "line" | "doughnut" | "hbar" | "stacked" | "combo";
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

const { processedData, chartData } = useChartData(
  () => dataStore.dataset,
  filters,
  pivotFields,
);

function getOptions() {
  const { dimensions, source } = chartData.value;
  const sortOrder = activeTab.value?.sortOrder || 'none';
  const dataLabel = activeTab.value?.dataLabel;
  const metricPivotFields = pivotFields.value.filter((f: any) => f.fieldType === 'metric');

  // ─── Color from color picker on each metric ───
  function getSeriesColors(): string[] {
    return metricPivotFields
      .filter((f: any) => f.color)
      .map((f: any) => f.color);
  }

  // ─── Data label builder ───
  function buildLabel(chartType: string): Record<string, unknown> | undefined {
    if (!dataLabel?.enabled) return undefined;
    const isHBar = chartType === 'hbar';
    const isStack = chartType === 'stacked';
    const isLine = chartType === 'line';

    const position = isHBar ? 'right' : isStack ? 'inside' : isLine ? 'top' : 'top';

    return {
      show: true,
      position,
      fontSize: 10,
      formatter: (params: any) => {
        // For hbar: metric is on x-axis (encode.x); for others: metric is on y-axis (encode.y)
        const encodeIdx = isHBar
          ? params.encode?.x?.[0]
          : params.encode?.y?.[0];
        const dimName = params.dimensionNames?.[encodeIdx];
        const val = typeof params.value === 'object'
          ? params.value[dimName || '']
          : params.value;
        const numVal = Number(val) || 0;

        // Compute percentage: value / total of this dimension across all source rows
        const dimKey = dimName || params.seriesName;
        const total = source.reduce((sum, row) => sum + (Number(row[dimKey]) || 0), 0);
        const pct = total > 0 ? Math.round((numVal / total) * 100) : 0;

        if (dataLabel.format === 'number') return numVal.toLocaleString();
        if (dataLabel.format === 'percentage') return `${pct}%`;
        return `${numVal.toLocaleString()}(${pct}%)`;
      },
    };
  }

  // Determine ECharts series type from our chart type
  const isDoughnut = props.type === "doughnut";
  const isHorizontal = props.type === "hbar";
  const isStacked = props.type === "stacked";

  // ─── Doughnut with breakdown field: group by dimension, breakdown by breakdown field ───
  if (isDoughnut) {
    const dimFields = pivotFields.value.filter((f: any) => f.fieldType === 'dimension');
    const metricFields = pivotFields.value.filter((f: any) => f.fieldType === 'metric');
    const bdField = pivotFields.value.find((f: any) => f.fieldType === 'breakdown');

    if (bdField && dimFields.length > 0) {
      // Build custom data from raw filtered rows
      const data = processedData.value;
      const primaryDim = dimFields[0]!.column;
      const bdCol = bdField.column;
      const breakdownDimName = bdField.displayName || bdCol;

      // Determine aggregation: use first metric or default to record count
      const metricField = metricFields.length > 0 ? metricFields[0] : null;
      const metricLabel = metricField
        ? (metricField!.displayName || `${metricField!.aggregation.toUpperCase()}(${metricField!.column})`)
        : 'Record Count';

      // Group data by primary dimension
      const groups = new Map<string, {
        rows: Array<Record<string, unknown>>;
        breakdowns: Map<string, number>;
      }>();

      for (const row of data) {
        const key = String(row[primaryDim] || 'Unknown');
        if (!groups.has(key)) {
          groups.set(key, { rows: [], breakdowns: new Map() });
        }
        const group = groups.get(key)!;
        group.rows.push(row);

        const bdKey = String(row[bdCol] || 'Unknown');
        group.breakdowns.set(bdKey, (group.breakdowns.get(bdKey) || 0) + 1);
      }

      // Build pie data array
      const pieData = Array.from(groups.entries()).map(([name, group]) => {
        const total = group.rows.length;
        const breakdowns = Array.from(group.breakdowns.entries()).map(([label, count]) => ({
          label,
          value: count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }));

        return {
          name,
          value: total,
          breakdownDimension: breakdownDimName,
          breakdowns,
        };
      });

      return {
        tooltip: {
          trigger: "item" as const,
          formatter: (params: any) => {
            const d = params.data;
            let html = `<strong>${d.name}</strong><br/>${metricLabel}: <strong>${d.value.toLocaleString()}</strong> (${params.percent}%)`;
            if (d.breakdowns && d.breakdowns.length) {
              html += '<br/><hr style="margin:4px 0;border-color:#eee"/>';
              for (const bd of d.breakdowns) {
                html += `<br/>${bd.label}: <strong>${bd.value.toLocaleString()}</strong> (${bd.percentage}%)`;
              }
            }
            return html;
          },
        },
        legend: { type: 'scroll', top: 0, left: 'center' },
        series: [{
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "50%"],
          data: pieData,
          label: {
            show: true,
            formatter: (params: any) => {
              const d = params.data;
              let result = `{name|${d.name}}\n{val|${d.value.toLocaleString()}(${params.percent}%)}`;
              if (d.breakdowns && d.breakdowns.length) {
                for (const bd of d.breakdowns) {
                  result += `\n{bd|${bd.label}} {bdval|${bd.value.toLocaleString()}} {bdpct|(${bd.percentage}%)}`;
                }
              }
              return result;
            },
            rich: {
              name: {
                fontSize: 12,
                color: '#374151',
                padding: [0, 0, 2, 0],
              },
              val: {
                fontSize: 13,
                fontWeight: 'bold' as const,
                color: '#1e40af',
              },
              bd: {
                fontSize: 10,
                color: '#6b7280',
                padding: [2, 0, 0, 0],
              },
              bdval: {
                fontSize: 10,
                fontWeight: 'bold' as const,
                color: '#374151',
              },
              bdpct: {
                fontSize: 9,
                color: '#9ca3af',
              },
            },
          },
          emphasis: {
            label: { show: true, fontWeight: "bold" },
          },
        }],
      };
    }
  }

  // ─── Combo chart: bar + line with dual Y-axes ───
  const isCombo = props.type === 'combo';
  if (isCombo) {
    const comboSeries = dimensions.slice(1).map((dim, idx) => {
      const metricField = metricPivotFields[idx];
      const sType = metricField?.seriesType || (idx === 0 ? 'bar' : 'line');
      const yAxisIdx = sType === 'line' ? 1 : 0;
      const seriesColor = metricField?.color;
      const label = buildLabel(sType);
      
      return {
        type: sType,
        name: dim,
        yAxisIndex: yAxisIdx,
        encode: { x: dimensions[0], y: dim },
        ...(sType === 'line' ? { smooth: true, symbolSize: 6 } : {}),
        ...(seriesColor ? { itemStyle: { color: seriesColor } } : {}),
        ...(label ? { label } : {}),
      };
    });

    const categoryCount = source.length;
    const maxLabelLen = source.reduce((max, row) => {
      const label = String(row[dimensions[0] ?? ''] ?? '');
      return Math.max(max, label.length);
    }, 0);
    const shouldRotate = categoryCount >= 8 || maxLabelLen > 10;

    let sortedSource = source;
    if (sortOrder !== 'none' && dimensions.length >= 2) {
      const metricKey = dimensions[1]!;
      sortedSource = [...source].sort((a, b) => {
        const va = Number(a[metricKey]) || 0;
        const vb = Number(b[metricKey]) || 0;
        return sortOrder === 'asc' ? va - vb : vb - va;
      });
    }

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { type: 'scroll', top: 0, left: 'center' },
      dataset: { dimensions, source: sortedSource },
      grid: { left: '3%', right: '4%', top: '40px', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        axisLabel: shouldRotate ? { rotate: 45, overflow: 'truncate', width: 80 } : {},
      },
      yAxis: [
        { type: 'value', position: 'left' },
        { type: 'value', position: 'right', splitLine: { show: false } },
      ],
      series: comboSeries,
    };
  }

  // ─── Standard chart path (single-dim doughnut, bar, line, etc.) ───
  const seriesColors = getSeriesColors();
  const hasBreakdown = pivotFields.value.some((f: any) => f.fieldType === 'breakdown');

  const series = dimensions.slice(1).map((dim, idx) => {
    const baseSeries: Record<string, unknown> = {
      type: isDoughnut ? "pie" : props.type === "line" ? "line" : "bar",
      name: dim,
    };

    // Apply color from color picker (skip if breakdown exists — let ECharts palette differentiate)
    if (!isDoughnut && !hasBreakdown && seriesColors[idx]) {
      baseSeries.itemStyle = { color: seriesColors[idx] };
    }

    // Apply data label
    if (!isDoughnut) {
      const label = buildLabel(props.type);
      if (label) baseSeries.label = label;
    }

    if (isDoughnut) {
      // Single-dimension doughnut chart
      baseSeries.radius = ["40%", "70%"];
      baseSeries.center = ["50%", "50%"];
      baseSeries.encode = {
        itemName: dimensions[0],
        value: dim,
      };
      baseSeries.label = {
        show: true,
        formatter: (params: Record<string, unknown>) => {
          const data = params.data as Record<string, unknown> | undefined;
          const val = data ? data[dim] : params.value;
          const displayVal = typeof val === 'number' ? val.toLocaleString() : String(val ?? '');
          const pct = params.percent as number;
          return `{name|${params.name}}\n{val|${displayVal}(${pct}%)}`;
        },
        rich: {
          name: {
            fontSize: 12,
            color: '#374151',
            padding: [0, 0, 2, 0],
          },
          val: {
            fontSize: 13,
            fontWeight: 'bold' as const,
            color: '#1e40af',
          },
        },
      };
      baseSeries.emphasis = {
        label: { show: true, fontWeight: "bold" },
      };
    } else if (isHorizontal) {
      // Horizontal bar only
      baseSeries.encode = {
        x: dim,
        y: dimensions[0],
      };
    } else {
      // Regular bar, line, AND stacked (all vertical)
      baseSeries.encode = {
        x: dimensions[0],
        y: dim,
      };
      if (isStacked) {
        baseSeries.stack = "total";
      }
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
    // Smart rotation: angle labels if too many categories or names are long
    const categoryCount = source.length;
    const maxLabelLen = source.reduce((max, row) => {
      const label = String(row[dimensions[0] ?? ''] ?? '');
      return Math.max(max, label.length);
    }, 0);
    const shouldRotate = categoryCount >= 8 || maxLabelLen > 10;

    xAxis = {
      type: "category",
      axisLabel: shouldRotate
        ? { rotate: 45, overflow: 'truncate', width: 80 }
        : {},
    };
    yAxis = { type: "value" };
  }

  // Sort source for bar/stacked/hbar charts
  let sortedSource = source;
  if (!isDoughnut && sortOrder !== 'none' && dimensions.length >= 2) {
    const metricKey = dimensions[1]!;
    sortedSource = [...source].sort((a, b) => {
      const va = Number(a[metricKey]) || 0;
      const vb = Number(b[metricKey]) || 0;
      return sortOrder === 'asc' ? va - vb : vb - va;
    });
  }

  const customColors = getSeriesColors();
  const hasBreakdownForColors = pivotFields.value.some((f: any) => f.fieldType === 'breakdown');

  const legendNames = series
    .map((s: Record<string, unknown>) => s.name as string)
    .filter((n: string) => n !== '__total__');

  return {
    tooltip: {
      trigger: isDoughnut ? "item" : "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      type: 'scroll',
      top: 0,
      left: 'center',
      data: legendNames,
    },
    ...(customColors.length > 0 && !hasBreakdownForColors ? { color: customColors } : {}),
    dataset: {
      dimensions: dimensions,
      source: sortedSource,
    },
    grid: isDoughnut ? undefined : { left: "3%", right: "4%", top: "40px", bottom: "3%", containLabel: true },
    xAxis: xAxis,
    yAxis: yAxis,
    series: series,
  };
}

watch([chartData, pivotFields, () => props.type, () => activeTab.value?.sortOrder, () => activeTab.value?.dataLabel], () => {
  chartInstance.value?.setOption(getOptions(), true);
}, { deep: true });

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

defineExpose({ chartInstance });
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
