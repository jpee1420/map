<script setup lang="ts">
import { ref } from "vue";
import { useDataStore } from "@/stores/dataStore";
import AppHeader from "@/components/layout/AppHeader.vue";
import Sidebar from "@/components/layout/Sidebar.vue";
import TabContainer from "@/components/layout/TabContainer.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GoogleSheetsImport from "@/components/common/GoogleSheetsImport.vue";
import { FileSpreadsheetIcon, CloudIcon } from "lucide-vue-next";

const dataStore = useDataStore();
const showImportModal = ref(false);
const importMode = ref<'file' | 'sheets'>('file');

function handleImportRequest(): void {
  showImportModal.value = true;
}

function handleFileImport(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx, .xls, .csv";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      dataStore.loadData(file);
      showImportModal.value = false;
    }
  };
  input.click();
}
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
    <AppHeader @import="handleImportRequest" />

    <div class="flex flex-1 overflow-hidden relative">
      <Sidebar />

      <main class="flex-1 flex flex-col overflow-hidden">
        <TabContainer />
      </main>
    </div>

    <!-- Import Modal -->
    <BaseModal 
      v-model="showImportModal" 
      title="Import Data"
    >
      <div class="space-y-4">
        <!-- Import Mode Tabs -->
        <div class="flex border-b border-gray-200">
          <button
            @click="importMode = 'file'"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            :class="importMode === 'file' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            <FileSpreadsheetIcon class="w-4 h-4" />
            File Upload
          </button>
          <button
            @click="importMode = 'sheets'"
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            :class="importMode === 'sheets' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            <CloudIcon class="w-4 h-4" />
            Google Sheets
          </button>
        </div>

        <!-- File Upload -->
        <div v-if="importMode === 'file'" class="space-y-4">
          <p class="text-sm text-gray-600">
            Upload an Excel file (.xlsx, .xls) or CSV file to import data.
          </p>
          <button
            @click="handleFileImport"
            class="w-full flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <FileSpreadsheetIcon class="w-6 h-6 text-gray-400" />
            <span class="text-gray-600">Click to select file</span>
          </button>
        </div>

        <!-- Google Sheets -->
        <div v-else>
          <p class="text-sm text-gray-600 mb-4">
            Connect to a public Google Sheets document to import live data.
          </p>
          <GoogleSheetsImport />
        </div>
      </div>
    </BaseModal>
  </div>
</template>
