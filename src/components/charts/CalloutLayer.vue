<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { EChartsType } from "echarts";
import { calculateCentroid } from "@/utils/geoUtils";

interface BreakdownEntry {
  label: string;
  value: number;
  percentage: number;
}

interface CalloutItem {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  value: number | string;
  globalPercentage: number;
  metricEntries: Array<{ key: string; val: string }>;
  breakdownDimension?: string;
  breakdowns?: BreakdownEntry[];
  pinned: boolean;
}

interface GeoFeature {
  properties: Record<string, unknown>;
  geometry: unknown;
}

const props = defineProps<{
  chartInstance: EChartsType;
  geoData: { features: GeoFeature[] } | unknown;
  mapData: Array<Record<string, unknown>>;
}>();

const callouts = ref<CalloutItem[]>([]);

// Centroid cache keyed by boundary name
const centroidCache = new Map<string, [number, number]>();

// Drag state
const dragState = ref<{
  active: boolean;
  itemId: string | null;
  offsetX: number;
  offsetY: number;
}>({ active: false, itemId: null, offsetX: 0, offsetY: 0 });

// Layout constants
const CARD_W = 200;
const CARD_H_BASE = 56;
const CARD_H_BREAKDOWN_ROW = 16;
const GAP = 12;
const LEADER_LEN = 36;

// ─── Helpers ───────────────────────────────────────────────────

function getCardHeight(item: CalloutItem): number {
  if (item.breakdowns && item.breakdowns.length > 0) {
    // Header + overall row + breakdown rows
    return 44 + (item.breakdowns.length + 1) * CARD_H_BREAKDOWN_ROW;
  }
  return CARD_H_BASE;
}

function buildCentroidCache(): void {
  centroidCache.clear();
  const geo = props.geoData as { features?: GeoFeature[] } | null;
  if (!geo?.features) return;

  for (const feature of geo.features) {
    const name = feature.properties.name as string | undefined;
    if (!name) continue;
    const center = calculateCentroid(feature.geometry);
    if (center) centroidCache.set(name, center);
  }
}

function extractMetrics(row: Record<string, unknown>): Array<{ key: string; val: string }> {
  const entries: Array<{ key: string; val: string }> = [];
  for (const [key, val] of Object.entries(row)) {
    if (key === "name" || key === "value") continue;
    if (typeof val === "number" && !isNaN(val)) {
      entries.push({ key, val: val.toLocaleString() });
    }
  }
  return entries;
}

// ─── Collision Force ───────────────────────────────────────────

function applyCollisionForce(items: CalloutItem[], viewW: number, viewH: number): void {
  const passes = 8;
  const strength = 0.4;

  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;

        if (a.pinned && b.pinned) continue;

        const hA = getCardHeight(a);
        const hB = getCardHeight(b);
        const avgH = (hA + hB) / 2;

        const overlapX = CARD_W + GAP - Math.abs(a.x - b.x);
        const overlapY = avgH + GAP - Math.abs(a.y - b.y);

        if (overlapX > 0 && overlapY > 0) {
          const dx = (a.x - b.x) || 1;
          const dy = (a.y - b.y) || 1;
          const pushX = (overlapX / 2) * Math.sign(dx) * strength;
          const pushY = (overlapY / 2) * Math.sign(dy) * strength;

          if (!a.pinned && !b.pinned) {
            a.x += pushX;
            a.y += pushY;
            b.x -= pushX;
            b.y -= pushY;
          } else if (!a.pinned) {
            a.x += pushX * 2;
            a.y += pushY * 2;
          } else {
            b.x -= pushX * 2;
            b.y -= pushY * 2;
          }
        }
      }
    }

    for (const item of items) {
      if (item.pinned) continue;
      item.x = Math.max(GAP, Math.min(viewW - CARD_W - GAP, item.x));
      item.y = Math.max(GAP, Math.min(viewH - getCardHeight(item) - GAP, item.y));
    }
  }
}

// ─── Update Callouts ───────────────────────────────────────────

