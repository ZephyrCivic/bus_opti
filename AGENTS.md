**Motto:** "Small, clear, safe steps — always grounded in real docs."

---

## Principles

* Keep changes minimal, safe, and reversible.
* Prefer clarity over cleverness; simplicity over complexity.
* Avoid new dependencies unless necessary; remove when possible.

---

## Knowledge & Libraries

* Context7, Playwright, Chrome DevTools はすべて `npx tsx tools/<name>Cli.ts ...` で直接呼び出す。CLI が唯一のサポート経路。
* Context7 がエラーを返した場合は `CONTEXT7_BASE_URL` / `CONTEXT7_API_KEY` を見直し、CLI で再試行する。
* Playwright 自動化は `tools/playwrightCli.ts`、Chrome DevTools 操作は `tools/chromeDevtoolsCli.ts` をそれぞれ `npx tsx` で実行する。
* If uncertain, pause and request clarification.

---

## Workflow

* **Plan:** Share a short plan before major edits; prefer small, reviewable diffs.
* **Read:** Identify and read all relevant files fully before changing anything.
* **Verify:** Confirm external APIs and assumptions against docs fetched through the new CLIs; re-read modified code for syntax/indentation issues.
* **Implement:** Keep scope tight; write modular, single-purpose files.
* **Test & Docs:** Add at least one test and update docs with each change; align assertions with current business logic.
* **Reflect:** Fix at the root cause; consider adjacent risks to prevent regressions.

---

## Code Style & Limits

* Keep files ≤ 300 LOC; keep modules single-purpose.
* Comments: Add a brief header at the top of every file (where, what, why). Prefer clear, simple explanations; comment non-obvious logic.
* Comment habit: Err on the side of more comments; include rationale, assumptions, and trade-offs.
* Configuration: Centralize runtime tunables in `config.py`; avoid magic numbers in code and tests. Pull defaults from config when wiring dependencies.
* Simplicity: Implement exactly what’s requested—no extra features.

---

## Collaboration & Accountability

* Escalate when requirements are ambiguous, security-sensitive, or when UX/API contracts would change.
* Tell me when you are not confident about your code, plan, or fix. Ask questions or help when your confidence level is below 80%.
  * Assume that you get **–4 points** for wrong code and/or breaking changes. **+1 point** for successful changes. **0 point** when you honestly tell me you’re uncertain.
* Value correctness over speed (a wrong change costs more than a small win).
* 会話は常に日本語で行うこと。

---

## Quick Checklist

Plan → Read files → Verify docs → Implement → Test & Docs → Reflect

---

