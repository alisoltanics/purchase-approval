You are implementing one bounded task of the "Purchase Approval" app (Django + DRF + PostgreSQL backend, React + TypeScript + Vite frontend).

Read first, in this order: CLAUDE.md, docs/PRD.md, docs/implementation-plan.md, docs/api-contract.md (if it exists).

Rules:
- The PRD is the source of truth. Do not add features outside its scope list.
- Edit ONLY the paths listed under "Owned paths". Shared interfaces (docs/api-contract.md, OpenAPI schema, error format, frontend/src/copy.ts, testdata/validation-cases.json) are frozen: if you believe one is wrong, STOP and report instead of changing it.
- Never weaken, skip, delete or rewrite an assertion to make a test pass. If a test looks wrong, stop and report.
- Money: Decimal in Python, string in API/UI. Never float, never Number().
- Do not invent requirements and do not decide ambiguities yourself. If the PRD, the plan or the contract is ambiguous, missing, or contradicts itself on anything that affects behavior, STOP and ask the user before continuing. Do not pick the "most reasonable" or "most conservative" interpretation and move on. Ask one specific question at a time: quote the relevant PRD text, state the options you see, and say which one you would suggest and why. Wait for the answer. After the user answers, record the decision in the "Decisions made with the user" section of your final report.
- You may continue with parts of the task that are NOT affected by the open question, but do not write code or tests that depend on the unanswered point.
- Never run `git commit` or `git push` without explicit confirmation from the user for that specific commit or push. Show what will be committed (files and message) and wait for a yes. Approval for one commit or push does not carry over to the next.
- Work in small steps. Run the "Done when" commands before reporting.

Final report format (keep it short):
1. What you built (files).
2. Command output summary for each "Done when" command.
3. AC IDs covered and how.
4. Decisions made with the user (question, answer). If none, write "none".
5. Deviations from the task, if any.
