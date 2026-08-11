<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '--' },
  unit: { type: String, default: '' },
  trend: { type: Object, default: null },
  trendPositive: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ label }}</span>
    <div v-if="loading" class="h-8 flex items-center">
      <div class="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
    <div v-else class="flex items-baseline gap-1.5">
      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        <template v-if="unit === '$'">$</template>{{ value }}<template v-if="unit && unit !== '$'">{{ unit }}</template>
      </span>
      <span
        v-if="trend"
        class="text-sm font-medium flex items-center gap-0.5"
        :class="trendPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
      >
        <svg v-if="trend.direction === 'up'" class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
        <svg v-else class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        {{ trend.value }}
      </span>
    </div>
  </div>
</template>
