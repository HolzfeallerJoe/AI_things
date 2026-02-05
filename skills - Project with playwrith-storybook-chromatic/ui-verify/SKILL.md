---
name: ui-verify
description: Run UI verification (Playwright visual tests + Chromatic), fix any failures automatically, and iterate until all checks pass.
disable-model-invocation: true
---

## Process

Repeat the following until all checks pass:

### 1. Run Playwright Visual Checks
```bash
npx playwright test
```

### 2. Run Chromatic Publish
```bash
npx chromatic --project-token=chpt_d0a7301117ea4cb
```

### 3. On Failure
- Analyze the failure output
- Fix the code causing the failure
- Re-run the checks
- Continue iterating until all tests pass

### 4. Snapshot Updates
If visual changes are intentional (you made deliberate UI changes), update snapshots:
```bash
npx playwright test --update-snapshots
```

## Output
Only report back to the user once all checks pass successfully.
