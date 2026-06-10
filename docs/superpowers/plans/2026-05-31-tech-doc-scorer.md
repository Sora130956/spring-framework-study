# Tech Doc Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone `tech-doc-scorer` skill that scores Spring documentation pages on practical utility and interview relevance, outputting results in chat only.

**Architecture:** Single SKILL.md file at `C:\Users\Lawliet\.claude\skills\tech-doc-scorer.md`. The skill instructs Claude to: fetch page via Bing MCP → parse h2/h3 sections → apply dual-dimension scoring (实用指数 + 面试指数) → output compact score report in chat. No file writes, no coupling with the note-taking workflow.

**Tech Stack:** Markdown SKILL.md format, Bing MCP for web fetching.

---

## File Structure

```
C:\Users\Lawliet\.claude\skills\
└── tech-doc-scorer.md    ← CREATE: the skill file (frontmatter + body)
```

No changes to the study repo beyond this plan file.

---

### Task 1: Write the Skill File

**Files:**
- Create: `C:\Users\Lawliet\.claude\skills\tech-doc-scorer.md`

- [ ] **Step 1: Create the skill directory and write SKILL.md**

Write the complete skill file (see content below):

```markdown
---
name: tech-doc-scorer
description: >
  Scores Spring Framework documentation pages by daily development practical utility
  (1-10) and interview relevance (1-10) for a freelancer targeting Upwork projects.
  Use this whenever the user sends a Spring doc URL and wants to know if it's worth
  reading — look for phrases like "打分", "评分", "score", "这个值不值得看",
  "帮我看看这个文档", or any URL from docs.spring.io. Also trigger when the user
  asks "should I read this" about any Spring-related documentation link.
---

# Spring Doc Scorer

Score Spring Framework documentation pages to help a Chinese-speaking developer
(targeting overseas freelancing on Upwork) decide what to read, skim, or skip.

## When This Skill Applies

The user sends a Spring documentation URL (typically `docs.spring.io`) with intent
to evaluate its practical value. Explicit triggers: "打分", "评分", "score", "rate".
Implicit triggers: "这个值不值得看", "帮我看看这个文档", or sending a Spring doc
URL without copied content.

## Scoring Dimensions

### 实用指数 (Daily Development Practical Index, 1-10) — PRIMARY

How often a freelancer encounters this in real Spring projects on Upwork.

| Score | Meaning | Examples |
|-------|---------|----------|
| 9-10 | Used daily, every project needs it | `@Autowired`, `@Component`, `application.properties` |
| 7-8  | Most projects use it | `@Qualifier`, `@Primary`, bean scopes |
| 5-6  | Common in specific scenarios | `FactoryBean`, `BeanPostProcessor` |
| 3-4  | Occasionally useful, niche | Custom scopes, JMX integration |
| 1-2  | Rarely encountered, obscure/deprecated | XSLT views, Portlet MVC |

### 面试指数 (Interview Relevance, 1-10) — SECONDARY

How likely this topic appears in English technical interviews.

| Score | Meaning | Examples |
|-------|---------|----------|
| 9-10 | Must-know interview question | IoC/DI principles, bean lifecycle, constructor vs field injection |
| 7-8  | High-frequency question | Bean scopes, AOP basics, transaction management |
| 5-6  | Occasional question | `@Primary` vs `@Qualifier`, auto-configuration principles |
| 3-4  | Rare, advanced-level | Custom `BeanPostProcessor`, `FactoryBean` |
| 1-2  | Almost never asked | Obscure XML config, deprecated features |

## Workflow

### Step 1: Fetch the Page

Use **Bing MCP** (`mcp__bing-search__crawl_webpage`) to fetch the page content.
If the URL is a Spring docs page but Bing MCP can't reach it, use
`mcp__bing-search__bing_search` to find the page title as a fallback.

**NEVER use the built-in WebFetch tool** — the user has configured Bing MCP for this purpose.

### Step 2: Parse Sections

Extract the page title and all major sections (h2/h3 headings and their content).
If the page has no clear section structure, treat the whole page as one unit.

### Step 3: Score

Assign two scores (实用指数, 面试指数) to:
- The page as a whole (weighted average)
- Each major section individually

Score based on: how often this feature/pattern/concept appears in real Spring projects
a freelancer would take on Upwork, and how likely it is to come up in an interview.

When the topic is fundamental infrastructure (DI, bean config, AOP basics), score high
on practical utility. When the topic is niche extensions or legacy features, score low.

### Step 4: Output the Report — EXACT FORMAT

Do NOT write the report to any file. Output it directly in the chat using this exact template:

```
## 📊 文档评分: <Page Title>
> 来源: <URL>

