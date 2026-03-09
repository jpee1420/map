<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useMapStore, type AdminLevel } from "@/stores/mapStore";
import { CheckIcon } from "lucide-vue-next";

const mapStore = useMapStore();

const levels: { value: AdminLevel; label: string }[] = [
  { value: "region", label: "Region" },
  { value: "province", label: "Province" },
];

const showSubBoundaries = computed(() => {
  return mapStore.selectedBoundaryPcode && mapStore.subBoundaries.length > 0;
});

function handleLevelChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  mapStore.setLevel(target.value as AdminLevel);
}

function handleBoundaryChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  mapStore.selectBoundary(target.value || null);
}

function isSubBoundaryVisible(pcode: string): boolean {
  return mapStore.visibleSubBoundaryPcodes.has(pcode);
}

onMounted(() => {
  mapStore.loadBoundaryLists();
});

// Sub-boundary data loading is handled directly in mapStore's
// toggleSubBoundary, selectAllSubBoundaries, and clearSubBoundaries.
</script>

<template>
  <div class="space-y-4">
    <!-- Admin Level Selector -->
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">
        Admin Level
      </label>
      <select
        :value="mapStore.activeLevel"
        @change="handleLevelChange"
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option v-for="level in levels" :key="level.value" :value="level.value">
          {{ level.label }}
        </option>
      </select>
    </div>

    <!-- Boundary Selector -->
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">
        Select Boundary
      </label>
      <select
        :value="mapStore.selectedBoundaryPcode || ''"
        @change="handleBoundaryChange"
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        <option value="">
          All {{ levels.find((l) => l.value === mapStore.activeLevel)?.label }}s
        </option>
        <option
          v-for="boundary in mapStore.boundariesForLevel"
          :key="boundary.pcode"
          :value="boundary.pcode"
        >
          {{ boundary.name }}
        </option>
      </select>
    </div>

    <!-- Show Labels Toggle -->
    <div class="flex items-center justify-between py-2">
      <label class="text-xs font-medium text-gray-500">Show Data Labels</label>
      <button
        @click="mapStore.toggleLabels"
        class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
        :class="mapStore.showLabels ? 'bg-blue-600' : 'bg-gray-300'"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
          :class="mapStore.showLabels ? 'translate-x-4' : 'translate-x-0.5'"
        />
      </button>
    </div>

    <!-- Sub-Boundaries Checkboxes -->
    <div v-if="showSubBoundaries" class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="block text-xs font-medium text-gray-500">
          Show Sub-Boundaries
        </label>
        <div class="flex gap-2">
          <button
            @click="mapStore.selectAllSubBoundaries"
            class="text-xs text-blue-600 hover:underline"
          >
            Select All
          </button>
          <button
            @click="mapStore.clearSubBoundaries"
            class="text-xs text-gray-500 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        class="max-h-48 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50 p-2 space-y-1"
      >
        <label
          v-for="sub in mapStore.subBoundaries"
          :key="sub.pcode"
          class="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer group"
        >
          <div
            class="w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0"
            :class="
              isSubBoundaryVisible(sub.pcode)
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300 bg-white group-hover:border-blue-400'
            "
          >
            <CheckIcon
              v-if="isSubBoundaryVisible(sub.pcode)"
              class="w-3 h-3 text-white"
            />
          </div>
          <input
            type="checkbox"
            :checked="isSubBoundaryVisible(sub.pcode)"
            @change="mapStore.toggleSubBoundary(sub.pcode)"
            class="sr-only"
          />
          <span class="text-sm text-gray-700 truncate">{{ sub.name }}</span>
          <span class="text-xs text-gray-400 ml-auto shrink-0">{{
            sub.pcode
          }}</span>
        </label>
      </div>

      <p class="text-xs text-gray-400">
        {{ mapStore.visibleSubBoundaryPcodes.size }} of
        {{ mapStore.subBoundaries.length }} selected
      </p>
    </div>
  </div>
</template>
