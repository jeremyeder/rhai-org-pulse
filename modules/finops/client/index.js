import { defineAsyncComponent } from 'vue'

export const routes = {
  'overview': defineAsyncComponent(() => import('./views/OverviewView.vue')),
  'trends':   defineAsyncComponent(() => import('./views/TrendsView.vue')),
  'triage':   defineAsyncComponent(() => import('./views/TriageView.vue')),
  'audit':    defineAsyncComponent(() => import('./views/AuditView.vue')),
}
