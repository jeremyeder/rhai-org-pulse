const PREFIX = 'finops';

module.exports = async function finopsExport(addFile, storage) {
  const { readFromStorage } = storage;

  const latest = await readFromStorage(`${PREFIX}/latest.json`);
  if (latest) {
    addFile(`${PREFIX}/latest.json`, latest);
  }

  const billing = await readFromStorage(`${PREFIX}/billing.json`);
  if (billing) {
    addFile(`${PREFIX}/billing.json`, billing);
  }

  const triageDecisions = await readFromStorage(`${PREFIX}/triage-decisions.json`);
  if (triageDecisions) {
    addFile(`${PREFIX}/triage-decisions.json`, triageDecisions);
  }

  const suppression = await readFromStorage(`${PREFIX}/suppression.json`);
  if (suppression) {
    addFile(`${PREFIX}/suppression.json`, suppression);
  }
};
