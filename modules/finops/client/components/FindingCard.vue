<script setup>
import { ref } from 'vue'

const props = defineProps({
  finding: { type: Object, required: true },
  onAction: { type: Function, required: true }
})

const expanded = ref(false)
const showForm = ref(null)
const rationale = ref('')
const correctedModel = ref('')
const correctedProvider = ref('')
const correctedThinking = ref('')
const submitting = ref(false)

const EFFORT_COLORS = {
  low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
}

const ACTION_COLORS = {
  approve: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  defer: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  deny: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  learn: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
}

function openForm(action) {
  showForm.value = action
  rationale.value = ''
  correctedModel.value = ''
  correctedProvider.value = ''
  correctedThinking.value = ''
}

function cancelForm() {
  showForm.value = null
}

async function submitAction() {
  submitting.value = true
  const payload = { rationale: rationale.value }
  if (showForm.value === 'learn') {
    if (correctedModel.value) payload.corrected_model = correctedModel.value
    if (correctedProvider.value) payload.corrected_provider = correctedProvider.value
    if (correctedThinking.value) payload.corrected_thinking = correctedThinking.value
  }
  try {
    await props.onAction(props.finding.id, showForm.value, payload)
    showForm.value = null
  } finally {
    submitting.value = false
  }
}

function truncate(str, len = 60) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <!-- Row 1: rank, prompt, source, type -->
    <div class="flex items-start gap-3">
      <span class="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">
        {{ finding.rank }}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" :title="finding.prompt_pattern">
          {{ truncate(finding.prompt_pattern) }}
        </p>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {{ finding.source }}
          </span>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
            {{ finding.opportunity_type }}
          </span>
        </div>
      </div>
    </div>

    <!-- Row 2: model change, savings, effort -->
    <div class="flex items-center gap-4 mt-3 flex-wrap text-sm">
      <span class="text-gray-600 dark:text-gray-400">
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ finding.current_model }}</span>
        <svg class="inline h-3.5 w-3.5 mx-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span class="font-medium text-green-600 dark:text-green-400">{{ finding.suggested_model }}</span>
      </span>
      <span class="font-semibold text-green-600 dark:text-green-400">${{ finding.estimated_weekly_savings_usd?.toFixed(2) }}/wk</span>
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        :class="EFFORT_COLORS[finding.effort_level] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
      >{{ finding.effort_level }}</span>
    </div>

    <!-- CLEARS flags -->
    <div v-if="finding.clears_flags" class="flex gap-1.5 mt-2 flex-wrap">
      <span
        v-for="(val, key) in finding.clears_flags"
        :key="key"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
        :class="val ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'"
      >{{ key }}: {{ val ? 'pass' : 'fail' }}</span>
    </div>

    <!-- Rationale (expandable) -->
    <div v-if="finding.rationale" class="mt-2">
      <button
        @click="expanded = !expanded"
        class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
      >{{ expanded ? 'Hide' : 'Show' }} rationale</button>
      <p v-if="expanded" class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ finding.rationale }}</p>
    </div>

    <!-- Triaged badge or action buttons -->
    <div class="mt-3">
      <div v-if="finding.triage_status" class="flex items-center gap-2">
        <span
          class="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium"
          :class="ACTION_COLORS[finding.triage_status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
        >{{ finding.triage_status }}</span>
      </div>
      <div v-else-if="!showForm" class="flex gap-2 flex-wrap">
        <button @click="openForm('approve')" class="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
        <button @click="openForm('defer')" class="px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-500 text-white hover:bg-yellow-600">Defer</button>
        <button @click="openForm('deny')" class="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700">Deny</button>
        <button @click="openForm('learn')" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700">Learn</button>
      </div>

      <!-- Inline triage form -->
      <div v-if="showForm" class="mt-2 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Rationale{{ showForm === 'approve' || showForm === 'learn' ? ' (required)' : '' }}
          </label>
          <textarea
            v-model="rationale"
            rows="2"
            class="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Why this decision?"
          />
        </div>
        <template v-if="showForm === 'learn'">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Corrected model</label>
            <input v-model="correctedModel" type="text" class="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Corrected provider</label>
            <input v-model="correctedProvider" type="text" class="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Corrected thinking</label>
            <textarea v-model="correctedThinking" rows="2" class="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </template>
        <div class="flex gap-2">
          <button
            @click="submitAction"
            :disabled="submitting || ((showForm === 'approve' || showForm === 'learn') && !rationale.trim())"
            class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ submitting ? 'Submitting...' : 'Submit' }}</button>
          <button @click="cancelForm" class="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
