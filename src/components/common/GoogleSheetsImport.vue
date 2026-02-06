<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import { isValidGoogleSheetsUrl, fetchGoogleSheetsData } from '@/utils/googleSheetsParser';
import { LinkIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-vue-next';
import BaseButton from '@/components/common/BaseButton.vue';

const dataStore = useDataStore();

const sheetUrl = ref('');
const isConnecting = ref(false);
const connectionError = ref<string | null>(null);
const isConnected = ref(false);
const lastRefresh = ref<Date | null>(null);
const autoRefresh = ref(false);
const refreshInterval = ref<number>(5);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const intervalOptions = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 }
];

const isValidUrl = computed(() => isValidGoogleSheetsUrl(sheetUrl.value));

async function connect(): Promise<void> {
  if (!isValidUrl.value) {
    connectionError.value = 'Please enter a valid Google Sheets URL';
    return;
  }

  isConnecting.value = true;
  connectionError.value = null;

  try {
    const result = await fetchGoogleSheetsData(sheetUrl.value);
    
    dataStore.dataset = {
      fileName: `Google Sheet`,
      columns: result.columns,
      data: result.data,
      timestamp: Date.now()
    };

    isConnected.value = true;
    lastRefresh.value = new Date();
    
    if (autoRefresh.value) {
      startAutoRefresh();
    }
  } catch (error: unknown) {
    connectionError.value = error instanceof Error ? error.message : 'Failed to connect';
    isConnected.value = false;
  } finally {
    isConnecting.value = false;
  }
}

async function refreshData(): Promise<void> {
  if (!isConnected.value || !sheetUrl.value) return;
  
  try {
    const result = await fetchGoogleSheetsData(sheetUrl.value);
    dataStore.dataset = {
      fileName: `Google Sheet`,
      columns: result.columns,
      data: result.data,
      timestamp: Date.now()
    };
    lastRefresh.value = new Date();
    connectionError.value = null;
  } catch (error: unknown) {
    connectionError.value = error instanceof Error ? error.message : 'Refresh failed';
  }
}

function startAutoRefresh(): void {
  stopAutoRefresh();
  if (autoRefresh.value && isConnected.value) {
    refreshTimer = setInterval(() => {
      refreshData();
    }, refreshInterval.value * 60 * 1000);
  }
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function handleAutoRefreshChange(): void {
  if (autoRefresh.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function disconnect(): void {
  isConnected.value = false;
  stopAutoRefresh();
  sheetUrl.value = '';
  lastRefresh.value = null;
}

function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString();
}

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <div class="space-y-4">
    <!-- URL Input -->
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">
        Google Sheets URL
      </label>
      <div class="flex gap-2">
        <div class="relative flex-1">
          <LinkIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="sheetUrl"
            type="url"
            placeholder="Paste Google Sheets share link..."
            :disabled="isConnected"
            class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>
    </div>

    <!-- Connect/Disconnect Button -->
    <div class="flex gap-2">
      <BaseButton
        v-if="!isConnected"
        :disabled="!isValidUrl || isConnecting"
        @click="connect"
        class="flex-1"
      >
        <LoaderIcon v-if="isConnecting" class="w-4 h-4 mr-2 animate-spin" />
        <span>{{ isConnecting ? 'Connecting...' : 'Connect' }}</span>
      </BaseButton>
      
      <template v-else>
        <BaseButton
          variant="secondary"
          @click="refreshData"
          class="flex-1"
        >
          <RefreshCwIcon class="w-4 h-4 mr-2" />
          Refresh
        </BaseButton>
        <BaseButton
          variant="danger"
          @click="disconnect"
        >
          Disconnect
        </BaseButton>
      </template>
    </div>

    <!-- Connection Status -->
    <div 
      v-if="isConnected || connectionError"
      class="flex items-center gap-2 p-3 rounded-lg text-sm"
      :class="isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
    >
      <CheckCircleIcon v-if="isConnected" class="w-4 h-4 shrink-0" />
      <XCircleIcon v-else class="w-4 h-4 shrink-0" />
      <span v-if="isConnected">
        Connected • Last refresh: {{ formatTime(lastRefresh) }}
      </span>
      <span v-else>{{ connectionError }}</span>
    </div>

    <!-- Auto-Refresh Settings -->
    <div v-if="isConnected" class="space-y-3 p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700">Auto-refresh</label>
        <button
          @click="autoRefresh = !autoRefresh; handleAutoRefreshChange()"
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
          :class="autoRefresh ? 'bg-blue-600' : 'bg-gray-300'"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="autoRefresh ? 'translate-x-4' : 'translate-x-0.5'"
          />
        </button>
      </div>
      
      <div v-if="autoRefresh" class="flex items-center gap-2">
        <span class="text-xs text-gray-500">Refresh every</span>
        <select
          v-model="refreshInterval"
          @change="startAutoRefresh"
          class="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option 
            v-for="opt in intervalOptions" 
            :key="opt.value" 
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
