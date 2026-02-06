<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { XIcon } from "lucide-vue-next";

interface Props {
  modelValue: boolean;
  title?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function close() {
  emit("update:modelValue", false);
}
</script>

<template>
  <TransitionRoot as="template" :show="modelValue">
    <Dialog as="div" class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div
          class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
        >
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
            >
              <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div class="flex items-start justify-between">
                  <DialogTitle
                    as="h3"
                    class="text-base font-semibold leading-6 text-gray-900"
                  >
                    {{ title }}
                  </DialogTitle>
                  <button
                    type="button"
                    class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                    @click="close"
                  >
                    <XIcon class="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div class="mt-3">
                  <slot />
                </div>
              </div>
              <div
                v-if="$slots.footer"
                class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6"
              >
                <slot name="footer" />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
