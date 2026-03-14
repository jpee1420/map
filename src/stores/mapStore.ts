import { defineStore } from 'pinia';
import { ref, computed, watch, reactive } from 'vue';
import { useUIStore } from '@/stores/uiStore';

export type AdminLevel = 'region' | 'province' | 'city';

// NCR special case: ADM2 districts are administrative only, not meaningful for data.
// We skip the district layer and directly show city-level sub-boundaries.
const NCR_PCODE = 'PH13';

export interface BoundaryInfo {
  pcode: string;        // Unique identifier (ADMx_PCODE)
  name: string;         // Display name (ADMx_EN)
  parentRegionPcode?: string;
  parentProvincePcode?: string;
}

/** Per-tab map view state */
export interface TabMapState {
  activeLevel: AdminLevel;
  selectedBoundaryPcode: string | null;
  visibleSubBoundaryPcodes: Set<string>;
  showLabels: boolean;
}

function createDefaultTabMapState(): TabMapState {
  return {
    activeLevel: 'region',
    selectedBoundaryPcode: null,
    visibleSubBoundaryPcodes: new Set(),
    showLabels: true,
  };
}

export const useMapStore = defineStore('map', () => {
  const uiStore = useUIStore();

  // ─── Per-tab state dictionary ───────────────────────────────────────
  const tabStates = reactive<Record<string, TabMapState>>({});

  /** Get or create state for a given tab */
  function getTabState(tabId: string): TabMapState {
    if (!tabStates[tabId]) {
      tabStates[tabId] = createDefaultTabMapState();
    }
    return tabStates[tabId];
  }

  /** Active tab's map state (always defined) */
  const activeTabState = computed<TabMapState>(() => {
    return getTabState(uiStore.activeTabId);
  });

  // Clean up state when tabs are removed
  watch(
    () => uiStore.tabs,
    (tabs) => {
      const tabIds = new Set(tabs.map(t => t.id));
      for (const id of Object.keys(tabStates)) {
        if (!tabIds.has(id)) {
          delete tabStates[id];
        }
      }
    },
    { deep: true },
  );

  // ─── Proxied properties (read/write to active tab) ─────────────────
  const activeLevel = computed<AdminLevel>({
    get: () => activeTabState.value.activeLevel,
    set: (v) => { activeTabState.value.activeLevel = v; },
  });

  const selectedBoundaryPcode = computed<string | null>({
    get: () => activeTabState.value.selectedBoundaryPcode,
    set: (v) => { activeTabState.value.selectedBoundaryPcode = v; },
  });

  const visibleSubBoundaryPcodes = computed<Set<string>>({
    get: () => activeTabState.value.visibleSubBoundaryPcodes,
    set: (v) => { activeTabState.value.visibleSubBoundaryPcodes = v; },
  });

  const showLabels = computed<boolean>({
    get: () => activeTabState.value.showLabels,
    set: (v) => { activeTabState.value.showLabels = v; },
  });

  // ─── GeoJSON cache (shared across all tabs) ────────────────────────
  const geoJsonCache = new Map<string, any>();
  const isLoading = ref(false);

  /**
   * Determine which GeoJSON cache key the active tab needs.
   * When a boundary is selected, we need the sub-level GeoJSON.
   */
  const activeGeoJSONLevel = computed<string>(() => {
    const state = activeTabState.value;
    if (state.selectedBoundaryPcode) {
      if (state.activeLevel === 'region') {
        return state.selectedBoundaryPcode === NCR_PCODE ? 'city' : 'province';
      }
      if (state.activeLevel === 'province') {
        return 'city';
      }
    }
    return state.activeLevel;
  });

  // The active GeoJSON for the current tab, pulled from cache
  const geoJSON = computed<any>(() => {
    return geoJsonCache.get(activeGeoJSONLevel.value) ?? null;
  });

  // Extracted boundary lists for dropdowns (with PCODEs)
  const regionList = ref<BoundaryInfo[]>([]);
  const provinceList = ref<BoundaryInfo[]>([]);
  const cityList = ref<BoundaryInfo[]>([]);

  const API_ENDPOINTS: Record<string, string> = {
    region: `${import.meta.env.BASE_URL}geojson/phl_admbnda_adm1_psa_namria_20231106.json`,
    province: `${import.meta.env.BASE_URL}geojson/phl_admbnda_adm2_psa_namria_20231106.json`,
    city: `${import.meta.env.BASE_URL}geojson/phl_admbnda_adm3_psa_namria_20231106.json`,
  };

  async function loadMapData(level: string): Promise<any> {
    if (geoJsonCache.has(level)) {
      return geoJsonCache.get(level);
    }

    isLoading.value = true;
    try {
      const endpoint = API_ENDPOINTS[level];
      if (!endpoint) {
        throw new Error(`Unknown level: ${level}`);
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${level} GeoJSON: ${response.statusText}`);
      }

      const geoData = await response.json();

      // Normalize properties: Ensure 'name' and 'pcode' exist for ECharts
      if (geoData.features) {
        geoData.features.forEach((feature: any) => {
          const props = feature.properties;
          // Set name for ECharts display
          if (!props.name) {
            if (level === 'region' && props.ADM1_EN) props.name = props.ADM1_EN;
            else if (level === 'province' && props.ADM2_EN) props.name = props.ADM2_EN;
            else if (level === 'city' && props.ADM3_EN) props.name = props.ADM3_EN;
          }
          // Set pcode for unique identification
          if (!props.pcode) {
            if (level === 'region' && props.ADM1_PCODE) props.pcode = props.ADM1_PCODE;
            else if (level === 'province' && props.ADM2_PCODE) props.pcode = props.ADM2_PCODE;
            else if (level === 'city' && props.ADM3_PCODE) props.pcode = props.ADM3_PCODE;
          }
        });
      }

      geoJsonCache.set(level, geoData);
      return geoData;
    } catch (error) {
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Extract lists from loaded GeoJSON
  async function loadBoundaryLists(): Promise<void> {
    const regionData = await loadMapData('region');
    const provinceData = await loadMapData('province');
    const cityData = await loadMapData('city');

    if (regionData?.features) {
      regionList.value = regionData.features
        .map((f: any) => ({
          pcode: f.properties.ADM1_PCODE,
          name: f.properties.ADM1_EN
        }))
        .filter((r: BoundaryInfo) => r.pcode && r.name)
        .sort((a: BoundaryInfo, b: BoundaryInfo) => a.name.localeCompare(b.name));
    }

    if (provinceData?.features) {
      provinceList.value = provinceData.features
        .map((f: any) => ({
          pcode: f.properties.ADM2_PCODE,
          name: f.properties.ADM2_EN,
          parentRegionPcode: f.properties.ADM1_PCODE
        }))
        // Exclude NCR districts — they are purely administrative and not usable boundaries.
        // NCR cities are accessed directly via ADM3 when NCR region is selected.
        .filter((p: BoundaryInfo) => p.pcode && p.name && !p.pcode.startsWith(NCR_PCODE))
        .sort((a: BoundaryInfo, b: BoundaryInfo) => a.name.localeCompare(b.name));
    }

    if (cityData?.features) {
      cityList.value = cityData.features
        .map((f: any) => ({
          pcode: f.properties.ADM3_PCODE,
          name: f.properties.ADM3_EN,
          parentRegionPcode: f.properties.ADM1_PCODE,
          parentProvincePcode: f.properties.ADM2_PCODE
        }))
        .filter((c: BoundaryInfo) => c.pcode && c.name)
        .sort((a: BoundaryInfo, b: BoundaryInfo) => a.name.localeCompare(b.name));
    }
  }

  // Get selected boundary info
  const selectedBoundary = computed<BoundaryInfo | null>(() => {
    if (!selectedBoundaryPcode.value) return null;
    
    if (activeLevel.value === 'region') {
      return regionList.value.find(r => r.pcode === selectedBoundaryPcode.value) || null;
    } else if (activeLevel.value === 'province') {
      return provinceList.value.find(p => p.pcode === selectedBoundaryPcode.value) || null;
    } else {
      return cityList.value.find(c => c.pcode === selectedBoundaryPcode.value) || null;
    }
  });

  // Get sub-boundaries for currently selected boundary
  const subBoundaries = computed<BoundaryInfo[]>(() => {
    if (!selectedBoundaryPcode.value) return [];

    if (activeLevel.value === 'region') {
      if (selectedBoundaryPcode.value === NCR_PCODE) {
        // NCR special case: return cities directly (skip districts)
        return cityList.value.filter(c => c.parentRegionPcode === NCR_PCODE);
      }
      // Return provinces in this region
      return provinceList.value.filter(p => p.parentRegionPcode === selectedBoundaryPcode.value);
    } else if (activeLevel.value === 'province') {
      // Return cities in this province
      return cityList.value.filter(c => c.parentProvincePcode === selectedBoundaryPcode.value);
    }
    return [];
  });

  // Get boundaries for current level dropdown
  const boundariesForLevel = computed<BoundaryInfo[]>(() => {
    if (activeLevel.value === 'region') {
      return regionList.value;
    } else if (activeLevel.value === 'province') {
      return provinceList.value;
    } else {
      return cityList.value;
    }
  });

  // Filtered GeoJSON based on visibility settings
  const filteredGeoJSON = computed(() => {
    if (!geoJSON.value) return null;
    
    // If no boundary selected, show all
    if (!selectedBoundaryPcode.value) return geoJSON.value;

    const sampleProps = geoJSON.value.features[0]?.properties || {};
    // Detect if the currently loaded GeoJSON is a sub-level by checking its properties.
    const isNCR = activeLevel.value === 'region' && selectedBoundaryPcode.value === NCR_PCODE;
    const isSubLevel = isNCR
      ? !!sampleProps.ADM3_PCODE
      : activeLevel.value === 'region' 
        ? !!sampleProps.ADM2_PCODE 
        : !!sampleProps.ADM3_PCODE;

    const filtered = {
      ...geoJSON.value,
      features: geoJSON.value.features.filter((f: any) => {
        const props = f.properties;
        
        if (activeLevel.value === 'region') {
          if (isNCR && isSubLevel) {
            // NCR: show all city-level boundaries belonging to NCR
            return props.ADM1_PCODE === NCR_PCODE;
          }
          if (isSubLevel) {
            // We are looking at provinces: keep all provinces belonging to the selected region
            return props.ADM1_PCODE === selectedBoundaryPcode.value;
          }
          // We are looking at regions: keep only the selected region
          return props.ADM1_PCODE === selectedBoundaryPcode.value || props.pcode === selectedBoundaryPcode.value;
        }
        
        if (activeLevel.value === 'province') {
          if (isSubLevel) {
            // We are looking at cities: keep all cities belonging to the selected province
            return props.ADM2_PCODE === selectedBoundaryPcode.value;
          }
          // We are looking at provinces: keep only the selected province
          return props.ADM2_PCODE === selectedBoundaryPcode.value || props.pcode === selectedBoundaryPcode.value;
        }
        
        return true;
      })
    };
    
    return filtered;
  });

  function setLevel(level: AdminLevel): void {
    activeLevel.value = level;
    selectedBoundaryPcode.value = null;
    visibleSubBoundaryPcodes.value = new Set();
    loadMapData(level);
  }

  async function selectBoundary(pcode: string | null): Promise<void> {
    selectedBoundaryPcode.value = pcode;
    
    // atomic update to avoid intermediate watcher triggers
    const newSet = new Set<string>();
    
    if (pcode) {
      // Load the sub-level GeoJSON data first
      if (activeLevel.value === 'region') {
        if (pcode === NCR_PCODE) {
          await loadMapData('city');
        } else {
          await loadMapData('province');
        }
      } else if (activeLevel.value === 'province') {
        await loadMapData('city');
      }
      
      // Compute sub-boundaries and select all by default
      let subs: BoundaryInfo[] = [];
      if (activeLevel.value === 'region') {
        if (pcode === NCR_PCODE) {
          subs = cityList.value.filter(c => c.parentRegionPcode === NCR_PCODE);
        } else {
          subs = provinceList.value.filter(p => p.parentRegionPcode === pcode);
        }
      } else if (activeLevel.value === 'province') {
        subs = cityList.value.filter(c => c.parentProvincePcode === pcode);
      }
      
      subs.forEach(sub => newSet.add(sub.pcode));
    } else {
      // When clearing selection, ensure current level data is loaded
      await loadMapData(activeLevel.value);
    }
    
    visibleSubBoundaryPcodes.value = newSet;
  }

  async function toggleSubBoundary(pcode: string): Promise<void> {
    const wasEmpty = visibleSubBoundaryPcodes.value.size === 0;

    if (visibleSubBoundaryPcodes.value.has(pcode)) {
      visibleSubBoundaryPcodes.value.delete(pcode);
    } else {
      visibleSubBoundaryPcodes.value.add(pcode);
    }
    // Trigger reactivity
    visibleSubBoundaryPcodes.value = new Set(visibleSubBoundaryPcodes.value);

    const isNowEmpty = visibleSubBoundaryPcodes.value.size === 0;

    // First sub-boundary checked: load the sub-level GeoJSON
    if (wasEmpty && !isNowEmpty) {
      if (activeLevel.value === 'region') {
        await loadMapData('province');
      } else if (activeLevel.value === 'province') {
        await loadMapData('city');
      }
    }
    // Last sub-boundary unchecked: reload base-level GeoJSON
    if (!wasEmpty && isNowEmpty && selectedBoundaryPcode.value) {
      await loadMapData(activeLevel.value);
    }
  }

  async function selectAllSubBoundaries(): Promise<void> {
    // Ensure sub-level GeoJSON is loaded so filteredGeoJSON can filter it
    if (activeLevel.value === 'region') {
      if (selectedBoundaryPcode.value === NCR_PCODE) {
        await loadMapData('city');
      } else {
        await loadMapData('province');
      }
    } else if (activeLevel.value === 'province') {
      await loadMapData('city');
    }
    const newSet = new Set<string>();
    subBoundaries.value.forEach(b => newSet.add(b.pcode));
    visibleSubBoundaryPcodes.value = newSet;
  }

  async function clearSubBoundaries(): Promise<void> {
    visibleSubBoundaryPcodes.value = new Set();
    // Reload base-level GeoJSON so filteredGeoJSON shows parent boundary shape
    if (selectedBoundaryPcode.value) {
      await loadMapData(activeLevel.value);
    }
  }

  function toggleLabels(): void {
    showLabels.value = !showLabels.value;
  }

  return {
    activeLevel,
    selectedBoundaryPcode,
    selectedBoundary,
    visibleSubBoundaryPcodes,
    geoJSON,
    isLoading,
    showLabels,
    regionList,
    provinceList,
    cityList,
    subBoundaries,
    boundariesForLevel,
    filteredGeoJSON,
    tabStates,
    getTabState,
    setLevel,
    selectBoundary,
    toggleSubBoundary,
    selectAllSubBoundaries,
    clearSubBoundaries,
    toggleLabels,
    loadMapData,
    loadBoundaryLists
  };
});
