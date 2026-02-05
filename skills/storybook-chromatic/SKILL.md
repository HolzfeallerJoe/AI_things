---
name: storybook-chromatic
description: Use this skill when the project has Storybook with Chromatic installed. Ensures UI components are documented with stories and validated through visual regression testing.
---

This skill ensures UI components are documented and validated through Storybook and Chromatic.

## Component Requirements

When creating or modifying UI components:
- Every reusable component must have Storybook stories for key states (default, loading, error, empty, etc.)

## Storybook Patterns

- Stories go in a `stories/` directory or co-located with components as `*.stories.ts`
- Include Primary, Secondary, and edge case variants
- Use autodocs for automatic documentation generation

## Validation

Before finishing UI work:
1. Ensure Storybook stories exist and cover key component states
2. Validate visual changes via Chromatic

## Verification Process

Repeat the following until all checks pass:

### 1. Run Chromatic Publish
```bash
npx chromatic --project-token=<token>
```

### 2. On Failure
- Analyze the failure output
- Fix the code causing the failure
- Re-run the checks
- Continue iterating until all tests pass

Only report back to the user once all checks pass successfully.
