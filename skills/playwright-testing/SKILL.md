---
name: playwright-testing
description: Use this skill when the project has Playwright installed. Ensures UI flows and pages are validated through e2e tests.
---

This skill ensures UI work is validated through Playwright e2e tests.

## Test Requirements

When creating or modifying UI pages or flows:
- Every user flow should have corresponding Playwright tests
- Cover happy path and key error scenarios

## Test Patterns

- Tests go in a `tests/` or `e2e/` directory
- Use descriptive test names that explain the user flow being tested
- Group related tests using `describe` blocks
- Use page objects or fixtures for reusable interactions

## Validation

Before finishing UI work that affects user flows:
1. Ensure Playwright tests exist for modified flows
2. Run tests to verify changes don't break existing functionality

## Verification Process

Repeat the following until all checks pass:

### 1. Run Playwright Tests
```bash
npx playwright test
```

### 2. On Failure
- Analyze the failure output
- Fix the code causing the failure
- Re-run the checks
- Continue iterating until all tests pass

### 3. Snapshot Updates
If visual changes are intentional (you made deliberate UI changes), update snapshots:
```bash
npx playwright test --update-snapshots
```

Only report back to the user once all checks pass successfully.
