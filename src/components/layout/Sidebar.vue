<script setup lang="ts">
import { computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-vue-next";
import MapViewControls from "@/components/panels/MapViewControls.vue";
import FilterPanel from "@/components/panels/FilterPanel.vue";
import PivotFieldsPanel from "@/components/panels/PivotFieldsPanel.vue";

const uiStore = useUIStore();
const isCollapsed = computed(() => uiStore.sidebarCollapsed);
const activeTab = computed(() => uiStore.tabs.find(t => t.id === uiStore.activeTabId));
const isMapType = computed(() => activeTab.value?.type === 'map');

function toggle() {
  uiStore.toggleSidebar();
}
</script>

<template>
  <aside
    class="bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative z-10"
    :class="[isCollapsed ? 'w-12' : 'w-80']"
  >
    <!-- Toggle Button -->
    <button
      class="absolute -right-3 top-4 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50 z-20"
      @click="toggle"
    >
      <ChevronRightIcon v-if="isCollapsed" class="w-4 h-4 text-gray-500" />
      <ChevronLeftIcon v-else class="w-4 h-4 text-gray-500" />
    </button>

    <div
      v-if="!isCollapsed"
      class="h-full overflow-y-auto p-4 flex flex-col gap-6"
    >
      <!-- Map View Controls (map only) -->
      <section v-if="isMapType">
        <h3
          class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          Map View
        </h3>
        <MapViewControls />
      </section>

      <!-- Filters -->
      <section>
        <h3
          class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          Filters
        </h3>
        <FilterPanel />
      </section>

      <!-- Pivot Fields -->
      <section>
        <h3
          class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          Fields
        </h3>
        <PivotFieldsPanel />
      </section>
    </div>
  </aside>
</template>
