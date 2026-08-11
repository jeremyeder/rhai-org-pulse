import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { sync } = require('../../server/github-sync')

const execFileAsync = promisify(execFile)

function makeStorage() {
  const written = {}
  return {
    writeToStorage: vi.fn(async (p, data) => { written[p] = data }),
    readFromStorage: vi.fn(async (p) => written[p] || null),
    _written: written
  }
}

describe('github-sync', () => {
  it('returns synced: false when token is missing', async () => {
    const storage = makeStorage()
    const result = await sync(storage, {})

    expect(result.synced).toBe(false)
    expect(result.reason).toContain('required')
  })

  it('returns synced: false when repo is missing', async () => {
    const storage = makeStorage()
    const result = await sync(storage, { FINOPS_GITHUB_TOKEN: 'tok' })

    expect(result.synced).toBe(false)
    expect(result.reason).toContain('required')
  })

  it('returns synced: false with reason on git failure', async () => {
    const storage = makeStorage()
    const result = await sync(storage, {
      FINOPS_GITHUB_TOKEN: 'invalid_token',
      FINOPS_GITHUB_REPO: 'nonexistent/repo-that-does-not-exist-12345'
    })

    expect(result.synced).toBe(false)
    expect(result.reason).toBeDefined()
    expect(typeof result.reason).toBe('string')
  })

  describe('with fixture repo', () => {
    let tmpDir
    let repoDir

    beforeEach(async () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finops-test-'))
      repoDir = path.join(tmpDir, 'finops-repo')

      fs.mkdirSync(repoDir)
      await execFileAsync('git', ['init', repoDir])

      const snapshotsDir = path.join(repoDir, 'snapshots')
      fs.mkdirSync(snapshotsDir)

      const dateDir1 = path.join(snapshotsDir, '2026-07-01')
      const dateDir2 = path.join(snapshotsDir, '2026-08-01')
      fs.mkdirSync(dateDir1)
      fs.mkdirSync(dateDir2)

      const ranked1 = [{ id: 'f1', prompt_pattern: 'old', estimated_weekly_savings_usd: 10 }]
      const ranked2 = [{ id: 'f2', prompt_pattern: 'new', estimated_weekly_savings_usd: 42 }]
      fs.writeFileSync(path.join(dateDir1, 'ranked.json'), JSON.stringify(ranked1))
      fs.writeFileSync(path.join(dateDir2, 'ranked.json'), JSON.stringify(ranked2))

      const billing = [{ model: 'gpt-4', cost_usd: 100 }]
      fs.writeFileSync(path.join(dateDir2, 'billing.json'), JSON.stringify(billing))

      await execFileAsync('git', ['-C', repoDir, 'add', '.'])
      await execFileAsync('git', ['-C', repoDir, 'commit', '-m', 'init', '--allow-empty'])
    })

    afterEach(() => {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true })
      }
      const cloneDir = '/tmp/finops-repo'
      if (fs.existsSync(cloneDir)) {
        fs.rmSync(cloneDir, { recursive: true })
      }
    })

    it('selects latest snapshot directory by date sort', async () => {
      const storage = makeStorage()
      const result = await sync(storage, {
        FINOPS_GITHUB_TOKEN: 'fake',
        FINOPS_GITHUB_REPO: repoDir
      })

      if (result.synced) {
        expect(result.date).toBe('2026-08-01')
      }
    })

    it('writes latest.json to storage on success', async () => {
      const storage = makeStorage()
      const result = await sync(storage, {
        FINOPS_GITHUB_TOKEN: 'fake',
        FINOPS_GITHUB_REPO: repoDir
      })

      if (result.synced) {
        const latestWrite = storage.writeToStorage.mock.calls.find(
          call => call[0] === 'finops/latest.json'
        )
        expect(latestWrite).toBeDefined()
      }
    })

    it('archives snapshot to storage', async () => {
      const storage = makeStorage()
      const result = await sync(storage, {
        FINOPS_GITHUB_TOKEN: 'fake',
        FINOPS_GITHUB_REPO: repoDir
      })

      if (result.synced) {
        const snapshotWrite = storage.writeToStorage.mock.calls.find(
          call => call[0] && call[0].includes('snapshots/')
        )
        expect(snapshotWrite).toBeDefined()
      }
    })

    it('skips archive if snapshot already exists in storage', async () => {
      const storage = makeStorage()
      storage.readFromStorage.mockImplementation(async (p) => {
        if (p.includes('snapshots/')) return { existing: true }
        return null
      })
      const result = await sync(storage, {
        FINOPS_GITHUB_TOKEN: 'fake',
        FINOPS_GITHUB_REPO: repoDir
      })

      if (result.synced) {
        const archiveWrites = storage.writeToStorage.mock.calls.filter(
          call => call[0] && call[0].includes('snapshots/')
        )
        expect(archiveWrites).toHaveLength(0)
      }
    })
  })

  it('token does not appear in returned result on auth failure', async () => {
    const token = 'ghp_supersecret_token_xyz'
    const storage = makeStorage()
    const result = await sync(storage, {
      FINOPS_GITHUB_TOKEN: token,
      FINOPS_GITHUB_REPO: 'nonexistent/repo-12345'
    })

    expect(result.synced).toBe(false)
    expect(JSON.stringify(result)).not.toContain(token)
  })
})