function updateCallouts(): void {
  // Calculate global total for percentage distribution
  const globalTotal = props.mapData.reduce((sum, row) => {
    const val = row.value as number | string;
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);

  if (!props.chartInstance || props.chartInstance.isDisposed?.()) {
    callouts.value = [];
    return;
  }

  const viewW = props.chartInstance.getWidth();
  const viewH = props.chartInstance.getHeight();

  // Preserve pinned positions
  const pinnedPositions = new Map<string, { x: number; y: number }>();
  for (const c of callouts.value) {
    if (c.pinned) pinnedPositions.set(c.id, { x: c.x, y: c.y });
  }

  const items: CalloutItem[] = [];

  for (const row of props.mapData) {
    const name = row.name as string | undefined;
    if (!name) continue;

    const center = centroidCache.get(name);
    if (!center) continue;

    const pixel = props.chartInstance.convertToPixel("geo", center);
    if (!pixel || !Array.isArray(pixel) || pixel.length < 2) continue;

    const px = pixel[0] as number;
    const py = pixel[1] as number;

    if (px < -80 || px > viewW + 80 || py < -80 || py > viewH + 80) continue;

    const wasPinned = pinnedPositions.has(name);
    const pinnedPos = pinnedPositions.get(name);

    // Extract breakdown data from the row if present
    const breakdowns = row.breakdowns as BreakdownEntry[] | undefined;
    const breakdownDimension = row.breakdownDimension as string | undefined;

    const numValue = typeof row.value === 'number' ? row.value : 0;
    const globalPercentage = globalTotal > 0 
      ? Math.round((numValue / globalTotal) * 1000) / 10
      : 0;

    items.push({
      id: name,
      name,
      x: wasPinned ? pinnedPos!.x : px + LEADER_LEN,
      y: wasPinned ? pinnedPos!.y : py - LEADER_LEN,
      targetX: px,
      targetY: py,
      value: row.value as number | string,
      globalPercentage,
      metricEntries: breakdowns ? [] : extractMetrics(row),
      breakdownDimension,
      breakdowns,
      pinned: wasPinned,
    });
  }

  applyCollisionForce(items, viewW, viewH);
  callouts.value = items;
}

// ─── Drag Handlers ─────────────────────────────────────────────

function onPointerDown(event: PointerEvent, itemId: string): void {
  const item = callouts.value.find((c) => c.id === itemId);
  if (!item) return;

  event.preventDefault();
  (event.target as HTMLElement).setPointerCapture(event.pointerId);

  dragState.value = {
    active: true,
    itemId,
    offsetX: event.clientX - item.x,
    offsetY: event.clientY - item.y,
  };
}

function onPointerMove(event: PointerEvent): void {
  if (!dragState.value.active || !dragState.value.itemId) return;
  const item = callouts.value.find((c) => c.id === dragState.value.itemId);
  if (!item) return;

  item.x = event.clientX - dragState.value.offsetX;
  item.y = event.clientY - dragState.value.offsetY;
  item.pinned = true;
}

function onPointerUp(): void {
  dragState.value = { active: false, itemId: null, offsetX: 0, offsetY: 0 };
}

// ─── Debounced Update ──────────────────────────────────────────

let rafTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedUpdate(): void {
  if (rafTimer) clearTimeout(rafTimer);
  rafTimer = setTimeout(() => {
    requestAnimationFrame(updateCallouts);
  }, 16);
}

// ─── Lifecycle ─────────────────────────────────────────────────

onMounted(() => {
  buildCentroidCache();
  props.chartInstance.on("georoam", debouncedUpdate);
  props.chartInstance.on("resize", debouncedUpdate);
  updateCallouts();

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
});

onUnmounted(() => {
  if (!props.chartInstance.isDisposed?.()) {
    props.chartInstance.off("georoam", debouncedUpdate);
    props.chartInstance.off("resize", debouncedUpdate);
  }
  if (rafTimer) clearTimeout(rafTimer);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
});

watch(() => props.mapData, updateCallouts, { deep: true });
watch(
  () => props.geoData,
  () => {
    buildCentroidCache();
    updateCallouts();
  },
);
</script>

<template>
  <div class="absolute inset-0 pointer-events-none overflow-hidden">
    <!-- SVG Leader Lines -->
    <svg class="absolute inset-0 w-full h-full">
      <defs>
        <marker id="callout-dot" markerWidth="8" markerHeight="8" refX="4" refY="4">
          <circle cx="4" cy="4" r="3" fill="#3b82f6" opacity="0.85" />
        </marker>
      </defs>
      <line
        v-for="c in callouts"
        :key="`line-${c.id}`"
        :x1="c.targetX"
        :y1="c.targetY"
        :x2="c.x + 4"
        :y2="c.y + getCardHeight(c) / 2"
        stroke="#3b82f6"
        stroke-width="1.5"
        stroke-dasharray="4 3"
        stroke-opacity="0.5"
        marker-start="url(#callout-dot)"
      />
    </svg>

    <!-- Callout Cards -->
    <div
      v-for="c in callouts"
      :key="`card-${c.id}`"
      class="callout-card"
      :class="{
        'callout-card--pinned': c.pinned,
        'callout-card--dragging': dragState.active && dragState.itemId === c.id,
      }"
      :style="{
        left: `${c.x}px`,
        top: `${c.y}px`,
      }"
      @pointerdown="onPointerDown($event, c.id)"
    >
      <!-- Boundary Name -->
      <div class="callout-name">
        <span class="callout-name-text">{{ c.name }}</span>
        <span v-if="c.pinned" class="callout-pin" title="Pinned (drag to reposition)">📌</span>
      </div>

      <!-- Multi-Dimension: Breakdown View -->
      <template v-if="c.breakdowns && c.breakdowns.length > 0">
        <!-- Overall total with global percentage -->
        <div class="callout-overall">
          <span class="overall-label">{{ c.breakdownDimension }}</span>
          <span class="overall-value-blue">
            {{ typeof c.value === 'number' ? c.value.toLocaleString() : c.value }} ({{ c.globalPercentage }}%)
          </span>
        </div>
        <!-- Individual breakdown rows -->
        <div class="callout-breakdowns">
          <div v-for="bd in c.breakdowns" :key="bd.label" class="breakdown-row">
            <span class="breakdown-label">{{ bd.label }}</span>
            <span class="breakdown-value">{{ bd.value.toLocaleString() }}</span>
            <span class="breakdown-pct">({{ bd.percentage }}%)</span>
          </div>
        </div>
      </template>

      <!-- Single-Dimension: Simple Metrics -->
      <template v-else-if="c.metricEntries.length > 0">
        <div class="callout-metrics">
          <div v-for="m in c.metricEntries" :key="m.key" class="callout-metric-row">
            <span class="metric-label">{{ m.key }}</span>
            <span class="metric-value">{{ m.val }}</span>
          </div>
        </div>
      </template>

      <div v-else class="callout-no-data">No data</div>
    </div>
  </div>
