import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ImportedDataset } from '@/types';
import { parseFile } from '@/utils/dataParser';

export const useDataStore = defineStore('data', () => {
  const dataset = ref<ImportedDataset | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function loadData(file: File) {
    isLoading.value = true;
    error.value = null;
    try {
      dataset.value = await parseFile(file);
    } catch (e: any) {
      error.value = e.message || 'Failed to load data';
    } finally {
      isLoading.value = false;
    }
  }

  function clearData() {
    dataset.value = null;
    error.value = null;
  }

  return {
    dataset,
    isLoading,
    error,
    loadData,
    clearData
  };
});
