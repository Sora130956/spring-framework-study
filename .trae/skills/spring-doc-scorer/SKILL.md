---
name: spring-doc-scorer
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

**Section breakdown — MANDATORY:**
ALWAYS list every major section (h2/h3 headings) in the order they appear on the page.
Do NOT skip, regroup, or reorder sections. Every heading gets its own row and scores.

```
### Section 明细

| Section | 实用 | 面试 | 建议 |
|---------|------|------|------|
| Overview                        | 8 | 7 | ⭐ 精读  |
| @Component and Stereotype Annotations | 10 | 9 | ⭐ 精读  |
| Using Meta-annotations          | 6 | 4 | 📖 可读  |
| Automatically Detecting Classes | 10 | 9 | ⭐ 精读  |
| Using Filters to Customize Scanning | 6 | 3 | 📖 可读  |
...
```

Use the exact heading text from the page as the section name. If a heading is very long,
shorten it to a meaningful label while keeping its meaning.

**Section suggestion logic:**
- Practical >= 7 → "⭐ 精读"
- Practical 4-6 → "📖 可读"
- Practical <= 3 → "⏭️ 跳过"
- Special: if Interview >= Practical + 3 → append " 💬 面试重点"

**Reading recommendations footer:**

```
### 🎯 阅读建议
- **必读 (实用>=7):** <list sections>
- **可读 (实用4-6):** <list sections>
- **可跳过 (实用<=3):** <list sections>
```

If a section is "可跳过" but has high interview score (>=7), add:
"> 💬 面试重点: <section name> 虽然日常少用，但面试可能问到，建议花 10 分钟了解核心概念。"

**When all sections have similar scores (spread < 3):**
Still show the full section table. Add a note: "> 📝 本页各 section 实用价值接近。"

## Top-Level Module Map (Pre-Scored)

When a URL maps to a top-level module, check this table FIRST before scoring individual sections.

| Module | 实用 | 建议 |
|--------|------|------|
| IoC Container | 10 | ⭐ 精读 |
| Web on Servlet Stack (Spring MVC) | 10 | ⭐ 精读 |
| Data Access (Transactions/JPA/JDBC) | 9 | ⭐ 精读 |
| AOP with Spring | 8 | ⭐ 精读 |
| Testing | 8 | ⭐ 精读 |
| Validation, Data Binding, Type Conversion | 8 | ⭐ 精读 |
| Integration (JMS/Cache/Scheduling) | 6 | 📖 可读 |
| SpEL | 5 | 📖 可读 |
| Resources | 5 | 📖 可读 |
| Null-safety | 5 | 📖 可读 |
| Resilience Features | 4 | 📖 可读 |
| Spring AOP APIs (low-level) | 3 | ⏭️ 跳过 |
| AOT Optimizations | 3 | ⏭️ 跳过 |
| Language Support (Kotlin/Groovy) | 3 | ⏭️ 跳过 |
| Web on Reactive Stack (WebFlux) | 4 | ⏭️ 跳过 |
| Data Buffers and Codecs | 2 | ⏭️ 跳过 |
| Appendix / Overview | 2 | ⏭️ 跳过 |

### Skip Warning

**If the URL belongs to a module marked "⏭️ 跳过" above**, add this warning at the TOP of the scoring output:

```
⚠️ **跳读提醒:** 这个页面所属的模块（<module name>）在顶层大纲中被标记为"可跳过"（实用指数 <=3）。
你之前决定跳过此类模块。如果仍要阅读，建议只花 5-10 分钟浏览核心概念，不需要做完整笔记。
```

**If the URL belongs to a module marked "📖 可读" (实用 4-6)**, no warning — score normally.

## Progress Tracking

After each scoring output, include a progress line.

**Calculate progress as follows:**
1. Count the total note files in the repo: `core/`, `aop/`, `mvc/`, `boot/` directories
2. Estimate total worth-reading chapters: ~55 (IoC ~16, Web Servlet ~10, Data Access ~8, AOP ~6, Validation ~5, Testing ~4, Integration ~3, SpEL ~3, Resources ~2)
3. Percentage = completed_notes / 55 × 100
4. Round to nearest integer

Progress format:
```
### 📈 阅读进度
已完成 **X** 个笔记文件 | 预估总进度约 **Y%** | 当前模块: <module name>
```

Do NOT write this to a file — output in chat only, as part of the scoring report.

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
