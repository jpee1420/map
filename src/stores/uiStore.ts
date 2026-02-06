import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TabConfig } from '@/types';

export const useUIStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false);
  const tabs = ref<TabConfig[]>([
    {
      id: 'tab-1',
      name: 'Map View',
      type: 'map',
      filters: [],
      pivotFields: []
    }
  ]);
  const activeTabId = ref('tab-1');

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function addTab(tab: TabConfig) {
    tabs.value.push(tab);
    activeTabId.value = tab.id;
  }

  function removeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id);
    if (index > -1 && tabs.value.length > 1) {
      tabs.value.splice(index, 1);
      if (activeTabId.value === id) {
        const nextTab = tabs.value[Math.max(0, index - 1)];
        if (nextTab) {
          activeTabId.value = nextTab.id;
        }
      }
    }
  }

  function reorderTabs(newTabs: TabConfig[]) {
    tabs.value = newTabs;
  }

  function updateTabName(id: string, name: string) {
    const tab = tabs.value.find(t => t.id === id);
    if (tab) {
      tab.name = name;
    }
  }

  return {
    sidebarCollapsed,
    tabs,
    activeTabId,
    toggleSidebar,
    addTab,
    removeTab,
    reorderTabs,
    updateTabName
  };
});
