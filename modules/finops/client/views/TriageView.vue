<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFindings, triageAction } from '../composables/useFinops.js'
import FindingCard from '../components/FindingCard.vue'

const { findings, loading, error, refresh } = useFindings()
const activeFilter = ref('all')

onMounted(() => { refresh() })

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approve', label: 'Approved' },
  { id: 'defer', label: 'Deferred' },
  { id: 'deny', label: 'Denied' }
]

const filteredFindings = computed(() => {
  if (!findings.value) return []
  const sorted = [...findings.value].sort(
    (a, b) => (b.estimated_weekly_savings_usd || 0) - (a.estimated_weekly_savings_usd || 0)
  )
  if (activeFilter.value === 'all') return sorted
  if (activeFilter.value === 'pending') return sorted.filter(f => !f.triage_status)
  return sorted.filter(f => f.triage_status === activeFilter.value)
})

async function handleAction(id, action, payload) {
  const finding = findings.value.find(f => f.id === id)
  if (finding) finding.triage_status = action

  try {
    await triageAction(id, action, payload)
  } catch {
    if (finding) finding.triage_status = null
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto py-6 px-4 space-y-6">
    <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Triage Findings</h1>

    <!-- Filter tabs -->
    <nav class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit" aria-label="Triage filters">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        @click="activeFilter = f.id"
        class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
        :class="activeFilter === f.id
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
      >{{ f.label }}</button>
    </nav>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else>
      <div v-if="!filteredFindings.length" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
        <template v-if="activeFilter === 'all' || activeFilter === 'pending'">
          All findings triaged. Run the mining pipeline to discover new opportunities.
        </template>
        <template v-else>
          No {{ activeFilter }}d findings.
        </template>
      </div>
      <div v-else class="space-y-3">
        <FindingCard
          v-for="f in filteredFindings"
          :key="f.id"
          :finding="f"
          :on-action="handleAction"
        />
      </div>
    </template>
  </div>
</template>
