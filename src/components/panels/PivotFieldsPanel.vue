<script setup lang="ts">
import { computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import BaseSelect from "@/components/common/BaseSelect.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { TrashIcon, PlusIcon, GripVerticalIcon, PaletteIcon, LayersIcon, HashIcon, ListFilterIcon, ArrowUpDownIcon, SplitIcon, LineChartIcon } from "lucide-vue-next";

const uiStore = useUIStore();
const dataStore = useDataStore();

const activeTab = computed(() =>
  uiStore.tabs.find((t) => t.id === uiStore.activeTabId),
);
const columns = computed(() => dataStore.dataset?.columns || []);

const availableColumns = computed(() => {
  return columns.value.map((c) => ({ label: c, value: c }));
});

const aggregationOptions = [
  { label: "Sum", value: "sum" },
  { label: "Average", value: "avg" },
  { label: "Count", value: "count" },
  { label: "Min", value: "min" },
  { label: "Max", value: "max" },
  { label: "Median", value: "median" },
];

const formatOptions = [
  { label: "Number", value: "number" },
  { label: "Currency (₱)", value: "currency" },
  { label: "Percentage (%)", value: "percentage" },
];



// Separate dimensions and metrics for display
const dimensionFields = computed(() => 
  activeTab.value?.pivotFields.filter(f => f.fieldType === 'dimension') || []
);

const metricFields = computed(() => 
  activeTab.value?.pivotFields.filter(f => f.fieldType === 'metric') || []
);

// Combo chart: separate bar and line metrics
const barMetricFields = computed(() =>
  metricFields.value.filter(f => !f.seriesType || f.seriesType === 'bar')
);
const lineMetricFields = computed(() =>
  metricFields.value.filter(f => f.seriesType === 'line')
);

const breakdownField = computed(() =>
  activeTab.value?.pivotFields.find(f => f.fieldType === 'breakdown') || null
);

const isMapType = computed(() => activeTab.value?.type === 'map');
const isDoughnutType = computed(() => activeTab.value?.type === 'doughnut');
const isComboType = computed(() => activeTab.value?.type === 'combo');

// Constraint: if breakdown exists, only 1 metric allowed
const canAddMetric = computed(() => {
  if (breakdownField.value && metricFields.value.length >= 1) return false;
  return true;
});

function addDimension(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'dimension',
    aggregation: "count",
    formatType: "number",
    decimals: 0,
  });
}

function addMetric(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'metric',
    aggregation: "count",
    formatType: "number",
    decimals: 0,
  });
}

function addBarMetric(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'metric',
    aggregation: "count",
    formatType: "number",
    decimals: 0,
    seriesType: 'bar',
  });
}

function addLineMetric(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'metric',
    aggregation: "count",
    formatType: "number",
    decimals: 0,
    seriesType: 'line',
  });
}

function addBreakdown(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  if (breakdownField.value) return; // Max 1
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'breakdown',
    aggregation: "count",
    formatType: "number",
    decimals: 0,
  });

  // Enforce constraint: remove extra metrics if more than 1
  const metrics = activeTab.value.pivotFields.filter(f => f.fieldType === 'metric');
  while (metrics.length > 1) {
    const extra = metrics.pop()!;
    const idx = activeTab.value.pivotFields.findIndex(f => f.id === extra.id);
    if (idx > -1) activeTab.value.pivotFields.splice(idx, 1);
  }
}

function removeField(fieldId: string): void {
  if (!activeTab.value) return;
  const index = activeTab.value.pivotFields.findIndex(f => f.id === fieldId);
  if (index > -1) {
    activeTab.value.pivotFields.splice(index, 1);
  }
}

function toggleColorScale(fieldId: string): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields.find(f => f.id === fieldId);
  if (!field) return;
  if (field.colorScale) {
    field.colorScale = undefined;
  } else {
    field.colorScale = { min: '#e0f3db', max: '#084081' };
  }
}

