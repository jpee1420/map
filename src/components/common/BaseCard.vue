<script setup lang="ts">
interface Props {
  title?: string;
  noPadding?: boolean;
}

withDefaults(defineProps<Props>(), {
  noPadding: false,
});
</script>

<template>
  <div
    class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col"
  >
    <div
      v-if="title || $slots.header"
      class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
    >
      <h3 v-if="title" class="text-sm font-semibold text-gray-900">
        {{ title }}
      </h3>
      <slot name="header"></slot>
    </div>
    <div :class="{ 'p-4': !noPadding, 'flex-1': true }">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="bg-gray-50 px-4 py-3 border-t border-gray-100"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
