<script setup lang="ts">
import { computed, ref } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useDataStore } from "@/stores/dataStore";
import BaseSelect from "@/components/common/BaseSelect.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import DateRangePicker from "@/components/common/DateRangePicker.vue";
import NumericRangeInput from "@/components/common/NumericRangeInput.vue";
import { TrashIcon, PlusIcon, XIcon, SearchIcon } from "lucide-vue-next";

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
];

// Search text per filter for narrowing checkbox list
const filterSearches = ref<Record<string, string>>({});

function addFilter(): void {
  if (!activeTab.value || columns.value.length === 0) return;
  const firstCol = columns.value[0];
  if (!firstCol) return;

  activeTab.value.filters.push({
    id: `filter-${Date.now()}`,
    column: firstCol,
    type: "select",
    value: [] as unknown as any, // string[] for select
  });
}

function removeFilter(index: number): void {
  activeTab.value?.filters.splice(index, 1);
}

function clearAllFilters(): void {
  if (activeTab.value) {
    activeTab.value.filters = [];
  }
}

function getFilterSummary(filter: any): string {
  if (!filter.value) return '';
  
  if (filter.type === 'select' && Array.isArray(filter.value)) {
    const arr = filter.value as string[];
    if (arr.length === 0) return '';
    if (arr.length <= 2) return arr.join(', ');
    return `${arr[0]}, ${arr[1]} +${arr.length - 2}`;
  }
  if (filter.type === 'date') {
    return `${filter.value.from} to ${filter.value.to}`;
  }
  if (filter.type === 'range') {
    return `${filter.value.min} - ${filter.value.max}`;
  }
  return String(filter.value);
}

function hasFilterValue(filter: any): boolean {
  if (!filter.value) return false;
  if (Array.isArray(filter.value)) return filter.value.length > 0;
  return !!filter.value;
}

function clearFilterValue(filter: any): void {
  if (filter.type === 'select') {
    filter.value = [];
  } else {
    filter.value = '';
  }
}

function getUniqueValues(column: string): Array<{ label: string; value: string; count: number }> {
  if (!dataStore.dataset?.data) return [];
  
  const counts = new Map<string, number>();
  dataStore.dataset.data.forEach(row => {
    const val = row[column];
    if (val !== undefined && val !== null && val !== '') {
      const key = String(val);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });
  
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([v, c]) => ({ label: v, value: v, count: c }));
}

function getFilteredUniqueValues(filter: any): Array<{ label: string; value: string; count: number }> {
  const all = getUniqueValues(filter.column);
  const search = (filterSearches.value[filter.id] || '').toLowerCase();
  if (!search) return all;
  return all.filter(item => item.label.toLowerCase().includes(search));
}

function toggleSelectValue(filter: any, value: string): void {
  if (!Array.isArray(filter.value)) filter.value = [];
  const idx = filter.value.indexOf(value);
  if (idx >= 0) {
    filter.value.splice(idx, 1);
  } else {
    filter.value.push(value);
  }
}

function selectAll(filter: any): void {
  const items = getFilteredUniqueValues(filter);
  filter.value = items.map((i: any) => i.value);
}

function clearSelection(filter: any): void {
  filter.value = [];
}

function onColumnChange(filter: any): void {
  // Reset value when column changes
  if (filter.type === 'select') {
    filter.value = [];
  } else {
    filter.value = '';
  }
  filterSearches.value[filter.id] = '';
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
      <div v-if="activeTab.filters.some(f => hasFilterValue(f))" class="flex flex-wrap gap-2 mb-2 p-2 bg-blue-50 rounded-lg">
        <div 
          v-for="filter in activeTab.filters" 
          :key="filter.id"
          v-show="hasFilterValue(filter)"
          class="flex items-center gap-1 text-xs bg-white text-blue-700 px-2 py-1 rounded border border-blue-200 shadow-sm"
        >
          <span class="font-semibold">{{ filter.column }}:</span>
          <span class="truncate max-w-[100px]">{{ getFilterSummary(filter) }}</span>
          <button @click="clearFilterValue(filter)" class="hover:text-red-500 rounded-full p-0.5">
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
          :modelValue="filter.column"
          @update:modelValue="(val: string | number) => { filter.column = String(val); onColumnChange(filter); }"
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
          
          <!-- Multi-select checkboxes -->
          <div v-else class="space-y-2">
            <label class="block text-[10px] font-medium text-gray-500 uppercase">Value</label>
            
            <!-- Search box -->
            <div class="relative">
              <SearchIcon class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                v-model="filterSearches[filter.id]"
                type="text"
                placeholder="Search values..."
                class="w-full text-xs pl-7 pr-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <!-- Select All / Clear -->
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-gray-400">
                {{ Array.isArray(filter.value) ? filter.value.length : 0 }} of {{ getUniqueValues(filter.column).length }} selected
              </span>
              <div class="flex gap-2">
                <button @click="selectAll(filter)" class="text-blue-500 hover:text-blue-700 font-medium">Select All</button>
                <button @click="clearSelection(filter)" class="text-gray-500 hover:text-red-500 font-medium">Clear</button>
              </div>
            </div>

            <!-- Checkbox list -->
            <div class="max-h-40 overflow-y-auto border border-gray-200 rounded bg-white">
              <label
                v-for="item in getFilteredUniqueValues(filter)"
                :key="item.value"
                class="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  :checked="Array.isArray(filter.value) && filter.value.includes(item.value)"
                  @change="toggleSelectValue(filter, item.value)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <span class="text-[10px] text-gray-400 tabular-nums">{{ item.count.toLocaleString() }}</span>
              </label>
              <div v-if="getFilteredUniqueValues(filter).length === 0" class="px-2 py-3 text-xs text-gray-400 text-center">
                No matching values
              </div>
            </div>
          </div>
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
