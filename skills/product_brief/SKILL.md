---
name: product_brief
description: Use this skill whenever the user asks to create a product brief, summarize a product, or write up a product idea/spec. Writes an Internal Product Brief as a Markdown file into the agent's current working directory, following the template below.
---

# Product Brief

Generates an **Internal Product Brief** in Markdown and writes it into the **current working directory** (the folder the agent is open in), following the template in this file.

## Steps

1. **Gather the details first.** Pull from the conversation, then **scan the current project** for anything relevant (e.g. `README`, docs, `package.json`/manifest, source layout, existing specs). Never invent or guess details, and do not leave `_TBD_` markers or empty bullets. If, after scanning, a section's information is still unknown, **ask the user** for it rather than writing the file with gaps.

2. **Write a Markdown file into the current working directory**, following the "Template" structure below. Name it after the product (e.g. `<Product Name> - Product Brief.md`), or `Product Brief.md` if the product has no name yet.

## Template

Use exactly these sections, in this order, each as a Markdown heading:

```markdown
# Internal Product Brief

## Product Name (Working Title)

## Product Type
<e.g. Desktop Software (Windows/macOS) – B2C>

## 1. Product Vision
<one short paragraph describing the vision>

**Core idea:** <one-line core idea>

## 2. Target User
- <primary user segment>
- <traits / values / context>

## 3. User Problem
- <problem>
- <what existing tools get wrong>

## 4. Proposed Solution
<one-line framing of the solution>
- <key aspect>
- <what it deliberately does NOT do>

## 5. Core / Version 1 Features
**Must-have features:**
- <feature>
  - <sub-point>

<interpretation/logic notes if relevant>

## 6. Possible Version 2 Features
**Expansion ideas (post-launch):**
- <idea>: <short description>
```

## Example

```markdown
# Internal Product Brief

## Product Name (Working Title)
PlainLanguageSystemReport

## Product Type
Desktop Software (Windows/macOS) – B2C

## 1. Product Vision
PlainLanguageSystemReport translates complex system information into a human-readable "PC health letter". Instead of technical metrics, users receive a calm, understandable explanation of their computer's condition, what is fine, and what may need attention.

**Core idea:** Help users understand their PC, not optimize it.

## 2. Target User
- Primary: Male, 50+
- B2C, non-technical to semi-technical
- Values clarity, reassurance, and trust over performance tuning
- Often unsure whether their PC problems are "serious" or "normal"

## 3. User Problem
- System information is fragmented, technical, and stressful
- Users don't know:
  - If their PC is "healthy"
  - What issues actually matter
  - Whether action is required now or later
- Existing tools focus on numbers, warnings, or optimizations — not understanding

## 4. Proposed Solution
A one-click report that presents system health in plain language, structured like a letter:
- Short verdicts instead of metrics
- Clear explanations without jargon
- Green / Yellow / Red signals for orientation
- Friendly concluding summary

The software does not fix issues automatically. It explains them.

## 5. Core / Version 1 Features
**Must-have features:**
- One-click "Create my PC report"
- Fixed report structure:
  - Overall PC condition
  - Startup & speed
  - Storage situation
  - Installed programs
  - Security & updates
  - Age & future readiness
- Traffic-light indicators (Green / Yellow / Red)
- Plain-language explanations and tooltips
- Friendly conclusion ("What this means for you")
- Export report as PDF or text

Interpretation logic: Rule-based heuristics (e.g. disk usage, startup apps, update state) mapped to human explanations. No real-time monitoring.

## 6. Possible Version 2 Features
**Expansion ideas (post-launch):**
- Scheduled reports: Automatic monthly or quarterly PC health letters delivered to the user's desktop or email
- Trend view: Simple comparison to previous reports ("Your PC is a little slower than last month, but still fine")
- Guided next steps: Optional "What can I do about it?" section with simple, non-technical recommendations
```

## Notes

- Output goes to the **current working directory**, never into this skill folder.
- Keep the tone calm and plain-language, matching the example (short verdicts, no jargon).
