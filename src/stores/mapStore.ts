import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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

export const useMapStore = defineStore('map', () => {
  // Current view level
  const activeLevel = ref<AdminLevel>('region');
  
  // Selected boundary PCODE at current level
  const selectedBoundaryPcode = ref<string | null>(null);
  
  // Set of visible sub-boundary PCODEs (checked checkboxes)
  const visibleSubBoundaryPcodes = ref<Set<string>>(new Set());
  
  // Raw GeoJSON data for each level
  const geoJSON = ref<any>(null);
  const geoJsonCache = new Map<string, any>();
  const isLoading = ref(false);
  
  // Callout labels visibility
  const showLabels = ref(true);

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
      const cached = geoJsonCache.get(level);
      geoJSON.value = cached;
      return cached;
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
      geoJSON.value = geoData;
      return geoData;
    } catch (error) {
      geoJSON.value = null;
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
    
    // Restore the map data for the current active level so the map renders correctly
    await loadMapData(activeLevel.value);
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
    // Region level: sub-level = province (has ADM2_PCODE).
    // Province level: sub-level = city (has ADM3_PCODE).
    // NCR special case: sub-level at region is city (also has ADM3_PCODE).
    const isNCR = activeLevel.value === 'region' && selectedBoundaryPcode.value === NCR_PCODE;
    const isSubLevel = isNCR
      ? !!sampleProps.ADM3_PCODE
      : activeLevel.value === 'region' 
        ? !!sampleProps.ADM2_PCODE 
        : !!sampleProps.ADM3_PCODE;

    // Filter features:
    // If we have sub-boundaries visible, we are looking at the sub-level GeoJSON 
    // (e.g. holding provinces for the selected region). We want to show ALL provinces 
    // in that region, not just the checked ones, to maintain map context.
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
    visibleSubBoundaryPcodes.value.clear();
    loadMapData(level);
  }

  async function selectBoundary(pcode: string | null): Promise<void> {
    selectedBoundaryPcode.value = pcode;
    
    // atomic update to avoid intermediate watcher triggers
    const newSet = new Set<string>();
    
    if (pcode) {
      // Load the sub-level GeoJSON data first
      // For NCR at region level: skip districts, load cities directly
      if (activeLevel.value === 'region') {
        if (pcode === NCR_PCODE) {
          await loadMapData('city');
        } else {
          await loadMapData('province');
        }
      } else if (activeLevel.value === 'province') {
        await loadMapData('city');
      }
      
      // Logic from sub-boundaries computed property
      // We manually query here to ensure we have the latest data immediately
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
      // When clearing selection, reload the current level
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
      // NCR special case: load cities directly
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
