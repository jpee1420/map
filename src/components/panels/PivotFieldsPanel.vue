<script setup lang="ts">
import { computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import BaseSelect from "@/components/common/BaseSelect.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { TrashIcon, PlusIcon, GripVerticalIcon, PaletteIcon } from "lucide-vue-next";

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

function addField(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstColumn = columns.value[0];
  if (!firstColumn) return;

  activeTab.value.pivotFields.push({
    id: `field-${Date.now()}`,
    column: firstColumn,
    aggregation: "sum",
    formatType: "number",
    decimals: 0,
  });
}

function removeField(index: number): void {
  activeTab.value?.pivotFields.splice(index, 1);
}

function toggleColorScale(index: number): void {
  if (!activeTab.value) return;
  const field = activeTab.value.pivotFields[index];
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
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="(field, index) in activeTab.pivotFields"
        :key="field.id"
        class="p-3 bg-gray-50 rounded-lg border border-gray-200"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <GripVerticalIcon class="w-4 h-4 text-gray-300 cursor-grab" />
            <span class="text-xs font-semibold text-gray-500 uppercase">
              Value {{ index + 1 }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="toggleColorScale(index)"
              class="p-1 rounded hover:bg-gray-200 transition-colors"
              :class="field.colorScale ? 'text-blue-600' : 'text-gray-400'"
              title="Toggle color scale"
            >
              <PaletteIcon class="w-3.5 h-3.5" />
            </button>
            <button
              @click="removeField(index)"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Column Selection -->
        <BaseSelect
          v-model="field.column"
          :options="availableColumns"
          label="Column"
          class="mb-2"
        />

        <!-- Aggregation -->
        <BaseSelect
          v-model="field.aggregation"
          :options="aggregationOptions"
          label="Aggregation"
          class="mb-2"
        />

        <!-- Format Row -->
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
        <div v-if="field.colorScale" class="mt-3 pt-3 border-t border-gray-200">
          <label class="block text-xs font-medium text-gray-500 mb-2">
            Color Scale
          </label>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <span class="text-xs text-gray-400">Min</span>
              <input
                v-model="field.colorScale.min"
                type="color"
                class="w-6 h-6 rounded cursor-pointer border border-gray-200"
              />
            </div>
            <div class="flex-1 h-4 rounded" :style="{
              background: `linear-gradient(to right, ${field.colorScale.min}, ${field.colorScale.max})`
            }"></div>
            <div class="flex items-center gap-1">
              <input
                v-model="field.colorScale.max"
                type="color"
                class="w-6 h-6 rounded cursor-pointer border border-gray-200"
              />
              <span class="text-xs text-gray-400">Max</span>
            </div>
          </div>
        </div>
      </div>

      <BaseButton
        variant="secondary"
        size="sm"
        @click="addField"
        class="w-full"
      >
        <PlusIcon class="w-3 h-3 mr-1" /> Add Value Field
      </BaseButton>
    </div>
  </div>
</template>
