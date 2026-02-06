<script setup lang="ts">
import { UploadIcon } from "lucide-vue-next";
import BaseButton from "@/components/common/BaseButton.vue";

const emit = defineEmits<{
  (e: "import"): void;
}>();
</script>

<template>
  <header
    class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-20"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold"
      >
        PH
      </div>
      <h1 class="text-xl font-bold text-gray-900">PhilData</h1>
    </div>

    <div class="flex items-center gap-3">
      <BaseButton variant="primary" size="sm" @click="emit('import')">
        <UploadIcon class="w-4 h-4 mr-2" />
        Import Data
      </BaseButton>
    </div>
  </header>
</template>
