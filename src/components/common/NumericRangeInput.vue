<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: { min: number; max: number } | null;
  min?: number;
  max?: number;
  label?: string;
  step?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: { min: number; max: number } | null): void;
}>();

const minValue = computed({
  get: () => props.modelValue?.min ?? props.min ?? 0,
  set: (val) => updateValue(Number(val), props.modelValue?.max ?? props.max ?? 100)
});

const maxValue = computed({
  get: () => props.modelValue?.max ?? props.max ?? 100,
  set: (val) => updateValue(props.modelValue?.min ?? props.min ?? 0, Number(val))
});

function updateValue(min: number, max: number) {
  // Ensure min <= max
  if (min > max) {
    [min, max] = [max, min];
  }
  emit('update:modelValue', { min, max });
}

function clear() {
  emit('update:modelValue', null);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="label" class="flex justify-between items-center">
      <div class="text-xs font-semibold text-gray-500 uppercase">{{ label }}</div>
      <button 
        v-if="modelValue"
        @click="clear"
        class="text-xs text-blue-600 hover:text-red-500"
      >
        Reset
      </button>
    </div>
    
    <div class="flex items-center gap-2">
      <input
        v-model="minValue"
        type="number"
        :min="min"
        :max="maxValue"
        :step="step"
        class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="Min"
      />
      <div class="flex-1 h-1 bg-gray-200 rounded relative mx-2">
        <div 
          class="absolute h-full bg-blue-500 rounded"
          :style="{
            left: `${((minValue - (min ?? 0)) / ((max ?? 100) - (min ?? 0))) * 100}%`,
            right: `${100 - ((maxValue - (min ?? 0)) / ((max ?? 100) - (min ?? 0))) * 100}%`
          }"
        ></div>
      </div>
      <input
        v-model="maxValue"
        type="number"
        :min="minValue"
        :max="max"
        :step="step"
        class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="Max"
      />
    </div>
  </div>
</template>
