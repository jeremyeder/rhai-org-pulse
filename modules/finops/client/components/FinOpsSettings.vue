<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const loading = ref(true)
const syncing = ref(false)
const syncResult = ref(null)

onMounted(async () => {
  try {
    config.value = await apiRequest('/modules/finops/report')
  } catch {
    // non-critical
  } finally {
    loading.value = false
  }
})

async function triggerSync() {
  syncing.value = true
  syncResult.value = null
  try {
    const result = await apiRequest('/modules/finops/sync', { method: 'POST' })
    syncResult.value = { status: 'success', message: result.message || 'Sync completed' }
  } catch (e) {
    syncResult.value = { status: 'error', message: e.message }
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">FinOps Pipeline</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sync findings from the mining pipeline.</p>
      </div>

      <div class="p-4 space-y-3">
        <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        <template v-else>
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm text-gray-700 dark:text-gray-300">Open findings</span>
              <span class="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ config?.openFindings ?? '--' }}</span>
            </div>
            <button
              @click="triggerSync"
              :disabled="syncing"
              class="px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <template v-if="syncing">
                <svg class="animate-spin -ml-0.5 mr-1.5 h-3 w-3 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </template>
              <template v-else>Sync Now</template>
            </button>
          </div>
          <p v-if="syncResult" class="text-xs" :class="{
            'text-green-600 dark:text-green-400': syncResult.status === 'success',
            'text-red-600 dark:text-red-400': syncResult.status === 'error'
          }">{{ syncResult.message }}</p>
        </template>
      </div>
    </div>
  </div>
</template>
