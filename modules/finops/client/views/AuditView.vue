<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudit } from '../composables/useFinops.js'

const { audit, loading, error, refresh } = useAudit()
const sortAsc = ref(false)
const expandedId = ref(null)

onMounted(() => { refresh() })

const sortedAudit = computed(() => {
  if (!audit.value?.length) return []
  return [...audit.value].sort((a, b) => {
    const diff = new Date(b.timestamp) - new Date(a.timestamp)
    return sortAsc.value ? -diff : diff
  })
})

const ACTION_COLORS = {
  approve: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  defer: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  deny: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  learn: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
}

const SOURCE_COLORS = {
  mlflow: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  praxis: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  langfuse: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  litellm: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'gcp-billing': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
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

function praxisRule(entry) {
  if (!entry || entry.action !== 'approve' || !entry.finding) return null
  const f = entry.finding
  const model = entry.corrected_model || f.suggested_model
  const provider = entry.corrected_provider || f.suggested_provider || 'anthropic'
  const thinking = entry.corrected_thinking || 'low'
  if (!model) return null
  return {
    id: `finops-${entry.id.slice(0, 8)}`,
    match: { prompt_pattern_hint: f.prompt_pattern },
    route: { path: 'model', provider, model, thinking },
    weight: 0.8,
    _finops_rationale: entry.rationale,
    _finops_source: entry.id
  }
}

function yamlRule(rule) {
  if (!rule) return ''
  return [
    `- id: ${rule.id}`,
    `  match:`,
    `    prompt_pattern_hint: "${rule.match.prompt_pattern_hint}"`,
    `  route:`,
    `    path: ${rule.route.path}`,
    `    provider: ${rule.route.provider}`,
    `    model: ${rule.route.model}`,
    `    thinking: ${rule.route.thinking}`,
    `  weight: ${rule.weight}`,
    `  _finops_rationale: "${rule._finops_rationale}"`,
    `  _finops_source: "${rule._finops_source}"`
  ].join('\n')
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div class="max-w-6xl mx-auto py-6 px-4">
    <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Audit Log</h1>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <div v-else class="space-y-2">
      <div
        v-for="entry in sortedAudit"
        :key="entry.id + entry.timestamp"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <!-- Main row -->
        <div
          class="flex items-start gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
          @click="toggleExpand(entry.id + entry.timestamp)"
        >
          <div class="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
            {{ formatDate(entry.timestamp) }}
          </div>
          <div class="w-20 shrink-0 text-xs text-gray-600 dark:text-gray-300 font-medium pt-0.5">
            {{ shortUser(entry.actor) }}
          </div>
          <div class="w-20 shrink-0">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              :class="ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-600'"
            >{{ entry.action }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-gray-900 dark:text-gray-100 truncate">
                {{ entry.finding?.prompt_pattern || entry.id }}
              </span>
              <span
                v-if="entry.finding?.source"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                :class="SOURCE_COLORS[entry.finding.source] || 'bg-gray-100 text-gray-600'"
              >{{ entry.finding.source }}</span>
              <span
                v-if="entry.finding?.current_model && entry.finding?.suggested_model"
                class="text-xs text-gray-500 dark:text-gray-400 shrink-0"
              >{{ entry.finding.current_model }} → {{ entry.finding.suggested_model }}</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ entry.rationale }}</div>
          </div>
          <div v-if="praxisRule(entry)" class="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 pt-0.5">
            {{ expandedId === entry.id + entry.timestamp ? '▲' : '▼' }} Praxis rule
          </div>
        </div>

        <!-- Praxis routing rule preview (approved only) -->
        <div
          v-if="expandedId === entry.id + entry.timestamp && praxisRule(entry)"
          class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/40"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Praxis routing change staged by this approval</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">value-routing-table.yaml</span>
          </div>
          <pre class="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre leading-relaxed">{{ yamlRule(praxisRule(entry)) }}</pre>
        </div>
      </div>

      <div v-if="!sortedAudit.length" class="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        No audit entries yet. Make triage decisions to build the audit log.
      </div>
    </div>
  </div>
</template>