**日常开发实用指数:** X/10 | **面试指数:** Y/10 | **建议:** 精读 / 选读 / 跳读
```

**Overall suggestion logic:**
- Both scores >= 7 → "精读"
- Practical >= 4 or Interview >= 7 → "选读"
- Both scores <= 3 → "跳读"

**Section breakdown — CONDITIONAL:**
Only show the section table when the score spread across sections is >= 3 points (max - min).

```
### Section 明细

| Section | 实用 | 面试 | 建议 |
|---------|------|------|------|
| 1.1 Bean Overview    | 8 | 9 | ⭐ 精读  |
| 1.2 Bean Scopes      | 7 | 8 | 📖 可读  |
| 1.3 Custom Scope     | 2 | 1 | ⏭️ 跳过  |
```

**Section suggestion logic:**
- Practical >= 7 → "⭐ 精读"
- Practical 4-6 → "📖 可读"
- Practical <= 3 → "⏭️ 跳过"
- Special: if Interview >= Practical + 3 → append "💬 面试重点"

**Reading recommendations footer:**

```
### 🎯 阅读建议
- **必读 (实用>=7):** <list sections>
- **可读 (实用4-6):** <list sections>
- **可跳过 (实用<=3):** <list sections>
```

If a section is "可跳过" but has high interview score (>=7), add:
"> 💬 面试重点: <section name> 虽然日常少用，但面试可能问到，建议花 10 分钟了解核心概念。"

**When all sections are similar (spread < 3):**
Skip the section table. Replace with: "本页各 section 实用价值接近，无需跳读。" followed by a 1-2 sentence summary of what the page is about and whether it's worth reading.

## Key Principles

- **Practical-first:** The decision to read/skip is primarily driven by 实用指数.
  Interview index acts as a tiebreaker or a "worth knowing for interviews" flag.
- **Freelancer lens:** Score from the perspective of someone taking Upwork Spring projects —
  common CRUD apps, REST APIs, microservices. Not enterprise niche features.
- **Be opinionated:** Don't hedge. A score of "5 or 6" is useless — pick one and commit.
- **Chinese-friendly output:** Section labels and suggestions use Chinese so the user
  can scan quickly. Scores use numbers for precision.
- **Brief is the point:** The whole report should fit in one screen. The user wants to
  decide in 10 seconds whether to read or skip.
```

- [ ] **Step 2: Verify the file was created**

Run: `Get-Content C:\Users\Lawliet\.claude\skills\tech-doc-scorer.md | Select-Object -First 5`

Expected: Frontmatter with `name: tech-doc-scorer`

---

### Task 2: Smoke Test

**Files:** None (test-only)

- [ ] **Step 3: Test with a sample Spring doc URL**

Send this test prompt to verify the skill triggers and produces correct output:

```
https://docs.spring.io/spring-framework/reference/core/beans/introduction.html 打分
```

Check that the output:
1. Is in chat only (no file written)
2. Contains 实用指数 and 面试指数 scores
3. Has section breakdown (since the beans intro page likely has varied sections)
4. Follows the exact output template

- [ ] **Step 4: Test with a focused/uni-score page**

Test with a single-topic page like:
```
https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html 评分
```

Check that when sections have similar scores (spread < 3), the section table is collapsed.

---

### Task 3: Commit Plan

- [ ] **Step 5: Commit the plan**

```bash
git add docs/superpowers/plans/2026-05-31-tech-doc-scorer.md
git commit -m "docs: add tech-doc-scorer implementation plan"
```
