<script setup lang="ts">
import { computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import BaseSelect from "@/components/common/BaseSelect.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import DateRangePicker from "@/components/common/DateRangePicker.vue";
import NumericRangeInput from "@/components/common/NumericRangeInput.vue";
import { TrashIcon, PlusIcon, XIcon } from "lucide-vue-next";

const uiStore = useUIStore();
const dataStore = useDataStore();

const activeTab = computed(() =>
  uiStore.tabs.find((t) => t.id === uiStore.activeTabId),
);
const columns = computed(() => dataStore.dataset?.columns || []);

const availableColumns = computed(() => {
  return columns.value.map((c) => ({ label: c, value: c }));
});

const filterTypes = [
  { label: 'Select / Text', value: 'select' },
  { label: 'Date Range', value: 'date' },
  { label: 'Numeric Range', value: 'range' },
  // { label: 'Search', value: 'search' }, // Treat as select for now
];

function addFilter() {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstCol = columns.value[0];
  if (!firstCol) return;

  activeTab.value.filters.push({
    id: `filter-${Date.now()}`,
    column: firstCol,
    type: "select",
    value: "",
  });
}

function removeFilter(index: number) {
  activeTab.value?.filters.splice(index, 1);
}

function clearAllFilters() {
  if (activeTab.value) {
    activeTab.value.filters = [];
  }
}

function getFilterSummary(filter: any): string {
  if (!filter.value) return '';
  
  if (filter.type === 'date') {
    return `${filter.value.from} to ${filter.value.to}`;
  }
  if (filter.type === 'range') {
    return `${filter.value.min} - ${filter.value.max}`;
  }
  return String(filter.value);
}

function getUniqueValues(column: string) {
  if (!dataStore.dataset?.data) return [];
  
  const values = new Set<string>();
  dataStore.dataset.data.forEach(row => {
    const val = row[column];
    if (val !== undefined && val !== null && val !== '') {
      values.add(String(val));
    }
  });
  
  return Array.from(values)
    .sort()
    .map(v => ({ label: v, value: v }));
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="!activeTab">No active tab</div>
    <div
      v-else-if="columns.length === 0"
      class="text-sm text-gray-500 text-center py-4"
    >
      Import data to add filters
    </div>
    <div v-else class="flex flex-col gap-3">
      <!-- Active Chips Summary -->
      <div v-if="activeTab.filters.some(f => f.value)" class="flex flex-wrap gap-2 mb-2 p-2 bg-blue-50 rounded-lg">
        <div 
          v-for="filter in activeTab.filters" 
          :key="filter.id"
          v-show="filter.value"
          class="flex items-center gap-1 text-xs bg-white text-blue-700 px-2 py-1 rounded border border-blue-200 shadow-sm"
        >
          <span class="font-semibold">{{ filter.column }}:</span>
          <span class="truncate max-w-[100px]">{{ getFilterSummary(filter) }}</span>
          <button @click="filter.value = ''" class="hover:text-red-500 rounded-full p-0.5">
            <XIcon class="w-3 h-3" />
          </button>
        </div>
        <button 
          @click="clearAllFilters" 
          class="text-xs text-gray-500 hover:text-red-600 underline ml-auto"
        >
          Clear All
        </button>
      </div>

      <!-- Filter List -->
      <div
        v-for="(filter, index) in activeTab.filters"
        :key="filter.id"
        class="p-3 bg-gray-50 rounded-lg border border-gray-200"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-500 uppercase"
            >Filter {{ index + 1 }}</span
          >
          <button
            @click="removeFilter(index)"
            class="text-gray-400 hover:text-red-500 transition-colors"
          >
            <TrashIcon class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Column Select -->
        <BaseSelect
          v-model="filter.column"
          :options="availableColumns"
          label="Column"
          class="mb-2"
        />

        <!-- Type Select -->
         <BaseSelect
          v-model="filter.type"
          :options="filterTypes"
          label="Type"
          class="mb-3"
        />

        <!-- Value Input based on Type -->
        <div class="mt-2">
          <DateRangePicker 
            v-if="filter.type === 'date'"
            v-model="filter.value"
            label="Range"
          />
          
          <NumericRangeInput
            v-else-if="filter.type === 'range'"
            v-model="filter.value"
            label="Range"
          />
          
          <BaseSelect
            v-else
            v-model="filter.value"
            :options="getUniqueValues(filter.column)"
            label="Value"
            placeholder="Select value..."
          />
        </div>
      </div>

      <BaseButton
        variant="secondary"
        size="sm"
        @click="addFilter"
        class="w-full"
      >
        <PlusIcon class="w-3 h-3 mr-1" /> Add Filter
      </BaseButton>
    </div>
  </div>
</template>
