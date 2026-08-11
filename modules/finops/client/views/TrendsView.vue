<script setup>
import { computed, onMounted } from 'vue'
import { useReport } from '../composables/useFinops.js'
import SpendChart from '../components/SpendChart.vue'

const { report, loading, error, refresh } = useReport()

onMounted(() => { refresh() })

const modelKeys = computed(() => {
  const keys = new Set()
  ;(report.value?.spendByModelOverTime || []).forEach(s => {
    Object.keys(s.models || {}).forEach(k => keys.add(k))
  })
  return [...keys].sort()
})

const savingsDatasets = computed(() => {
  const rows = report.value?.savingsOverTime || []
  return [
    {
      label: 'Recommended ($/mo)',
      data: rows.map(r => +(r.totalRecommendedUsd * 4).toFixed(2)),
      color: '#6366f1',
      fill: false
    },
    {
      label: 'Applied ($/mo)',
      data: rows.map(r => +r.approvedUsd.toFixed(2)),
      color: '#10b981',
      fill: false,
      stepped: true
    }
  ]
})

const hasData = computed(() => report.value && (
  (report.value.spendTrend?.length > 0) ||
  (report.value.spendByModel?.length > 0)
))
</script>

<template>
  <div class="max-w-6xl mx-auto py-6 px-4 space-y-6">
    <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Spend Trends</h1>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else-if="report">
      <div v-if="!hasData" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
        No historical data available yet. Run the mining pipeline to start collecting spend data.
      </div>
      <template v-else>

        <!-- Row 1: Spend over time + model distribution stacked bar -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spend Over Time</h3>
            <SpendChart
              :data="report.spendTrend || []"
              x-key="date"
              y-key="total_cost_usd"
              type="line"
              :loading="loading"
            />
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Distribution Over Time</h3>
            <SpendChart
              :data="report.spendByModelOverTime || []"
              x-key="date"
              :stacked-keys="modelKeys"
              type="bar"
              :loading="loading"
              :show-legend="true"
            />
          </div>
        </div>

        <!-- Row 2: Savings recommended vs applied -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Savings: Recommended vs Applied ($/mo)</h3>
          <SpendChart
            :data="report.savingsOverTime || []"
            x-key="date"
            :datasets="savingsDatasets"
            type="line"
            :loading="loading"
            :show-legend="true"
          />
        </div>

        <!-- Row 3: Current spend by model -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Week Spend by Model</h3>
          <SpendChart
            :data="report.spendByModel || []"
            x-key="model"
            y-key="cost_usd"
            type="bar"
            :loading="loading"
          />
        </div>

      </template>
    </template>
  </div>
</template>
