---
name: context7-docs
description: Query Context7 for latest documentation when making code changes. Caches queries with version tracking to avoid redundant API calls. Use before implementing features or fixing bugs.
---

# Context7 Documentation Cache

This skill queries Context7 for specific documentation when making changes, then caches results in `CONTEXT7_DOCS.md` to avoid redundant queries.

## When to Use

**Before making code changes**, check if you need documentation:

1. Check `CONTEXT7_DOCS.md` for existing cached queries
2. If query exists AND version matches → use cached docs
3. If query missing OR version changed → query Context7, then cache result

## Workflow

### Step 1: Determine What You Need

Before implementing a feature or fix, identify what documentation would help:
- "Angular reactive forms validation"
- "Playwright page object model"
- "Vitest mocking async functions"

### Step 2: Check Cache

Read `CONTEXT7_DOCS.md` and look for matching queries:

```markdown
## @angular/core@21.1.0

### Query: "reactive forms validation"
[cached docs here]
```

**If found with matching version** → use the cached docs, skip querying.

### Step 3: Query if Needed

If not cached or version changed:

1. Use `resolve-library-id` to get the Context7 library ID
2. Use `query-docs` with your specific query
3. Add results to `CONTEXT7_DOCS.md`

### Step 4: Update Cache

Append to `CONTEXT7_DOCS.md`:

```markdown
## package@version

### Query: "your specific query"
> Queried: [DATE]

[paste the returned documentation and code snippets]

---
```

## Cache File Format

```markdown
# Context7 Documentation Cache

> Project-specific documentation cache. Queries are cached with version tracking.
> Docs are fetched on-demand when making changes.

---

## @angular/core@21.1.0

### Query: "signals computed effect"
> Queried: 2026-02-05

[Documentation snippets...]

### Query: "reactive forms validation"
> Queried: 2026-02-05

[Documentation snippets...]

---

## vitest@4.0.8

### Query: "mocking modules vi.mock"
> Queried: 2026-02-05

[Documentation snippets...]

---
```

## Cache Logic

```
BEFORE making changes:
  1. Identify needed docs (e.g., "Angular HttpClient interceptors")
  2. Extract package name (e.g., "@angular/common")
  3. Get current version from package.json
  4. Check CONTEXT7_DOCS.md:
     - Section "## @angular/common@X.X.X" exists?
     - Query "HttpClient interceptors" exists under it?

  IF exists AND version matches:
     → Use cached docs

  IF missing OR version differs:
     → Query Context7
     → Append to CONTEXT7_DOCS.md under correct version section
```

## Outdated Cache Cleanup

When a package version changes, **remove or overwrite** the outdated section:

### On Version Change

```
Current: @angular/core@21.2.0
Cached:  @angular/core@21.1.0  ← OUTDATED

Action:
  1. Delete entire "## @angular/core@21.1.0" section (including all queries under it)
  2. Create new "## @angular/core@21.2.0" section
  3. Query fresh docs as needed
```

### On Re-query Same Topic

If you need to refresh a specific query (e.g., docs were incomplete):

```
Action:
  1. Find the existing "### Query: ..." entry
  2. Replace it with fresh results
  3. Update the "Queried: [DATE]" timestamp
```

### Manual Cleanup

To remove a package entirely (e.g., dependency removed):
- Delete the entire `## package@version` section and its contents up to the next `---`

### Example: Version Upgrade

Before (outdated):
```markdown
## @angular/core@21.1.0

### Query: "signals"
> Queried: 2026-01-15
[old docs]

---
```

After upgrade to 21.2.0:
```markdown
## @angular/core@21.2.0

### Query: "signals"
> Queried: 2026-02-05
[fresh docs]

---
```

## Recommended Library IDs

| Package | Context7 Library ID |
|---------|---------------------|
| @angular/core | `/websites/angular_dev` |
| rxjs | `/reactivex/rxjs` |
| storybook | `/websites/storybook_js` |
| @playwright/test | `/websites/playwright_dev` |
| vitest | `/websites/main_vitest_dev` |
| react | `/facebook/react` |
| next | `/vercel/next.js` |
| vue | `/vuejs/core` |

## Example Usage

**Task:** "Add form validation to the login component"

1. Need docs on: Angular reactive forms, validation
2. Check cache: No entry for "forms validation" under @angular/core@21.1.0
3. Query Context7:
   ```
   resolve-library-id: "angular"
   query-docs: "/websites/angular_dev" + "reactive forms validation validators"
   ```
4. Cache the results in CONTEXT7_DOCS.md
5. Use the docs to implement the feature

**Next time** someone needs form validation docs:
- Check cache → found under @angular/core@21.1.0
- Version still 21.1.0? → Use cached docs, no API call needed
