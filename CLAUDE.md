# Spring Framework Study Notes

## Project Purpose

本仓库是一个**中文母语程序员**的学习笔记。

**目标：** 转型海外 freelancer。通过精读 Spring Framework 官方文档，同时提升两项能力：
1. **英语能力** — 以全英文文档为学习材料，积累技术词汇、学术表达和句式
2. **技术深度** — 系统掌握 Spring 框架，达到能在海外项目中独立工作的水平

**用户画像：** 中文母语，CET-4 612 分，有 Java/Spring 开发经验，希望突破英语障碍直接阅读一手英文文档，在技术精进的同时提升英语。

**笔记语言：** 中英双语 — 核心理解用中文（确保理解准确），原文引用保留英文，术语和句子解析帮助语言积累。

## Directory Structure

```
core/           — Spring Core（IoC 容器、DI）
  └── 01-ioc-container/   ← 按文档章节分子目录
aop/            — Spring AOP
mvc/            — Spring MVC
boot/           — Spring Boot
templates/      — 笔记模板 (note-template.md)
docs/           — 设计规范 & 实现计划
```

新建章节时，在对应模块下创建 `NN-english-slug/` 子目录。

## Note Template

笔记遵循 `templates/note-template.md` 的 5 段结构：
1. `# <标题>` — 章节英文标题
2. `> **来源:** <URL>` — Spring 官方文档链接
3. `## 核心理解` — 中文总结，2-3 段
4. `## 关键点` — `### <知识点>`，原文引用 + 中文理解 + 代码示例
5. `## 句子解析` — 2-3 个难句的翻译 + 语法/句式分析
6. `## 术语表` — `| 英文 | 词性 | 释义 |`

## Web Fetching — CRITICAL

When fetching Spring documentation pages, **ALWAYS use Bing MCP** (user has configured it). Never use the built-in WebFetch tool for this purpose.

## Input Format

用户使用以下格式发送原始笔记：

```
【Spring 文档链接】
【原文段落1】
【对原文1的关注点、我的理解/备注】
【原文段落2】
【对原文2的关注点、我的理解/备注】
...
```

每个 `【】` 块是一个独立单元。原文和附带的理解是成对的：一个原文段落后面紧跟着对这个段落的关注点和理解。Claude 解析时按这个配对关系来组织笔记的"关键点"部分。

## Workflow — CRITICAL

When user sends raw notes in the format above:

**MUST DO:**
1. Determine which module + chapter the content belongs to
2. If the user only sends a URL (no copied content), use BING MCP to fetch the page, then proceed
3. Read `templates/note-template.md` for the note structure
4. Format the raw notes into a structured note following the template exactly
5. **Write the note to the corresponding `.md` file** in the correct module subdirectory (e.g., `core/01-ioc-container/container-overview.md`)
6. Commit the new note file

**MUST NOT DO:**
- **NEVER** output the formatted note to the conversation dialog as the only output — it MUST be saved as a `.md` file
- **NEVER** save intermediate web-fetch results as separate files — only the final structured note gets saved
- **NEVER** create extra files beyond the single `.md` note file per chapter/section
- **NEVER** use the built-in WebFetch tool — always use Bing MCP for fetching web pages

The final response to user should be a brief confirmation showing the file path and a short summary, not the full note content.

## Glossary Filtering

User's English level: CET-4 612. Filter accordingly:
- **Include:** Technical terms (autowire, aspect, pointcut), low-frequency academic words
- **Skip:** Common vocabulary within CET-4 range
- Rule of thumb: Is this word common in general English? Is it Spring/Java-specific?

## Module Mapping

| URL/document title contains | → Save to |
|---|---|
| IoC / container / beans / dependencies | `core/` |
| AOP / aspect / pointcut / advice | `aop/` |
| MVC / controller / web / REST | `mvc/` |
| Boot / auto-configuration / starter | `boot/` |

When unsure, ask user which module.
