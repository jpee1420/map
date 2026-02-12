<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: { from: string; to: string } | null;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: { from: string; to: string } | null): void;
}>();

const fromDate = computed({
  get: () => props.modelValue?.from || '',
  set: (val) => updateValue(val, props.modelValue?.to || '')
});

const toDate = computed({
  get: () => props.modelValue?.to || '',
  set: (val) => updateValue(props.modelValue?.from || '', val)
});

function updateValue(from: string, to: string) {
  if (!from && !to) {
    emit('update:modelValue', null);
  } else {
    emit('update:modelValue', { from, to });
  }
}

function setPreset(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  
  updateValue(
    start.toISOString().split('T')[0] || '',
    end.toISOString().split('T')[0] || ''
  );
}

function clear() {
  emit('update:modelValue', null);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="label" class="text-xs font-semibold text-gray-500 uppercase">{{ label }}</div>
    
    <div class="flex items-center gap-2">
      <input
        v-model="fromDate"
        type="date"
        class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="From"
      />
      <span class="text-gray-400">-</span>
      <input
        v-model="toDate"
        type="date"
        class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="To"
      />
    </div>

    <!-- Presets -->
    <div class="flex gap-2 text-xs">
      <button 
        @click="setPreset(7)"
        class="text-blue-600 hover:underline"
      >
        Last 7 days
      </button>
      <button 
        @click="setPreset(30)"
        class="text-blue-600 hover:underline"
      >
        Last 30 days
      </button>
      <button 
        @click="clear"
        class="ml-auto text-gray-400 hover:text-red-500"
      >
        Clear
      </button>
    </div>
  </div>
</template>
