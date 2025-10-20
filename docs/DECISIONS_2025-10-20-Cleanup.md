---
title: Repo Cleanup — Root Minimization
date: 2025-10-20
authors: team
---

# Decisions: Repository Cleanup (Root Minimization)

Context: Keep the root tidy and align with AGENTS.md motto (Small, clear, safe steps). No code behavior change. No UI impact.

## Changes

- Move `index.ts` to `tools/index.ts` (tools aggregator).
- Move `idea.md` to `docs/archives/idea.md` (design memo to archives).
- Move `aaa.webp` and `temp-screenshot.png` to `docs/screenshots/` (doc assets).
- Move `tmp_plans_debug.txt` to `tmp/` (temporary file area).
- Delete `dev-server.err.log`, `dev-server.out.log`, and `creating` (ephemeral logs/notes).
- Update `.gitignore` to exclude common stray files: `/temp-*.png`, `/creating`, `/tmp_plans_debug.txt`, `/logs/`.

## Rationale

- Reduce noise at the repository root for clarity and lower risk.
- Follow SSOT and documentation hygiene by grouping long‑form notes under `docs/`.
- Keep generated/temporary artifacts under ignored paths.

## Validation

- No source code paths imported `index.ts` from root; aggregator remains available at `tools/index.ts`.
- Build/test entry points unchanged. No UI snapshot required.

## Next

- If future assets are added for docs, place under `docs/screenshots/`.
- Keep logs under `logs/` (git‑ignored) or delete before commit.
