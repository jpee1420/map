import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type AdminLevel = 'region' | 'province' | 'city';

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

  // Extracted boundary lists for dropdowns (with PCODEs)
  const regionList = ref<BoundaryInfo[]>([]);
  const provinceList = ref<BoundaryInfo[]>([]);
  const cityList = ref<BoundaryInfo[]>([]);

  async function loadMapData(level: string): Promise<any> {
    if (geoJsonCache.has(level)) {
      const cached = geoJsonCache.get(level);
      geoJSON.value = cached;
      return cached;
    }

    isLoading.value = true;
    try {
      let data;
      switch (level) {
        case 'region':
          data = await import('@/assets/geojson/phl_admbnda_adm1_psa_namria_20231106.json');
          break;
        case 'province':
          data = await import('@/assets/geojson/phl_admbnda_adm2_psa_namria_20231106.json');
          break;
        case 'city':
          data = await import('@/assets/geojson/phl_admbnda_adm3_psa_namria_20231106.json');
          break;
        default:
          throw new Error(`Unknown level: ${level}`);
      }

      const geoData = data.default || data;

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
      console.error(error);
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
        .filter((p: BoundaryInfo) => p.pcode && p.name)
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

    // Filter features based on visible sub-boundary PCODEs
    const filtered = {
      ...geoJSON.value,
      features: geoJSON.value.features.filter((f: any) => {
        const props = f.properties;
        
        if (activeLevel.value === 'region') {
          if (visibleSubBoundaryPcodes.value.size > 0) {
            // Show provinces with matching PCODEs
            return visibleSubBoundaryPcodes.value.has(props.ADM2_PCODE || props.pcode);
          }
          return props.ADM1_PCODE === selectedBoundaryPcode.value || props.pcode === selectedBoundaryPcode.value;
        }
        
        if (activeLevel.value === 'province') {
          if (visibleSubBoundaryPcodes.value.size > 0) {
            return visibleSubBoundaryPcodes.value.has(props.ADM3_PCODE || props.pcode);
          }
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

  function selectBoundary(pcode: string | null): void {
    selectedBoundaryPcode.value = pcode;
    visibleSubBoundaryPcodes.value.clear();
  }

  function toggleSubBoundary(pcode: string): void {
    if (visibleSubBoundaryPcodes.value.has(pcode)) {
      visibleSubBoundaryPcodes.value.delete(pcode);
    } else {
      visibleSubBoundaryPcodes.value.add(pcode);
    }
    // Trigger reactivity
    visibleSubBoundaryPcodes.value = new Set(visibleSubBoundaryPcodes.value);
  }

  function selectAllSubBoundaries(): void {
    subBoundaries.value.forEach(b => visibleSubBoundaryPcodes.value.add(b.pcode));
    visibleSubBoundaryPcodes.value = new Set(visibleSubBoundaryPcodes.value);
  }

  function clearSubBoundaries(): void {
    visibleSubBoundaryPcodes.value.clear();
    visibleSubBoundaryPcodes.value = new Set();
  }

  return {
    activeLevel,
    selectedBoundaryPcode,
    selectedBoundary,
    visibleSubBoundaryPcodes,
    geoJSON,
    isLoading,
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
    loadMapData,
    loadBoundaryLists
  };
});
