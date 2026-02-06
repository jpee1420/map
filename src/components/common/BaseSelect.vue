<script setup lang="ts">
import { computed } from "vue";

interface Option {
  label: string;
  value: string | number;
}

interface Props {
  modelValue: string | number;
  options: Option[];
  label?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
}>();

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="text-sm font-medium text-gray-700">{{
      label
    }}</label>
    <select
      v-model="value"
      :disabled="disabled"
      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>
