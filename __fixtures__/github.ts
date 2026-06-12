import { vi } from 'vitest'

export const getOctokit = vi.fn()

export const context = {
  repo: { owner: 'gleanwork', repo: 'agent-plugins' },
  sha: '0000000000000000000000000000000000000000'
}
