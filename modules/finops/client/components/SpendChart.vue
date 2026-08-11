<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const props = defineProps({
  data: { type: Array, default: () => [] },
  xKey: { type: String, required: true },
  yKey: { type: String, default: '' },
  datasets: { type: Array, default: null },
  stackedKeys: { type: Array, default: null },
  label: { type: String, default: '' },
  type: { type: String, default: 'line' },
  loading: { type: Boolean, default: false },
  showLegend: { type: Boolean, default: false }
})

const isDark = ref(false)
let observer = null
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  observer = new MutationObserver(() => { isDark.value = document.documentElement.classList.contains('dark') })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => { if (observer) observer.disconnect() })

const textColor = computed(() => isDark.value ? 'rgba(209,213,219,1)' : 'rgba(107,114,128,1)')
const gridColor = computed(() => isDark.value ? 'rgba(75,85,99,0.5)' : 'rgba(229,231,235,1)')

const chartData = computed(() => {
  const labels = props.data.map(d => d[props.xKey])

  if (props.datasets) {
    return {
      labels,
      datasets: props.datasets.map((ds, i) => ({
        label: ds.label || '',
        data: ds.data,
        borderColor: ds.color || PALETTE[i % PALETTE.length],
        backgroundColor: (ds.color || PALETTE[i % PALETTE.length]) + '20',
        fill: !!ds.fill,
        tension: 0.3,
        stepped: ds.stepped || false,
        pointRadius: 3
      }))
    }
  }

  if (props.stackedKeys && props.stackedKeys.length) {
    return {
      labels,
      datasets: props.stackedKeys.map((key, i) => ({
        label: key,
        data: props.data.map(d => (d.models && d.models[key]) || 0),
        backgroundColor: PALETTE[i % PALETTE.length] + 'cc',
        stack: 'spend'
      }))
    }
  }

  return {
    labels,
    datasets: [{
      label: props.label,
      data: props.data.map(d => d[props.yKey]),
      borderColor: '#6366f1',
      backgroundColor: props.type === 'line' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.6)',
      fill: props.type === 'line',
      tension: 0.3
    }]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: props.showLegend, labels: { color: textColor.value, boxWidth: 12, font: { size: 11 } } }
  },
  scales: {
    x: {
      stacked: !!(props.stackedKeys && props.stackedKeys.length),
      ticks: { font: { size: 10 }, color: textColor.value },
      grid: { color: gridColor.value }
    },
    y: {
      stacked: !!(props.stackedKeys && props.stackedKeys.length),
      beginAtZero: true,
      ticks: { font: { size: 10 }, color: textColor.value },
      grid: { color: gridColor.value }
    }
  }
}))

const chartComponent = computed(() => props.type === 'bar' ? Bar : Line)
</script>

<template>
  <div>
    <div v-if="loading" class="h-[220px] flex items-center justify-center">
      <div class="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
    <div v-else-if="!data || data.length === 0" class="h-[220px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      No data available
    </div>
    <div v-else class="h-[220px]">
      <component :is="chartComponent" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
