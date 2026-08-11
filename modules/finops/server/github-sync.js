const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Stable cache dir — reused across syncs to avoid re-cloning every time.
// We verify the remote origin before every pull to prevent path-hijack.
const CLONE_DIR = path.join(os.tmpdir(), 'finops-repo');

// Run git with the token injected via http.extraheader (never embedded in the URL
// or stored in .git/config). GIT_TERMINAL_PROMPT=0 prevents interactive prompts.
function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const opts = {
      timeout: 60000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(env || {}) }
    };
    childProcess.execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function authArgs(token) {
  // Inject token via http.extraheader so it never lands in .git/config or the URL
  return ['-c', `http.extraheader=Authorization: Bearer ${token}`];
}

async function sync(storage, secrets) {
  const token = secrets && secrets.FINOPS_GITHUB_TOKEN;
  const repo = secrets && secrets.FINOPS_GITHUB_REPO;

  if (!token || !repo) {
    return { synced: false, reason: 'FINOPS_GITHUB_TOKEN and FINOPS_GITHUB_REPO are required' };
  }

  const bareUrl = `https://github.com/${repo}.git`;

  try {
    const dotGit = path.join(CLONE_DIR, '.git');
    if (fs.existsSync(dotGit)) {
      // Verify origin URL matches configured repo before pulling (path-hijack guard)
      const originUrl = await run('git', ['-C', CLONE_DIR, 'remote', 'get-url', 'origin']).catch(() => '');
      if (originUrl !== bareUrl) {
        // Origin mismatch — wipe and re-clone with correct repo
        fs.rmSync(CLONE_DIR, { recursive: true });
      } else {
        // Update credentials for this pull (stale-credential guard)
        await run('git', ['-C', CLONE_DIR, 'remote', 'set-url', 'origin', bareUrl]);
        await run('git', [...authArgs(token), '-C', CLONE_DIR, 'pull', '--ff-only']);
      }
    }

    if (!fs.existsSync(dotGit)) {
      if (fs.existsSync(CLONE_DIR)) fs.rmSync(CLONE_DIR, { recursive: true });
      await run('git', [...authArgs(token), 'clone', '--depth', '1', bareUrl, CLONE_DIR]);
      // Strip any credential residue from config
      await run('git', ['-C', CLONE_DIR, 'remote', 'set-url', 'origin', bareUrl]).catch(() => {});
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
      ? err.message.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<redacted>')
      : err.message;
    return { synced: false, reason: safeReason };
  }
}

module.exports = { sync };
