import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const findings = ref([])
const findingsLoading = ref(false)
const findingsError = ref(null)

const report = ref(null)
const reportLoading = ref(false)
const reportError = ref(null)

const audit = ref([])
const auditLoading = ref(false)
const auditError = ref(null)

async function loadFindings() {
  findingsLoading.value = true
  findingsError.value = null
  try {
    findings.value = await apiRequest('/modules/finops/findings')
  } catch (e) {
    findingsError.value = e.message
  } finally {
    findingsLoading.value = false
  }
}

async function loadReport() {
  reportLoading.value = true
  reportError.value = null
  try {
    report.value = await apiRequest('/modules/finops/report')
  } catch (e) {
    reportError.value = e.message
  } finally {
    reportLoading.value = false
  }
}

async function loadAudit() {
  auditLoading.value = true
  auditError.value = null
  try {
    audit.value = await apiRequest('/modules/finops/audit')
  } catch (e) {
    auditError.value = e.message
  } finally {
    auditLoading.value = false
  }
}

async function triageAction(id, action, payload = {}) {
  return apiRequest(`/modules/finops/triage/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
}

export function useFindings() {
  return { findings, loading: findingsLoading, error: findingsError, refresh: loadFindings }
}

export function useReport() {
  return { report, loading: reportLoading, error: reportError, refresh: loadReport }
}

export function useAudit() {
  return { audit, loading: auditLoading, error: auditError, refresh: loadAudit }
}

export { triageAction }