// ─── Others Grouping ───────────────────────────────────────────
function toggleGroupOthers(fieldId: string): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields.find(f => f.id === fieldId);
  if (!field) return;
  field.groupOthers = !field.groupOthers;
  if (field.groupOthers && !field.othersCategories) {
    field.othersCategories = [];
  }
}

function toggleOthersCategory(fieldId: string, value: string): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields.find(f => f.id === fieldId);
  if (!field || !field.othersCategories) return;
  const idx = field.othersCategories.indexOf(value);
  if (idx > -1) {
    field.othersCategories.splice(idx, 1);
  } else {
    field.othersCategories.push(value);
  }
}

function selectAllOthers(fieldId: string, column: string): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields.find(f => f.id === fieldId);
  if (!field) return;
  field.othersCategories = uniqueValuesFor(column).map(v => v.name);
}

function clearAllOthers(fieldId: string): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields.find(f => f.id === fieldId);
  if (!field) return;
  field.othersCategories = [];
}

function toggleDataLabel(): void {
  if (!activeTab.value) return;
  if (activeTab.value.dataLabel?.enabled) {
    activeTab.value.dataLabel = undefined;
  } else {
    activeTab.value.dataLabel = {
      enabled: true,
      format: 'both',
      display: 'value',
    };
  }
}

