<script setup>
import { onMounted, computed } from 'vue'
import { useReport, useAudit } from '../composables/useFinops.js'
import KpiTile from '../components/KpiTile.vue'

const { report, loading: reportLoading, error: reportError, refresh: loadReport } = useReport()
const { audit, loading: auditLoading, refresh: loadAudit } = useAudit()

onMounted(() => {
  loadReport()
  loadAudit()
})

const recentDecisions = computed(() => {
  if (!audit.value?.length) return []
  return [...audit.value].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 3)
})

const momTrend = computed(() => {
  if (!report.value || report.value.momDelta == null) return null
  const val = report.value.momDelta
  return {
    direction: val <= 0 ? 'down' : 'up',
    value: Math.abs(val).toFixed(1) + '%'
  }
})

const ACTION_COLORS = {
  approve: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  defer: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  deny: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  learn: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

function shortUser(email) {
  if (!email) return 'System'
  const at = email.indexOf('@')
  return at > 0 ? email.substring(0, at) : email
}
</script>

<template>
  <div class="max-w-6xl mx-auto py-6 px-4 space-y-6">
    <!-- Loading -->
    <div v-if="reportLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>

    <!-- Error -->
    <div v-else-if="reportError" class="text-sm text-red-600 dark:text-red-400">{{ reportError }}</div>

    <template v-else-if="report">
      <!-- KPI Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Total Spend"
          :value="report.totalSpendUsd?.toFixed(2)"
          unit="$"
          :trend="momTrend"
          :trend-positive="report.momDelta <= 0"
          :loading="reportLoading"
        />
        <KpiTile
          label="MoM Change"
          :value="report.momDelta == null ? '—' : (report.momDelta >= 0 ? '+' : '') + report.momDelta.toFixed(1) + '%'"
          :loading="reportLoading"
        />
        <KpiTile
          label="Savings Realized"
          :value="report.savingsRealizedUsd?.toFixed(2)"
          unit="$"
          :loading="reportLoading"
        />
        <KpiTile
          label="Open Findings"
          :value="report.openFindings"
          :loading="reportLoading"
        />
      </div>

      <!-- Anomaly alerts -->
      <div v-if="report.anomalies?.length" class="rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-4">
        <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Anomalies Detected</h3>
        <ul class="space-y-1">
          <li v-for="a in report.anomalies" :key="a.id" class="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="a.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'"
            >{{ a.severity }}</span>
            <span class="truncate">{{ a.prompt_pattern }}</span>
            <span class="font-medium ml-auto shrink-0">${{ a.savings?.toFixed(2) }}</span>
          </li>
        </ul>
      </div>

      <!-- Recent triage activity -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Triage Activity</h3>
        </div>
        <div v-if="auditLoading" class="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        <div v-else-if="!recentDecisions.length" class="p-4 text-sm text-gray-400 dark:text-gray-500">No triage activity yet.</div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/50">
          <div v-for="d in recentDecisions" :key="d.id" class="px-4 py-3 flex items-center gap-3">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              :class="ACTION_COLORS[d.action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
            >{{ d.action }}</span>
            <span class="text-sm text-gray-900 dark:text-gray-100 truncate flex-1">{{ d.finding?.prompt_pattern || '--' }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ shortUser(d.actor) }} · {{ formatDate(d.timestamp) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
