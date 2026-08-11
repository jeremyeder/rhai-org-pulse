<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudit } from '../composables/useFinops.js'

const { audit, loading, error, refresh } = useAudit()
const sortAsc = ref(false)

onMounted(() => { refresh() })

const sortedAudit = computed(() => {
  if (!audit.value?.length) return []
  const sorted = [...audit.value]
  sorted.sort((a, b) => {
    const diff = new Date(b.timestamp) - new Date(a.timestamp)
    return sortAsc.value ? -diff : diff
  })
  return sorted
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
  <div class="max-w-6xl mx-auto py-6 px-4">
    <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Audit Log</h1>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300"
              @click="sortAsc = !sortAsc"
            >
              Time
              <svg class="inline h-3 w-3 ml-0.5" :class="{ 'rotate-180': sortAsc }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Finding</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rationale</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="entry in sortedAudit" :key="entry.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ formatDate(entry.timestamp) }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{{ shortUser(entry.actor) }}</td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="ACTION_COLORS[entry.action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
              >{{ entry.action }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">{{ entry.finding?.prompt_pattern || '--' }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-sm truncate">{{ entry.rationale || '--' }}</td>
          </tr>
          <tr v-if="!sortedAudit.length">
            <td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No audit entries</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
