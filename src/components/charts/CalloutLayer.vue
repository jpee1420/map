<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { EChartsType } from "echarts";
import { calculateCentroid } from "@/utils/geoUtils";

const props = defineProps<{
  chartInstance: EChartsType;
  geoData: any;
  mapData: any[]; // Data from EChartsMap (metrics)
}>();

const callouts = ref<Array<{
  name: string;
  x: number;
  y: number;
  value: number;
  metrics: any;
}>>([]);

// Cached centroids to avoid re-calculating on every zoom
const centroids = new Map<string, [number, number]>();

function updateCallouts() {
  if (!props.chartInstance || !props.geoData || props.chartInstance.isDisposed()) return;

  const width = props.chartInstance.getWidth();
  const height = props.chartInstance.getHeight();
  const newCallouts: typeof callouts.value = [];

  // 1. Calculate centroids if not cached
  if (centroids.size === 0) {
    props.geoData.features.forEach((feature: any) => {
      const name = feature.properties.name;
      // Use PCODE as key if available for uniqueness, else name
      const key = feature.properties.ADM3_PCODE || 
                  feature.properties.ADM2_PCODE || 
                  feature.properties.ADM1_PCODE || 
                  name;
                  
      if (key) {
        const center = calculateCentroid(feature.geometry);
        if (center) {
          centroids.set(key, center);
        }
      }
    });
  }

  // 2. Map data to screen coordinates
  props.mapData.forEach((item: any) => {
    // Find matching centroid
    const centroidKey = Object.keys(Object.fromEntries(centroids)).find(key => {
       // This is slow (O(N^2)). 
       // Better: assume mapData name matches geoData name used for key if no pcode
       return key === item.name;
    }) || item.name;

    const center = centroids.get(centroidKey);

    if (center) {
      // Project to screen coordinates
      const pixel = props.chartInstance.convertToPixel("geo", center);
      
      if (pixel && Array.isArray(pixel) && pixel.length >= 2) {
        const x = pixel[0];
        const y = pixel[1];
        
        // Simple culling: check if within view
        if (typeof x === 'number' && typeof y === 'number' && 
            x >= 0 && x <= width && y >= 0 && y <= height) {
           newCallouts.push({
             name: item.name,
             x,
             y,
             value: item.value,
             metrics: item
           });
        }
      }
    }
  });

  callouts.value = newCallouts;
}

// Debounce updates for smoothness
let timer: ReturnType<typeof setTimeout>;
function debouncedUpdate() {
  clearTimeout(timer);
  timer = setTimeout(() => {
       requestAnimationFrame(updateCallouts);
  }, 10); // Short debounce
}

// Listen to ECharts events
onMounted(() => {
  props.chartInstance.on('georoam', debouncedUpdate);
  props.chartInstance.on('resize', debouncedUpdate);
  updateCallouts();
});

onUnmounted(() => {
  props.chartInstance.off('georoam', debouncedUpdate);
  props.chartInstance.off('resize', debouncedUpdate);
});

// Update when data changes
watch(() => props.mapData, updateCallouts, { deep: true });
watch(() => props.geoData, () => {
  centroids.clear(); // Clear cache when map changes
  updateCallouts();
});

</script>

<template>
  <div class="absolute inset-0 pointer-events-none overflow-hidden text-xs">
    <svg class="absolute inset-0 w-full h-full">
      <defs>
        <marker id="dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="2" fill="#3b82f6" />
        </marker>
      </defs>
      <g v-for="callout in callouts" :key="callout.name">
        <!-- Leader Line (simple vertical offset) -->
        <line 
          :x1="callout.x" 
          :y1="callout.y" 
          :x2="callout.x + 20" 
          :y2="callout.y - 20" 
          stroke="#3b82f6" 
          stroke-width="1"
          marker-start="url(#dot)"
        />
      </g>
    </svg>
    
    <div 
      v-for="callout in callouts" 
      :key="callout.name"
      class="absolute bg-white/90 backdrop-blur-sm border border-blue-200 rounded shadow-md px-2 py-1 pointer-events-auto hover:z-50 hover:bg-white transition-colors cursor-help max-w-[150px]"
      :style="{
        left: `${callout.x + 20}px`,
        top: `${callout.y - 20}px`,
        transform: 'translateY(-50%)'
      }"
    >
      <div class="font-bold text-gray-700 truncate mb-0.5">{{ callout.name }}</div>
      <div class="flex items-baseline gap-1">
        <span class="text-blue-600 font-bold">{{ callout.value.toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>
