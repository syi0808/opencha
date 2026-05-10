# OpenCHA

A simple verification gate that reduces low-effort pull request noise for maintainers.

OpenCHA does not try to detect or block AI agents. It gates low-effort, unverified contributions before they become maintainer review work.

## What OpenCHA Does

OpenCHA runs as a GitHub Action. When an untrusted outside contributor opens a pull request, OpenCHA can mark the PR as verifying, create a visual challenge, and keep the `OpenCHA` check in progress until the PR author answers correctly or a maintainer approves it.

## What OpenCHA Does Not Do

OpenCHA is not an AI detector, a strong anti-bot system, or a replacement for maintainer review.

## Installation

Create `.github/workflows/opencha.yml`:

```yaml
name: OpenCHA

on:
  pull_request_target:
    types: [opened, reopened, ready_for_review, unlabeled, synchronize]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write
  checks: write

concurrency:
  group: opencha-${{ github.event.pull_request.number || github.event.issue.number }}
  cancel-in-progress: false

jobs:
  opencha:
    runs-on: ubuntu-latest
    steps:
      - uses: opencha/opencha@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          opencha-secret: ${{ secrets.OPENCHA_SECRET }}
```

Add a repository secret named `OPENCHA_SECRET`. Use a random string of at least 32 characters.

## Configuration

OpenCHA reads `.github/opencha.yml` from the base repository branch, never from the pull request head branch. If the file is absent, defaults are used. Unknown fields warn and are ignored. Invalid values fail closed.

```yaml
trusted_users:
  - alice

trusted_bots:
  - my-bot[bot]

labels:
  verifying: "opencha: verifying"
  needs_maintainer: "opencha: needs maintainer"

challenge:
  code_count: 5
  max_attempts: 5
  cooldown_seconds: 30
  rotate_on_wrong_answer: false

assets:
  branch: opencha-assets
  cleanup_passed_assets: true

policy:
  reverify_on_push: false
```

`challenge.code_count` controls the number of visible codes and accepts values from 3 to 7.

## Challenge Flow

The MVP challenge is a rasterized GIF. It renders a configurable number of unique codes with independently randomized code lengths, dense ASCII-art font styles, and slides from one code to the next without per-frame index markers or transition-only text color changes.

Untrusted PR authors reply to the challenge with:

```text
/opencha answer YOUR_CODE
```

Only the PR author can pass with `/opencha answer`.

## Maintainer Commands

Trusted maintainers and collaborators can use:

```text
/opencha approve
/opencha reset
```

## Security Model

OpenCHA uses `pull_request_target` only for repository metadata and GitHub operations. It does not checkout or execute pull request code.

Challenge state is stored in encrypted PR comment payloads using AES-256-GCM with a key derived from `opencha-secret` using HKDF-SHA256. Challenge GIF URLs are public information. OpenCHA does not rely on hiding the image.

## Limitations

OpenCHA's MVP challenge is visual and is not accessible to all contributors. Maintainers should provide a manual override path with `/opencha approve`.

OpenCHA is not a strong anti-bot or anti-OCR system. It is a small deliberate-effort gate for maintainers.

Asset cleanup removes files from the asset branch tip when possible, but it does not rewrite git history.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`dist/index.js` is committed for GitHub Action distribution. CI should verify the bundle is current.
