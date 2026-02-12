<script setup lang="ts">
import { computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import BaseSelect from "@/components/common/BaseSelect.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { TrashIcon, PlusIcon, GripVerticalIcon, PaletteIcon, LayersIcon, HashIcon } from "lucide-vue-next";

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

const decimalOptions = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
];

// Separate dimensions and metrics for display
const dimensionFields = computed(() => 
  activeTab.value?.pivotFields.filter(f => f.fieldType === 'dimension') || []
);

const metricFields = computed(() => 
  activeTab.value?.pivotFields.filter(f => f.fieldType === 'metric') || []
);

function addDimension(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    fieldType: 'dimension',
    aggregation: "count", // Default for dimensions, but not used
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
      <!-- Dimensions Section -->
      <div class="space-y-2">
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
            <button
              @click="removeField(field.id)"
              class="p-1 text-blue-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon class="w-3.5 h-3.5" />
            </button>
          </div>

          <BaseSelect
            v-model="field.column"
            :options="availableColumns"
            label="Column"
          />
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

      <!-- Metrics Section -->
      <div class="space-y-2">
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
              <button
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

          <BaseSelect
            v-model="field.aggregation"
            :options="aggregationOptions"
            label="Aggregation"
            class="mb-2"
          />

          <div class="flex gap-2">
            <div class="flex-1">
              <BaseSelect
                :modelValue="field.formatType ?? 'number'"
                @update:modelValue="(val: string | number) => field.formatType = val as 'number' | 'currency' | 'percentage'"
                :options="formatOptions"
                label="Format"
              />
            </div>
            <div class="w-20">
              <BaseSelect
                :modelValue="field.decimals ?? 0"
                @update:modelValue="(val: string | number) => field.decimals = Number(val)"
                :options="decimalOptions"
                label="Decimals"
              />
            </div>
          </div>

          <!-- Color Scale (if enabled) -->
          <div v-if="field.colorScale" class="mt-3 pt-3 border-t border-green-200">
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
          class="w-full border-dashed border-green-300 text-green-600 hover:bg-green-50"
        >
          <PlusIcon class="w-3 h-3 mr-1" /> Add Metric
        </BaseButton>
      </div>

      <!-- Help text -->
      <div v-if="dimensionFields.length === 0 && metricFields.length === 0" class="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded">
        Add a <span class="text-blue-600 font-medium">Dimension</span> to group data, 
        then add a <span class="text-green-600 font-medium">Metric</span> to aggregate values.
      </div>
    </div>
  </div>
</template>

