import { describe, it, expect, vi } from 'vitest'

const { buildReport } = require('../../server/report')

function makeStorage(files = {}) {
  return {
    readFromStorage: vi.fn(async (path) => {
      if (path in files) return files[path]
      return null
    }),
    listStorageFiles: vi.fn(async (dir) => {
      return Object.keys(files)
        .filter(k => k.startsWith(dir + '/'))
        .map(k => k.replace(dir + '/', ''))
    })
  }
}

describe('buildReport', () => {
  it('returns zeros and empty arrays for empty state', async () => {
    const storage = makeStorage({})
    const report = await buildReport(storage)

    expect(report.totalSpendUsd).toBe(0)
    expect(report.savingsRealizedUsd).toBe(0)
    expect(report.openFindings).toBe(0)
    expect(report.momDelta).toBeNull()
    expect(report.anomalies).toEqual([])
  })

  it('computes totalSpendUsd from billing entries', async () => {
    const storage = makeStorage({
      'finops/billing.json': [
        { model: 'gpt-4', cost_usd: 8000 },
        { model: 'claude-3', cost_usd: 4345.67 }
      ]
    })
    const report = await buildReport(storage)

    expect(report.totalSpendUsd).toBe(12345.67)
  })

  it('sums savingsRealizedUsd only from approved decisions', async () => {
    const decisions = [
      { id: 'f1', action: 'approve', finding: { estimated_weekly_savings_usd: 125 } },
      { id: 'f2', action: 'reject', finding: { estimated_weekly_savings_usd: 300 } },
      { id: 'f3', action: 'approve', finding: { estimated_weekly_savings_usd: 50 } },
      { id: 'f4', action: 'suppress', finding: { estimated_weekly_savings_usd: 100 } }
    ]
    const storage = makeStorage({
      'finops/triage-decisions.json': decisions
    })
    const report = await buildReport(storage)

    expect(report.savingsRealizedUsd).toBe((125 + 50) * 4)
  })

  it('excludes suppressed findings from openFindings count', async () => {
    const findings = [
      { id: 'f1', prompt_pattern: 'a', estimated_weekly_savings_usd: 100 },
      { id: 'f2', prompt_pattern: 'b', estimated_weekly_savings_usd: 200 },
      { id: 'f3', prompt_pattern: 'c', estimated_weekly_savings_usd: 50 }
    ]
    const suppression = { suppressed: ['f2'] }
    const storage = makeStorage({
      'finops/latest.json': findings,
      'finops/suppression.json': suppression
    })
    const report = await buildReport(storage)

    expect(report.openFindings).toBe(2)
  })

  it('returns null momDelta when only one snapshot exists', async () => {
    const storage = makeStorage({
      'finops/snapshots/2026-08-01.json': {
        date: '2026-08-01',
        billing: [{ model: 'gpt-4', cost_usd: 1000 }],
        findings: []
      }
    })
    const report = await buildReport(storage)

    expect(report.momDelta).toBeNull()
  })

  it('flags anomaly when finding savings far exceeds mean', async () => {
    const findings = [
      { id: 'f1', prompt_pattern: 'a', estimated_weekly_savings_usd: 10 },
      { id: 'f2', prompt_pattern: 'b', estimated_weekly_savings_usd: 10 },
      { id: 'f3', prompt_pattern: 'c', estimated_weekly_savings_usd: 10 },
      { id: 'f4', prompt_pattern: 'd', estimated_weekly_savings_usd: 10 },
      { id: 'f5', prompt_pattern: 'e', estimated_weekly_savings_usd: 10 },
      { id: 'f6', prompt_pattern: 'f', estimated_weekly_savings_usd: 10000 }
    ]
    const storage = makeStorage({
      'finops/latest.json': findings
    })
    const report = await buildReport(storage)

    expect(report.anomalies.length).toBeGreaterThan(0)
    expect(report.anomalies[0].id).toBe('f6')
    expect(report.anomalies[0].severity).toBe('high')
  })
})
