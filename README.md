# pluginpack-action

A GitHub Action that compiles a
[pluginpack](https://github.com/gleanwork/pluginpack) source repo for a single
target and reconciles the generated output against a **published** plugin repo —
by opening a pull request, never by pushing to the output repo's default branch.

It is the publish step for a source-of-truth layout: author plugins once in a
pluginpack source repo, then sync the native output into each ecosystem's
existing install surface (e.g. `gleanwork/claude-plugins`,
`gleanwork/cursor-plugins`) without moving the repos users install from.

## How it works

1. Check out the output repo into a temp dir (using `token`).
2. Run `pluginpack diff --target <target> --against <checkout>`.
3. **Clean** → report up to date, exit.
4. **Stale + `mode: check`** → fail the job. This is the guard an output repo
   runs to keep hand-edits from drifting away from source.
5. **Stale + `mode: sync`** → `pluginpack build --out-dir <checkout>`, commit to
   a machine-owned branch `pluginpack/sync-<target>`, force-push that branch,
   and open or update a PR into `output-ref`.

The sync branch is force-updated on every run (idempotent). The action never
commits to the output repo's base branch — a human (or a separately configured
auto-merge) merges the PR.

## Usage

```yaml
# In the source repo (e.g. agent-plugins), on release:
jobs:
  sync-claude:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    concurrency:
      group: pluginpack-sync-claude
      cancel-in-progress: true
    steps:
      # Mint a short-lived token scoped only to the output repo.
      - uses: actions/create-github-app-token@v2
        id: app-token
        with:
          app-id: ${{ vars.PLUGINPACK_APP_ID }}
          private-key: ${{ secrets.PLUGINPACK_APP_KEY }}
          owner: gleanwork
          repositories: claude-plugins
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
      - uses: gleanwork/pluginpack-action@v1
        with:
          target: claude
          output-repo: gleanwork/claude-plugins
          token: ${{ steps.app-token.outputs.token }}
```

Use a GitHub App installation token (via `actions/create-github-app-token`)
scoped to the output repos for least privilege; a PAT with `contents:write` +
`pull-requests:write` on the output repo also works.

## Inputs

| Input                | Required | Default           | Description                                                             |
| -------------------- | -------- | ----------------- | ----------------------------------------------------------------------- |
| `target`             | yes      | —                 | pluginpack target to build (`claude`, `cursor`, …).                     |
| `output-repo`        | yes      | —                 | Published repo to sync into, as `owner/name`.                           |
| `output-ref`         | no       | `main`            | Base branch the sync PR targets.                                        |
| `token`              | yes      | —                 | Token with `contents:write` + `pull-requests:write` on the output repo. |
| `mode`               | no       | `sync`            | `sync` opens/updates a PR when stale; `check` fails when stale.         |
| `pluginpack-version` | no       | `latest`          | npm version/dist-tag of `@gleanwork/pluginpack`.                        |
| `working-directory`  | no       | `.`               | Path to the checked-out pluginpack source repo.                         |
| `pr-branch-prefix`   | no       | `pluginpack/sync` | Prefix for the sync branch; `-<target>` is appended.                    |
| `pr-labels`          | no       | `pluginpack-sync` | Comma-separated labels for the sync PR.                                 |

## Outputs

| Output      | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `stale`     | `"true"` when the output repo differed from a fresh build. |
| `pr-number` | Number of the opened/updated sync PR (sync mode).          |
| `pr-url`    | HTML URL of the sync PR (sync mode).                       |

## Development

This action follows the
[`actions/typescript-action`](https://github.com/actions/typescript-action)
conventions: TypeScript in `src/`, bundled to `dist/` with Rollup, tested with
Vitest. Run `npm run all` (format, lint, test, package) before committing; the
committed `dist/` is what runs, so `check-dist.yml` enforces it stays current.