</template>

<style scoped>
.callout-card {
  position: absolute;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(6px);
  border: 1px solid #93c5fd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 6px 10px;
  pointer-events: auto;
  cursor: grab;
  font-size: 11px;
  line-height: 1.3;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  user-select: none;
  touch-action: none;
  width: auto;
  min-width: 120px;
  max-width: 200px;
}

.callout-card:hover {
  z-index: 50;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.18), 0 2px 4px rgba(0, 0, 0, 0.06);
  border-color: #3b82f6;
}

.callout-card--pinned {
  border-color: #60a5fa;
}

.callout-card--dragging {
  cursor: grabbing;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);
  border-color: #2563eb;
  opacity: 0.92;
}

/* ─── Header ─── */
.callout-name {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.callout-name-text {
  font-weight: 700;
  font-size: 12px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.callout-pin {
  font-size: 9px;
  flex-shrink: 0;
}

/* ─── Breakdown (Multi-Dimension) ─── */
.callout-overall {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 3px;
}

.overall-label {
  color: #1f2937;
  font-weight: 700;
  font-size: 10px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.overall-value-blue {
  font-weight: 700;
  color: #2563eb;
  font-size: 12px;
  white-space: nowrap;
}

.callout-breakdowns {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.breakdown-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding-left: 6px;
}

.breakdown-label {
  color: #6b7280;
  font-size: 10px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breakdown-value {
  font-weight: 600;
  color: #2563eb;
  font-size: 11px;
  white-space: nowrap;
}

.breakdown-pct {
  color: #9ca3af;
  font-size: 9px;
  white-space: nowrap;
}

/* ─── Simple Metrics (Single-Dimension) ─── */
.callout-metrics {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.callout-metric-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}

.metric-label {
  color: #6b7280;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 65%;
}

.metric-value {
  font-weight: 700;
  color: #2563eb;
  font-size: 12px;
  white-space: nowrap;
}

.callout-no-data {
  color: #9ca3af;
  font-style: italic;
  font-size: 10px;
}
</style>