function uniqueValuesFor(column: string): Array<{ name: string; count: number }> {
  const data = dataStore.dataset?.data;
  if (!data) return [];
  const counts = new Map<string, number>();
  for (const row of data) {
    const val = row[column];
    if (val != null && val !== '') {
      const key = String(val);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Sort Order ───────────────────────────────────────────────
const isSortableType = computed(() => {
  const t = activeTab.value?.type;
  return t === 'bar' || t === 'hbar' || t === 'stacked' || t === 'line' || t === 'combo';
});

const sortOrderOptions = [
  { label: 'Default', value: 'none' },
  { label: 'Ascending', value: 'asc' },
  { label: 'Descending', value: 'desc' },
];
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="!activeTab">No active tab</div>
    <div
      v-else-if="columns.length === 0"
      class="text-sm text-gray-500 text-center py-4"
    >
      Import data to add fields
    </div>
    <div v-else class="flex flex-col gap-4">
      <!-- Dimensions Section (hidden for map) -->
      <div v-if="!isMapType" class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase">
          <LayersIcon class="w-3.5 h-3.5" />
          Dimensions (X-Axis)
        </div>
        
        <div
          v-for="field in dimensionFields"
          :key="field.id"
          class="p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <GripVerticalIcon class="w-4 h-4 text-blue-300 cursor-grab" />
              <span class="text-xs font-medium text-blue-700">Dimension</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="toggleGroupOthers(field.id)"
                class="p-1 rounded hover:bg-blue-200 transition-colors"
                :class="field.groupOthers ? 'text-blue-600' : 'text-blue-400'"
                title="Group values into 'Others'"
              >
                <ListFilterIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="removeField(field.id)"
                class="p-1 text-blue-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <BaseSelect
            v-model="field.column"
            :options="availableColumns"
            label="Column"
          />
          <input
            v-model="field.displayName"
            type="text"
            :placeholder="field.column"
            class="mt-2 w-full text-xs px-2 py-1 border border-blue-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            title="Custom display name"
          />

          <!-- Others Grouping Panel -->
          <div v-if="field.groupOthers" class="mt-3 pt-3 border-t border-blue-200">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium text-blue-600">
                Group into "Others"
              </label>
              <div class="flex gap-1">
                <button
                  @click="selectAllOthers(field.id, field.column)"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                >Select All</button>
                <button
                  @click="clearAllOthers(field.id)"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >Clear</button>
              </div>
            </div>
            <div class="max-h-40 overflow-y-auto bg-white rounded border border-blue-100 p-2 space-y-1">
              <label
                v-for="item in uniqueValuesFor(field.column)"
                :key="item.name"
                class="flex items-center gap-2 text-xs text-gray-700 hover:bg-blue-50 rounded px-1 py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="field.othersCategories?.includes(item.name)"
                  @change="toggleOthersCategory(field.id, item.name)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="flex-1">{{ item.name }}</span>
                <span class="text-[10px] text-gray-400">{{ item.count.toLocaleString() }}</span>
              </label>
            </div>
            <p class="text-[10px] text-blue-400 mt-1">
              Checked values will be grouped as "Others"
            </p>
          </div>
        </div>

        <BaseButton
          variant="secondary"
          size="sm"
          @click="addDimension"
          class="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
        >
          <PlusIcon class="w-3 h-3 mr-1" /> Add Dimension
        </BaseButton>
      </div>

      <!-- Breakdown Dimension Section -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase">
          <SplitIcon class="w-3.5 h-3.5" />
          Breakdown Dimension
        </div>

        <div
          v-if="breakdownField"
          class="p-3 bg-orange-50 rounded-lg border border-orange-200"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <GripVerticalIcon class="w-4 h-4 text-orange-300 cursor-grab" />
              <span class="text-xs font-medium text-orange-700">Legend</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="toggleGroupOthers(breakdownField.id)"
                class="p-1 rounded hover:bg-orange-200 transition-colors"
                :class="breakdownField.groupOthers ? 'text-orange-600' : 'text-orange-400'"
                title="Group values into 'Others'"
              >
                <ListFilterIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="removeField(breakdownField.id)"
                class="p-1 text-orange-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <BaseSelect
            v-model="breakdownField.column"
            :options="availableColumns"
            label="Column"
          />
          <input
            v-model="breakdownField.displayName"
            type="text"
            :placeholder="breakdownField.column"
            class="mt-2 w-full text-xs px-2 py-1 border border-orange-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
            title="Custom display name"
          />

          <!-- Others Grouping for Breakdown -->
          <div v-if="breakdownField.groupOthers" class="mt-3 pt-3 border-t border-orange-200">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium text-orange-600">
                Group into "Others"
              </label>
              <div class="flex gap-1">
                <button
                  @click="selectAllOthers(breakdownField.id, breakdownField.column)"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                >Select All</button>
                <button
                  @click="clearAllOthers(breakdownField.id)"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >Clear</button>
              </div>
            </div>
            <div class="max-h-40 overflow-y-auto bg-white rounded border border-orange-100 p-2 space-y-1">
              <label
                v-for="item in uniqueValuesFor(breakdownField.column)"
                :key="item.name"
                class="flex items-center gap-2 text-xs text-gray-700 hover:bg-orange-50 rounded px-1 py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="breakdownField.othersCategories?.includes(item.name)"
                  @change="toggleOthersCategory(breakdownField.id, item.name)"
                  class="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span class="flex-1">{{ item.name }}</span>
                <span class="text-[10px] text-gray-400">{{ item.count.toLocaleString() }}</span>
              </label>
            </div>
            <p class="text-[10px] text-orange-400 mt-1">
              Checked values will be grouped as "Others"
            </p>
          </div>
        </div>

        <BaseButton
          v-if="!breakdownField"
          variant="secondary"
          size="sm"
          @click="addBreakdown"
          class="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
        >
          <PlusIcon class="w-3 h-3 mr-1" /> Add Breakdown
        </BaseButton>

        <p v-if="breakdownField" class="text-[10px] text-orange-400">
          Only 1 metric allowed with a breakdown dimension
        </p>
      </div>

      <!-- Metrics Section (non-combo) -->
      <div v-if="!isComboType" class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-green-600 uppercase">
          <HashIcon class="w-3.5 h-3.5" />
          Metrics (Y-Axis)
        </div>
        
        <div
          v-for="field in metricFields"
          :key="field.id"
          class="p-3 bg-green-50 rounded-lg border border-green-200"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <GripVerticalIcon class="w-4 h-4 text-green-300 cursor-grab" />
              <span class="text-xs font-medium text-green-700">Metric</span>
            </div>
            <div class="flex items-center gap-1">
              <input
                v-if="!isMapType && !isDoughnutType"
                :value="field.color || '#5470c6'"
                @input="field.color = ($event.target as HTMLInputElement).value"
                type="color"
                class="w-5 h-5 rounded cursor-pointer border border-green-200 p-0"
                title="Series color"
              />
              <button
                v-if="isMapType"
                @click="toggleColorScale(field.id)"
                class="p-1 rounded hover:bg-green-200 transition-colors"
                :class="field.colorScale ? 'text-green-600' : 'text-green-400'"
                title="Toggle color scale"
              >
                <PaletteIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="removeField(field.id)"
                class="p-1 text-green-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <BaseSelect
            v-model="field.column"
            :options="availableColumns"
            label="Column"
            class="mb-2"
          />
          <input
            v-model="field.displayName"
            type="text"
            :placeholder="`${field.aggregation.toUpperCase()}(${field.column})`"
            class="mb-2 w-full text-xs px-2 py-1 border border-green-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-400"
            title="Custom display name"
          />

          <BaseSelect
            v-model="field.aggregation"
            :options="aggregationOptions"
            label="Aggregation"
            class="mb-2"
          />

          <div>
            <BaseSelect
              :modelValue="field.formatType ?? 'number'"
              @update:modelValue="(val: string | number) => field.formatType = val as 'number' | 'currency' | 'percentage'"
              :options="formatOptions"
              label="Format"
            />
          </div>

          <!-- Color Scale (map only) -->
          <div v-if="isMapType && field.colorScale" class="mt-3 pt-3 border-t border-green-200">
            <label class="block text-xs font-medium text-green-600 mb-2">
              Color Scale
            </label>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <span class="text-xs text-green-500">Min</span>
                <input
                  v-model="field.colorScale.min"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-green-200"
                />
              </div>
              <div class="flex-1 h-4 rounded" :style="{
                background: `linear-gradient(to right, ${field.colorScale.min}, ${field.colorScale.max})`
              }"></div>
              <div class="flex items-center gap-1">
                <input
                  v-model="field.colorScale.max"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-green-200"
                />
                <span class="text-xs text-green-500">Max</span>
              </div>
            </div>
          </div>
        </div>

        <BaseButton
          variant="secondary"
          size="sm"
          @click="addMetric"
          :disabled="!canAddMetric"
          class="w-full border-dashed border-green-300 text-green-600 hover:bg-green-50"
          :class="{ 'opacity-50 cursor-not-allowed': !canAddMetric }"
        >
          <PlusIcon class="w-3 h-3 mr-1" /> Add Metric
        </BaseButton>
      </div>

      <!-- Combo: Column Y-Axis (bar metrics) -->
      <template v-if="isComboType">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs font-semibold text-green-600 uppercase">
            <HashIcon class="w-3.5 h-3.5" />
            Column Y-Axis
          </div>
          
          <div
            v-for="field in barMetricFields"
            :key="field.id"
            class="p-3 bg-green-50 rounded-lg border border-green-200"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <GripVerticalIcon class="w-4 h-4 text-green-300 cursor-grab" />
                <span class="text-xs font-medium text-green-700">Bar</span>
              </div>
              <div class="flex items-center gap-1">
                <input
                  :value="field.color || '#5470c6'"
                  @input="field.color = ($event.target as HTMLInputElement).value"
                  type="color"
                  class="w-5 h-5 rounded cursor-pointer border border-green-200 p-0"
                  title="Series color"
                />
                <button
                  @click="removeField(field.id)"
                  class="p-1 text-green-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <BaseSelect v-model="field.column" :options="availableColumns" label="Column" class="mb-2" />
            <input v-model="field.displayName" type="text" :placeholder="`${field.aggregation.toUpperCase()}(${field.column})`" class="mb-2 w-full text-xs px-2 py-1 border border-green-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-400" />
            <BaseSelect v-model="field.aggregation" :options="aggregationOptions" label="Aggregation" class="mb-2" />
            <BaseSelect :modelValue="field.formatType ?? 'number'" @update:modelValue="(val: string | number) => field.formatType = val as 'number' | 'currency' | 'percentage'" :options="formatOptions" label="Format" />
          </div>

          <BaseButton variant="secondary" size="sm" @click="addBarMetric" class="w-full border-dashed border-green-300 text-green-600 hover:bg-green-50">
            <PlusIcon class="w-3 h-3 mr-1" /> Add Bar Metric
          </BaseButton>
        </div>

        <!-- Combo: Line Y-Axis (line metrics) -->
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase">
            <LineChartIcon class="w-3.5 h-3.5" />
            Line Y-Axis
          </div>
          
          <div
            v-for="field in lineMetricFields"
            :key="field.id"
            class="p-3 bg-indigo-50 rounded-lg border border-indigo-200"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <GripVerticalIcon class="w-4 h-4 text-indigo-300 cursor-grab" />
                <span class="text-xs font-medium text-indigo-700">Line</span>
              </div>
              <div class="flex items-center gap-1">
                <input
                  :value="field.color || '#5470c6'"
                  @input="field.color = ($event.target as HTMLInputElement).value"
                  type="color"
                  class="w-5 h-5 rounded cursor-pointer border border-indigo-200 p-0"
                  title="Series color"
                />
                <button
                  @click="removeField(field.id)"
                  class="p-1 text-indigo-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <BaseSelect v-model="field.column" :options="availableColumns" label="Column" class="mb-2" />
            <input v-model="field.displayName" type="text" :placeholder="`${field.aggregation.toUpperCase()}(${field.column})`" class="mb-2 w-full text-xs px-2 py-1 border border-indigo-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <BaseSelect v-model="field.aggregation" :options="aggregationOptions" label="Aggregation" class="mb-2" />
            <BaseSelect :modelValue="field.formatType ?? 'number'" @update:modelValue="(val: string | number) => field.formatType = val as 'number' | 'currency' | 'percentage'" :options="formatOptions" label="Format" />
          </div>

          <BaseButton variant="secondary" size="sm" @click="addLineMetric" class="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50">
            <PlusIcon class="w-3 h-3 mr-1" /> Add Line Metric
          </BaseButton>
        </div>
      </template>

      <!-- Data Labels (all non-map charts) -->
      <div v-if="!isMapType" class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-semibold text-teal-600 uppercase">
            <HashIcon class="w-3.5 h-3.5" />
            Data Labels
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              :checked="activeTab?.dataLabel?.enabled ?? false"
              @change="toggleDataLabel"
              class="sr-only peer"
            />
            <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-teal-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
          </label>
        </div>

        <template v-if="activeTab?.dataLabel?.enabled">
          <BaseSelect
            :modelValue="activeTab.dataLabel.format"
            @update:modelValue="(val: string | number) => { if (activeTab?.dataLabel) activeTab.dataLabel.format = val as 'number' | 'percentage' | 'both' }"
            :options="[
              { label: 'Number', value: 'number' },
              { label: 'Percentage', value: 'percentage' },
              { label: 'Both', value: 'both' },
            ]"
            label="Format"
          />
        </template>
      </div>

      <!-- Sort Order (sortable chart types) -->
      <div v-if="isSortableType" class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-purple-600 uppercase">
          <ArrowUpDownIcon class="w-3.5 h-3.5" />
          Sort Order
        </div>
        <BaseSelect
          :modelValue="activeTab?.sortOrder ?? 'none'"
          @update:modelValue="(val: string | number) => { if (activeTab) activeTab.sortOrder = val as 'asc' | 'desc' | 'none' }"
          :options="sortOrderOptions"
          label="Sort by value"
        />
      </div>

      <!-- Help text -->
      <div v-if="dimensionFields.length === 0 && metricFields.length === 0" class="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded">
        Add a <span class="text-blue-600 font-medium">Dimension</span> to group data, 
        then add a <span class="text-green-600 font-medium">Metric</span> to aggregate values.
      </div>
    </div>
  </div>
</template>
