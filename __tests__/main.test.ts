import { beforeEach, describe, expect, it, vi } from 'vitest'

// Replace the @actions/* modules with the fixture mocks. The factories use
// dynamic import so they don't close over hoisted bindings.
vi.mock('@actions/core', () => import('../__fixtures__/core.js'))
vi.mock('@actions/exec', () => import('../__fixtures__/exec.js'))
vi.mock('@actions/github', () => import('../__fixtures__/github.js'))

const core = await import('@actions/core')
const exec = await import('@actions/exec')
const github = await import('@actions/github')
const { run } = await import('../src/main.js')

function withInputs(inputs: Record<string, string>): void {
  vi.mocked(core.getInput).mockImplementation(
    (name: string) => inputs[name] ?? ''
  )
}

describe('pluginpack-action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports up to date and opens no PR when the diff is clean', async () => {
    withInputs({
      target: 'claude',
      'output-repo': 'gleanwork/claude-plugins',
      token: 'tok'
    })
    // git clone + diff both return 0 (clean).
    vi.mocked(exec.exec).mockResolvedValue(0)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('stale', 'false')
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(github.getOctokit).not.toHaveBeenCalled()
  })

  it('fails in check mode when the output repo is stale', async () => {
    withInputs({
      target: 'claude',
      'output-repo': 'gleanwork/claude-plugins',
      token: 'tok',
      mode: 'check'
    })
    // git clone returns 0; the pluginpack diff (npx) returns 1 (stale).
    vi.mocked(exec.exec).mockImplementation((cmd: string) =>
      Promise.resolve(cmd === 'npx' ? 1 : 0)
    )

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('stale', 'true')
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('is stale')
    )
  })

  it('rejects an invalid mode before doing any work', async () => {
    withInputs({
      target: 'claude',
      'output-repo': 'gleanwork/claude-plugins',
      token: 'tok',
      mode: 'bogus'
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('mode must be')
    )
    expect(exec.exec).not.toHaveBeenCalled()
  })

  it('rejects a malformed output-repo', async () => {
    withInputs({
      target: 'claude',
      'output-repo': 'not-a-repo',
      token: 'tok'
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('owner/name')
    )
  })
})
