---
name: tech-doc-scorer
description: >
  Scores technical documentation pages by daily development practical utility
  (1-10) and interview relevance (1-10). Invoke when the user sends any tech doc
  URL and wants to know whether it is worth reading, skimming, or skipping.
---

# Tech Doc Scorer

Score technical documentation pages to help a Chinese-speaking developer
(targeting overseas freelancing on Upwork) decide what to read, skim, or skip.

This skill is a general-purpose technical documentation scorer.

## When This Skill Applies

Use this skill whenever the user sends any technical documentation URL and wants a fast
read/no-read decision.

Supported sources include, but are not limited to:
- Official framework and library docs
- API references
- SDK guides
- Cloud/platform docs
- Database docs
- RFC/spec pages
- Architecture or deployment guides

Explicit triggers:
- "打分"
- "评分"
- "score"
- "rate"
- "值不值得看"
- "该不该读"
- "帮我看看这个文档"

Implicit triggers:
- The user sends a technical doc URL without copied content
- The user asks whether a page should be read deeply, skimmed, or skipped
- The user wants section-by-section reading priority for a long doc page

## Scoring Dimensions

### 实用指数 (Daily Development Practical Index, 1-10) - PRIMARY

How often this topic appears in real delivery work for a freelancer or practical engineer.

| Score | Meaning | Typical examples |
|-------|---------|------------------|
| 9-10 | Core knowledge used constantly | REST routing, SQL indexing basics, Dockerfile fundamentals, React state patterns |
| 7-8  | Common in many projects | Caching, auth flows, CI/CD basics, ORM mapping, testing setup |
| 5-6  | Useful in recurring but narrower scenarios | Message queues, observability tooling, plugin APIs, performance tuning options |
| 3-4  | Niche or occasional | Advanced extension points, uncommon deployment modes, vendor-specific features |
| 1-2  | Rare, legacy, or low-ROI | Deprecated APIs, obscure compatibility layers, outdated integrations |

### 面试指数 (Interview Relevance, 1-10) - SECONDARY

How likely this topic appears in technical interviews or deep technical discussions.

| Score | Meaning | Typical examples |
|-------|---------|------------------|
| 9-10 | Must-know interview topic | HTTP basics, transactions, indexes, dependency injection, async/concurrency basics |
| 7-8  | High-frequency topic | Caching strategy, auth, CAP tradeoffs, container basics, testing philosophy |
| 5-6  | Medium-frequency topic | Specific framework lifecycle hooks, build tooling internals, message ordering |
| 3-4  | Rare advanced topic | Internal extension APIs, protocol edge cases, compiler plugin behavior |
| 1-2  | Almost never asked | Deprecated knobs, highly vendor-specific legacy details |

## Workflow

### Step 1: Fetch the Page

Use the best available webpage fetching capability in the current environment.
Prefer the project or workspace configured fetch tool if one exists.

If the page cannot be fetched directly:
- fall back to another available web retrieval tool
- or use search to confirm the page title and context

### Step 2: Parse Sections

Extract the page title and all major sections (`h2`/`h3` headings and their content).
If the page has no clear section structure, treat the whole page as one unit.

### Step 3: Score

Assign two scores (实用指数, 面试指数) to:
- The page as a whole
- Each major section individually

Judge scores from a practical engineering perspective:
- How likely this topic is to matter in real projects
- Whether it is foundational, common, niche, optional, or obsolete
- Whether knowing it creates strong leverage in interviews or design discussions

Adapt to the document type:
- For API references, score by usage frequency and operational importance
- For conceptual guides, score by how foundational the concept is
- For cloud/platform docs, score by how common the service/pattern is in delivery work
- For advanced internals, score lower unless they unlock debugging, performance, or architecture decisions

### Step 4: Output the Report - EXACT FORMAT

Do NOT write the report to any file. Output it directly in the chat using this template:

```text
## 文档评分: <Page Title>
> 来源: <URL>

**日常开发实用指数:** X/10 | **面试指数:** Y/10 | **建议:** 精读 / 选读 / 跳读
```

**Overall suggestion logic:**
- Both scores >= 7 -> "精读"
- Practical >= 4 or Interview >= 7 -> "选读"
- Both scores <= 3 -> "跳读"

**Section breakdown - DEFAULT:**
Normally list every major section in the order they appear on the page.
Do not silently skip obviously important sections.

```text
### Section 明细

| Section | 实用 | 面试 | 建议 |
|---------|------|------|------|
| Authentication Overview | 9 | 8 | 精读 |
| Token Refresh Flow | 8 | 7 | 精读 |
| Custom Plugin Hooks | 4 | 3 | 选读 |
| Legacy Migration Notes | 2 | 1 | 跳读 |
```

Use the exact heading text when practical. If a heading is too long, shorten it to a
clear label without changing meaning.

**Section suggestion logic:**
- Practical >= 7 -> "精读"
- Practical 4-6 -> "选读"
- Practical <= 3 -> "跳读"
- If Interview >= Practical + 3, append " + 面试重点"

**When section spread is small:**
If section scores are very similar (spread < 3), you may keep the table short or replace
it with a one-sentence summary such as:
"本页各 section 实用价值接近，整体可按同一优先级阅读。"

**Reading recommendations footer:**

```text
### 阅读建议
- 必读: <list sections with practical >= 7>
- 可读: <list sections with practical 4-6>
- 可跳过: <list sections with practical <= 3>
```

If something is low on daily usage but high on interview relevance, call it out clearly.

## Scoring Heuristics

Raise the score when the topic is:
- Foundational to understanding a stack
- Frequently used in CRUD, API, database, auth, deployment, or debugging work
- Necessary to ship, operate, or troubleshoot production systems
- A common interview discussion topic

Lower the score when the topic is:
- Legacy, deprecated, or rarely used
- Highly vendor-specific without broad transfer value
- An exotic extension point with low day-to-day relevance
- Detail-heavy but low leverage for practical delivery

## Key Principles

- **Practical-first:** Reading priority is primarily driven by 实用指数.
- **General technical scope:** Do not assume Spring. Apply the same framework to any technical doc.
- **Freelancer lens:** Score from the perspective of someone delivering real software for clients.
- **Be opinionated:** Pick concrete scores and clear recommendations.
- **Chinese-friendly output:** Keep the report easy to scan in Chinese, with numeric scores.
- **Brief is the point:** The user should know in about 10 seconds whether to read, skim, or skip.

