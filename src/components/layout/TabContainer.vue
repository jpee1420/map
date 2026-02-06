<script setup lang="ts">
import { ref, computed, nextTick, defineAsyncComponent } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { 
  PlusIcon, XIcon, GlobeIcon, BarChartIcon, LineChartIcon, PieChartIcon, 
  MapPinIcon, DownloadIcon, FileSpreadsheetIcon, ImageIcon, FileIcon
} from 'lucide-vue-next';
import BaseButton from '@/components/common/BaseButton.vue';
import { exportToPng, exportToSvg, exportToExcel } from '@/utils/chartExport';
import { useChartData } from '@/composables/useChartData';

// Asynchronously load chart components
const EChartsMap = defineAsyncComponent(() => import('@/components/charts/EChartsMap.vue'));
const EChartsGeneric = defineAsyncComponent(() => import('@/components/charts/EChartsGeneric.vue'));

const uiStore = useUIStore();
const dataStore = useDataStore();

const chartRef = ref<any>(null); // Reference to the chart component
const editingTabId = ref<string | null>(null);
const editNameInput = ref<HTMLInputElement | null>(null);

const activeTab = computed(() => 
  uiStore.tabs.find(t => t.id === uiStore.activeTabId)
);

// Chart Data Composable for Export
const { chartData } = useChartData(
  dataStore.dataset,
  activeTab.value?.filters || [],
  activeTab.value?.pivotFields || []
);

// Tab Drag & Drop
const draggedTabId = ref<string | null>(null);

function onDragStart(event: DragEvent, tabId: string) {
  if (event.dataTransfer) {
    draggedTabId.value = tabId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tabId);
  }
}

function onDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault();
  const sourceId = draggedTabId.value;
  if (sourceId && sourceId !== targetTabId) {
    const sourceIndex = uiStore.tabs.findIndex(t => t.id === sourceId);
    const targetIndex = uiStore.tabs.findIndex(t => t.id === targetTabId);
    
    if (sourceIndex > -1 && targetIndex > -1) {
      const newTabs = [...uiStore.tabs];
      const [movedTab] = newTabs.splice(sourceIndex, 1);
      newTabs.splice(targetIndex, 0, movedTab);
      uiStore.reorderTabs(newTabs);
    }
  }
  draggedTabId.value = null;
}

// Tab Renaming
function startEditing(tabId: string) {
  editingTabId.value = tabId;
  nextTick(() => {
    editNameInput.value?.focus();
  });
}

function finishEditing(tabId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const newName = input.value.trim();
  if (newName) {
    uiStore.updateTabName(tabId, newName);
  }
  editingTabId.value = null;
}

// Tab Management
function addNewTab() {
  const newId = `tab-${Date.now()}`;
  uiStore.addTab({
    id: newId,
    name: `New Tab ${uiStore.tabs.length + 1}`,
    type: 'map',
    filters: [],
    pivotFields: []
  });
}

function closeTab(e: Event, tabId: string) {
  e.stopPropagation();
  uiStore.removeTab(tabId);
}

// Exports
function handleExport(type: 'png' | 'svg' | 'excel') {
  const chartInstance = chartRef.value?.chartInstance;
  const fileName = activeTab.value?.name || 'chart_export';

  if (type === 'excel') {
    if (chartData.value.source.length) {
      exportToExcel(chartData.value.source, fileName);
    }
  } else if (chartInstance) {
    if (type === 'png') exportToPng(chartInstance, fileName);
    if (type === 'svg') exportToSvg(chartInstance, fileName);
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Tab Bar -->
    <div class="flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto px-2 pt-2">
      <div 
        v-for="tab in uiStore.tabs" 
        :key="tab.id"
        class="group relative flex items-center gap-2 px-4 py-2 mr-1 rounded-t-lg border-t border-l border-r border-transparent cursor-pointer select-none min-w-[120px]"
        :class="activeTab?.id === tab.id ? 'bg-white border-gray-200 text-blue-600 font-medium z-10' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'"
        @click="uiStore.activeTabId = tab.id"
        draggable="true"
        @dragstart="onDragStart($event, tab.id)"
        @dragover.prevent
        @drop="onDrop($event, tab.id)"
        @dblclick="startEditing(tab.id)"
      >
        <!-- Icon based on type -->
        <component 
          :is="tab.type === 'map' ? GlobeIcon : tab.type === 'bar' ? BarChartIcon : 
               tab.type === 'line' ? LineChartIcon : tab.type === 'pie' ? PieChartIcon : MapPinIcon" 
          class="w-4 h-4 shrink-0" 
        />
        
        <!-- Tab Name / Edit Input -->
        <input
          v-if="editingTabId === tab.id"
          ref="editNameInput"
          type="text"
          :value="tab.name"
          @blur="finishEditing(tab.id, $event)"
          @keyup.enter="finishEditing(tab.id, $event)"
          class="bg-white border border-blue-500 px-1 py-0.5 text-xs w-24 outline-none rounded"
        />
        <span v-else class="text-sm truncate max-w-[150px]">{{ tab.name }}</span>

        <!-- Close Button -->
        <button
          v-if="uiStore.tabs.length > 1"
          @click="closeTab($event, tab.id)"
          class="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-500 rounded-full transition-all"
        >
          <XIcon class="w-3 h-3" />
        </button>
      </div>

      <!-- Add Tab Button -->
      <button 
        @click="addNewTab" 
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 transition-colors ml-2"
        title="New Tab"
      >
        <PlusIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Toolbar (Chart Type & Export) -->
    <div v-if="activeTab" class="flex items-center justify-between p-2 border-b border-gray-100 bg-white">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-500 uppercase ml-2">Chart Type:</span>
        <select 
          v-model="activeTab.type" 
          class="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="map">Choropleth Map</option>
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="pie">Pie Chart</option>
          <option value="scatter">Scatter Plot</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
          <button 
            @click="handleExport('png')" 
            class="p-1.5 hover:bg-white hover:shadow rounded text-gray-600" 
            title="Export as PNG"
          >
            <ImageIcon class="w-4 h-4" />
          </button>
          <button 
            @click="handleExport('svg')" 
            class="p-1.5 hover:bg-white hover:shadow rounded text-gray-600" 
            title="Export as SVG"
          >
            <FileIcon class="w-4 h-4" />
          </button>
          <button 
            @click="handleExport('excel')" 
            class="p-1.5 hover:bg-white hover:shadow rounded text-gray-600" 
            title="Export Data (Excel)"
          >
            <FileSpreadsheetIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-hidden relative p-4">
      <template v-if="activeTab">
        <EChartsMap 
          v-if="activeTab.type === 'map'"
          ref="chartRef"
          :tab-id="activeTab.id"
        />
        <EChartsGeneric 
          v-else
          ref="chartRef"
          :tab-id="activeTab.id"
        />
      </template>
      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
        <div class="mb-4">No active tabs</div>
        <BaseButton @click="addNewTab">Create New Tab</BaseButton>
      </div>
    </div>
  </div>
</template>
