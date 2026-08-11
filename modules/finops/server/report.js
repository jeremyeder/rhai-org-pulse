async function buildReport(storage) {
  const latest = await storage.readFromStorage('finops/latest.json');
  const billing = await storage.readFromStorage('finops/billing.json');
  const triageDecisions = await storage.readFromStorage('finops/triage-decisions.json') || [];
  const suppression = await storage.readFromStorage('finops/suppression.json') || { suppressed: [] };

  const suppressedIds = new Set(suppression.suppressed || []);
  const actionedIds = new Set(triageDecisions.map(d => d.id));

  const findings = Array.isArray(latest) ? latest : [];
  const billingEntries = Array.isArray(billing) ? billing : [];

  const totalSpendUsd = billingEntries.reduce((sum, b) => sum + (b.cost_usd || 0), 0);

  const openFindings = findings.filter(f =>
    !suppressedIds.has(f.id) && !actionedIds.has(f.id)
  ).length;

  const savingsRealizedUsd = triageDecisions
    .filter(d => d.action === 'approve')
    .reduce((sum, d) => sum + ((d.finding && d.finding.estimated_weekly_savings_usd) || 0) * 4, 0);

  const spendByModel = billingEntries.map(b => ({
    model: b.model,
    cost_usd: b.cost_usd
  }));

  let snapshots = [];
  try {
    const files = await storage.listStorageFiles('finops/snapshots');
    if (files && files.length > 0) {
      for (const fileName of files) {
        const snap = await storage.readFromStorage(`finops/snapshots/${fileName}`);
        if (snap) snapshots.push(snap);
      }
    }
  } catch {
    // No snapshots directory yet
  }

  snapshots.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let momDelta = null;
  if (snapshots.length >= 2) {
    const current = snapshots[snapshots.length - 1];
    const prior = snapshots[snapshots.length - 2];
    const currentTotal = (current.billing || []).reduce((s, b) => s + (b.cost_usd || 0), 0);
    const priorTotal = (prior.billing || []).reduce((s, b) => s + (b.cost_usd || 0), 0);
    if (priorTotal > 0) {
      momDelta = ((currentTotal - priorTotal) / priorTotal) * 100;
    }
  }

  const spendTrend = snapshots.map(s => ({
    date: s.date,
    total_cost_usd: (s.billing || []).reduce((sum, b) => sum + (b.cost_usd || 0), 0)
  }));

  // Per-snapshot model breakdown for stacked bar chart
  const spendByModelOverTime = snapshots.map(s => ({
    date: s.date,
    models: (s.billing || []).reduce((acc, b) => {
      acc[b.model] = (acc[b.model] || 0) + (b.cost_usd || 0);
      return acc;
    }, {})
  }));

  // Approved decisions with date + label for spend chart annotations
  const approvals = triageDecisions
    .filter(d => d.action === 'approve')
    .map(d => ({
      date: d.timestamp ? d.timestamp.slice(0, 10) : null,
      label: d.finding
        ? `${d.finding.current_model} → ${d.finding.suggested_model}`
        : 'Routing change',
      prompt_pattern: d.finding ? d.finding.prompt_pattern : '',
      savings_usd: d.finding ? d.finding.estimated_weekly_savings_usd : 0
    }))
    .filter(a => a.date);

  // Recommended vs applied savings per snapshot
  const savingsOverTime = snapshots.map(s => {
    const totalRecommendedUsd = (Array.isArray(s.findings) ? s.findings : [])
      .reduce((sum, f) => sum + (f.estimated_weekly_savings_usd || 0), 0);
    const approvedUsd = triageDecisions
      .filter(d => d.action === 'approve' && d.timestamp && d.timestamp.slice(0, 10) <= s.date)
      .reduce((sum, d) => sum + ((d.finding && d.finding.estimated_weekly_savings_usd) || 0) * 4, 0);
    return { date: s.date, totalRecommendedUsd, approvedUsd };
  });

  const anomalies = computeAnomalies(findings);

  return {
    totalSpendUsd,
    momDelta,
    savingsRealizedUsd,
    openFindings,
    spendByModel,
    spendTrend,
    spendByModelOverTime,
    approvals,
    savingsOverTime,
    anomalies
  };
}

function computeAnomalies(findings) {
  if (!findings || findings.length === 0) return [];

  const savings = findings.map(f => f.estimated_weekly_savings_usd || 0);
  const mean = savings.reduce((a, b) => a + b, 0) / savings.length;
  const variance = savings.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / savings.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + 2 * stddev;

  return findings
    .filter(f => (f.estimated_weekly_savings_usd || 0) > threshold)
    .map(f => ({
      id: f.id,
      prompt_pattern: f.prompt_pattern,
      savings: f.estimated_weekly_savings_usd,
      severity: 'high'
    }));
}

module.exports = { buildReport };
