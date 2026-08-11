const { sync } = require('./github-sync');
const { buildReport } = require('./report');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context;

  /**
   * @openapi
   * /api/modules/finops/findings:
   *   get:
   *     tags: [FinOps]
   *     summary: List ranked findings with triage status overlay
   *     description: Returns latest findings, excludes suppressed IDs, overlays triage decision status
   *     responses:
   *       200:
   *         description: Array of scored opportunities with triage status
   */
  router.get('/findings', requireAuth, async function(req, res) {
    try {
      const latest = await storage.readFromStorage('finops/latest.json') || [];
      const triageDecisions = await storage.readFromStorage('finops/triage-decisions.json') || [];
      const suppression = await storage.readFromStorage('finops/suppression.json') || { suppressed: [] };

      const suppressedIds = new Set(suppression.suppressed || []);
      const decisionMap = {};
      for (const d of triageDecisions) {
        decisionMap[d.id] = d;
      }

      const findings = (Array.isArray(latest) ? latest : [])
        .filter(f => !suppressedIds.has(f.id))
        .map(f => ({
          ...f,
          triageStatus: decisionMap[f.id] ? decisionMap[f.id].action : null,
          triageRationale: decisionMap[f.id] ? decisionMap[f.id].rationale : null
        }));

      res.json(findings);
    } catch (err) {
      console.error('[finops] Error loading findings:', err.message);
      res.status(500).json({ error: 'Failed to load findings' });
    }
  });

  /**
   * @openapi
   * /api/modules/finops/report:
   *   get:
   *     tags: [FinOps]
   *     summary: Aggregated cost report with trends and anomalies
   *     description: Returns spend totals, MoM delta, savings realized, finding velocity, spend trends, and anomalies
   *     responses:
   *       200:
   *         description: Full report object
   */
  router.get('/report', requireAuth, async function(req, res) {
    try {
      const report = await buildReport(storage);
      res.json(report);
    } catch (err) {
      console.error('[finops] Error building report:', err.message);
      res.status(500).json({ error: 'Failed to build report' });
    }
  });

  /**
   * @openapi
   * /api/modules/finops/audit:
   *   get:
   *     tags: [FinOps]
   *     summary: Triage decision audit log
   *     description: Returns the append-only list of all triage decisions
   *     responses:
   *       200:
   *         description: Array of triage decision records
   */
  router.get('/audit', requireAuth, async function(req, res) {
    try {
      const decisions = await storage.readFromStorage('finops/triage-decisions.json') || [];
      res.json(decisions);
    } catch (err) {
      console.error('[finops] Error loading audit log:', err.message);
      res.status(500).json({ error: 'Failed to load audit log' });
    }
  });

  /**
   * @openapi
   * /api/modules/finops/triage/{id}:
   *   post:
   *     tags: [FinOps]
   *     summary: Record a triage decision for a finding
   *     description: Appends a triage decision. If action is 'deny', also adds the finding ID to the suppression list.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *         description: Finding ID to triage
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [action]
   *             properties:
   *               action: { type: string, enum: [approve, defer, deny, learn] }
   *               rationale: { type: string }
   *               corrected_model: { type: string }
   *               corrected_provider: { type: string }
   *               corrected_thinking: { type: string }
   *     responses:
   *       200:
   *         description: Triage decision recorded
   *       400:
   *         description: Invalid action
   */
  router.post('/triage/:id', requireAdmin, async function(req, res) {
    const VALID_ACTIONS = ['approve', 'defer', 'deny', 'learn'];
    const { action, rationale, corrected_model, corrected_provider, corrected_thinking } = req.body || {};
    const findingId = req.params.id;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    try {
      const latest = await storage.readFromStorage('finops/latest.json') || [];
      const finding = (Array.isArray(latest) ? latest : []).find(f => f.id === findingId);

      const decision = {
        id: findingId,
        action,
        rationale: rationale || '',
        actor: req.userEmail || 'unknown',
        timestamp: new Date().toISOString(),
        finding: finding ? {
          prompt_pattern: finding.prompt_pattern,
          current_model: finding.current_model,
          suggested_model: finding.suggested_model,
          estimated_weekly_savings_usd: finding.estimated_weekly_savings_usd
        } : null
      };

      if (corrected_model) decision.corrected_model = corrected_model;
      if (corrected_provider) decision.corrected_provider = corrected_provider;
      if (corrected_thinking) decision.corrected_thinking = corrected_thinking;

      const decisions = await storage.readFromStorage('finops/triage-decisions.json') || [];
      decisions.push(decision);
      await storage.writeToStorage('finops/triage-decisions.json', decisions);

      if (action === 'deny') {
        const suppression = await storage.readFromStorage('finops/suppression.json') || { suppressed: [] };
        if (!suppression.suppressed.includes(findingId)) {
          suppression.suppressed.push(findingId);
          await storage.writeToStorage('finops/suppression.json', suppression);
        }
      }

      res.json({ status: 'recorded', decision });
    } catch (err) {
      console.error('[finops] Error recording triage decision:', err.message);
      res.status(500).json({ error: 'Failed to record triage decision' });
    }
  });

  /**
   * @openapi
   * /api/modules/finops/sync:
   *   post:
   *     tags: [FinOps]
   *     summary: Manually trigger finops repo sync
   *     description: Clones or pulls the finops recommendations repo and imports the latest snapshot (admin only)
   *     responses:
   *       200:
   *         description: Sync result
   */
  router.post('/sync', requireAdmin, async function(req, res) {
    try {
      const result = await sync(storage, context.secrets);
      res.json(result);
    } catch (err) {
      console.error('[finops] Error during manual sync:', err.message);
      res.status(500).json({ error: 'Sync failed', reason: err.message });
    }
  });

  if (context.registerRefresh) {
    context.registerRefresh('finops-sync', {
      order: 90,
      timeout: 120000,
      cadence: '6h',
      description: 'Clones/pulls finops recommendations repo and imports latest findings snapshot.',
      handler: async function() {
        return sync(storage, context.secrets);
      }
    });
  }

  if (context.registerExport) {
    context.registerExport(require('./export'));
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const latest = await storage.readFromStorage('finops/latest.json');
      const billing = await storage.readFromStorage('finops/billing.json');
      const decisions = await storage.readFromStorage('finops/triage-decisions.json');
      return {
        dataAvailable: !!(latest && Array.isArray(latest) && latest.length > 0),
        findingCount: latest && Array.isArray(latest) ? latest.length : 0,
        billingEntryCount: billing && Array.isArray(billing) ? billing.length : 0,
        triageDecisionCount: decisions && Array.isArray(decisions) ? decisions.length : 0,
        secretsConfigured: !!(context.secrets && context.secrets.FINOPS_GITHUB_TOKEN && context.secrets.FINOPS_GITHUB_REPO)
      };
    });
  }
};
