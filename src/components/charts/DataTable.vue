<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-vue-next';

const props = defineProps<{
  tabId: string;
}>();

const dataStore = useDataStore();
const uiStore = useUIStore();

const activeTab = computed(() => uiStore.tabs.find(t => t.id === props.tabId));
const filters = computed(() => activeTab.value?.filters || []);

// Apply filters to raw data
const filteredData = computed(() => {
  const dataset = dataStore.dataset;
  if (!dataset) return [];
  let data = [...dataset.data];

  for (const filter of filters.value) {
    const col = filter.column;

    // Skip filters with no meaningful value
    const hasValue = Array.isArray(filter.value)
      ? filter.value.length > 0
      : !!filter.value;
    if (!hasValue) continue;

    if (filter.type === 'select' || filter.type === 'search') {
      if (Array.isArray(filter.value)) {
        data = data.filter(row => filter.value.includes(String(row[col] ?? '')));
      } else {
        data = data.filter(row => String(row[col] ?? '') === String(filter.value));
      }
    } else if (filter.type === 'range' && filter.value) {
      const { min, max } = filter.value;
      data = data.filter(row => {
        const v = Number(row[col]);
        if (isNaN(v)) return false;
        if (min !== undefined && min !== '' && v < Number(min)) return false;
        if (max !== undefined && max !== '' && v > Number(max)) return false;
        return true;
      });
    }
  }

  return data;
});

const columns = computed(() => dataStore.dataset?.columns || []);

// Sorting
const sortColumn = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc' | null>(null);

const sortedData = computed(() => {
  const data = filteredData.value;
  if (!sortColumn.value || !sortDirection.value) return data;

  const col = sortColumn.value;
  const dir = sortDirection.value;

  return [...data].sort((a, b) => {
    const va = a[col];
    const vb = b[col];
    const na = Number(va);
    const nb = Number(vb);

    // Numeric comparison if both are numbers
    if (!isNaN(na) && !isNaN(nb)) {
      return dir === 'asc' ? na - nb : nb - na;
    }

    // String comparison
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
});

function toggleSort(col: string): void {
  if (sortColumn.value !== col) {
    sortColumn.value = col;
    sortDirection.value = 'asc';
  } else if (sortDirection.value === 'asc') {
    sortDirection.value = 'desc';
  } else {
    sortColumn.value = null;
    sortDirection.value = null;
  }
  currentPage.value = 1;
}

// Pagination
const rowsPerPageOptions = [10, 25, 50, 100];
const rowsPerPage = ref<number>(25);
const currentPage = ref<number>(1);

const totalRows = computed(() => sortedData.value.length);
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / rowsPerPage.value)));

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * rowsPerPage.value;
  return sortedData.value.slice(start, start + rowsPerPage.value);
});

const startRow = computed(() => {
  if (totalRows.value === 0) return 0;
  return (currentPage.value - 1) * rowsPerPage.value + 1;
});

const endRow = computed(() => {
  return Math.min(currentPage.value * rowsPerPage.value, totalRows.value);
});

// Page numbers to display
const visiblePages = computed(() => {
  const pages: number[] = [];
  const total = totalPages.value;
  const current = currentPage.value;
  const range = 2;

  for (let i = Math.max(1, current - range); i <= Math.min(total, current + range); i++) {
    pages.push(i);
  }
  return pages;
});

function goToPage(page: number): void {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

function onRowsPerPageChange(val: number): void {
  rowsPerPage.value = val;
  currentPage.value = 1;
}

// Reset page when filters change
import { watch } from 'vue';
watch(filteredData, () => {
  currentPage.value = 1;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Table -->
    <div class="flex-1 overflow-auto border border-gray-200 rounded-lg">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">#</th>
            <th
              v-for="col in columns"
              :key="col"
              @click="toggleSort(col)"
              class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none transition-colors"
            >
              <span class="flex items-center gap-1">
                {{ col }}
                <span v-if="sortColumn === col" class="text-blue-500">
                  {{ sortDirection === 'asc' ? '▲' : '▼' }}
                </span>
                <span v-else class="text-gray-300">⇅</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="(row, idx) in paginatedData"
            :key="idx"
            class="hover:bg-blue-50 transition-colors"
            :class="idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'"
          >
            <td class="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{{ startRow + idx }}</td>
            <td
              v-for="col in columns"
              :key="col"
              class="px-4 py-2.5 text-gray-700 whitespace-nowrap"
            >
              {{ row[col] ?? '' }}
            </td>
          </tr>
          <tr v-if="paginatedData.length === 0">
            <td :colspan="columns.length + 1" class="px-4 py-12 text-center text-gray-400">
              No data available. Import data to view the table.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-500">Rows per page:</span>
        <select
          :value="rowsPerPage"
          @change="onRowsPerPageChange(Number(($event.target as HTMLSelectElement).value))"
          class="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option v-for="opt in rowsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <span class="text-xs text-gray-500">
          {{ startRow }}–{{ endRow }} of {{ totalRows.toLocaleString() }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon class="w-4 h-4" />
        </button>

        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          class="px-3 py-1 text-sm rounded transition-colors"
          :class="page === currentPage
            ? 'bg-blue-600 text-white font-medium'
            : 'hover:bg-gray-100 text-gray-600'"
        >
          {{ page }}
        </button>

        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
