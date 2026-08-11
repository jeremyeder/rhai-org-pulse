const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const CLONE_DIR = '/tmp/finops-repo';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(cmd, args, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function sync(storage, secrets) {
  const token = secrets && secrets.FINOPS_GITHUB_TOKEN;
  const repo = secrets && secrets.FINOPS_GITHUB_REPO;

  if (!token || !repo) {
    return { synced: false, reason: 'FINOPS_GITHUB_TOKEN and FINOPS_GITHUB_REPO are required' };
  }

  try {
    const repoUrl = `https://${token}@github.com/${repo}.git`;

    if (fs.existsSync(path.join(CLONE_DIR, '.git'))) {
      await run('git', ['-C', CLONE_DIR, 'pull', '--ff-only']);
    } else {
      if (fs.existsSync(CLONE_DIR)) {
        fs.rmSync(CLONE_DIR, { recursive: true });
      }
      await run('git', ['clone', '--depth', '1', repoUrl, CLONE_DIR]);
    }

    const snapshotsDir = path.join(CLONE_DIR, 'snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      return { synced: false, reason: 'No snapshots/ directory found in repo' };
    }

    const dateDirs = fs.readdirSync(snapshotsDir)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();

    if (dateDirs.length === 0) {
      return { synced: false, reason: 'No date-named snapshot directories found' };
    }

    const latestDate = dateDirs[dateDirs.length - 1];
    const latestDir = path.join(snapshotsDir, latestDate);

    const rankedPath = path.join(latestDir, 'ranked.json');
    const billingPath = path.join(latestDir, 'billing.json');

    if (!fs.existsSync(rankedPath)) {
      return { synced: false, reason: `No ranked.json in snapshots/${latestDate}` };
    }

    const ranked = JSON.parse(fs.readFileSync(rankedPath, 'utf8'));
    const billing = fs.existsSync(billingPath)
      ? JSON.parse(fs.readFileSync(billingPath, 'utf8'))
      : [];

    await storage.writeToStorage('finops/latest.json', ranked);
    await storage.writeToStorage('finops/billing.json', billing);

    const existing = await storage.readFromStorage(`finops/snapshots/${latestDate}.json`);
    if (!existing) {
      await storage.writeToStorage(`finops/snapshots/${latestDate}.json`, {
        date: latestDate,
        findings: ranked,
        billing
      });
    }

    return { synced: true, date: latestDate, findingCount: ranked.length };
  } catch (err) {
    const safeReason = token
      ? err.message.replace(new RegExp(token, 'g'), '<redacted>')
      : err.message;
    return { synced: false, reason: safeReason };
  }
}

module.exports = { sync };
