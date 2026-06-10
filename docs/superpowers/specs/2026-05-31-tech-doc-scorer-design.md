# Tech Doc Scorer — Skill Design

> **日期:** 2026-05-31 | **状态:** 待审批

## 1. 问题陈述

用户转型海外 freelancer，在 Upwork 接单，需要高效阅读 Spring Framework 官方文档。当前没有机制快速判断一个文档页面（或其 section）是否值得投入时间精读。需要一个新的 skill 在阅读前对文档进行"实用性打分"，做阅读优先级决策。

## 2. 目标

创建一个独立 skill，接收 Spring 文档 URL，对页面及 section 进行打分，输出仅限对话框，不落盘。

## 3. Skill 设计

### 3.1 名称

`tech-doc-scorer`

### 3.2 触发方式

- 显式调用：`/tech-doc-scorer <URL>`
- 自然语言：发 URL + "打分"/"评分"/"score"

### 3.3 核心流程

```
URL → Bing MCP 抓取页面内容
    → 解析页面结构（提取所有 <h2>/<h3> section 标题和内容）
    → 逐 section 评分（两个维度）
    → 生成评分报告（仅对话框输出）
```

### 3.4 存储位置

skill 文件存入 `C:\Users\Lawliet\.claude\skills\tech-doc-scorer.md`（用户级 skill），通过 skill-creator 创建。

## 4. 评分标准

### 4.1 日常开发实用指数（1-10，主维度）

评分视角：Upwork freelancer 在真实 Spring 项目中遇到这个东西的频率 + 重要性。

| 分数 | 含义 | 典型例子 |
|------|------|----------|
| 9-10 | 每个项目都离不开 | `@Autowired`、`@Component`、`application.properties` |
| 7-8 | 大多数项目会用到 | `@Qualifier`、`@Primary`、bean scopes |
| 5-6 | 特定场景常见 | `FactoryBean`、`BeanPostProcessor` |
| 3-4 | 偶尔有用，偏专 | 自定义 scope、JMX 集成 |
| 1-2 | 极少遇到，偏门/过时 | XSLT views、Portlet MVC |

### 4.2 面试指数（1-10，辅维度）

评分视角：海外面试（英文技术面试）中被问到的概率。

| 分数 | 含义 | 典型例子 |
|------|------|----------|
| 9-10 | 必考题 | IoC/DI 原理、bean 生命周期、构造注入 vs 字段注入 |
| 7-8 | 高频题 | bean scopes、AOP 基础、事务管理 |
| 5-6 | 偶尔出现 | `@Primary`/`@Qualifier` 区别、自动配置原理 |
| 3-4 | 为数不多 | 自定义 `BeanPostProcessor`、`FactoryBean` |
| 1-2 | 几乎不考 | 冷门 XML 配置细节、已废弃功能 |

## 5. 输出格式

### 5.1 总览

```
## 📊 文档评分: <页面标题>
> 来源: <URL>

**日常开发实用指数:** X/10 | **面试指数:** Y/10 | **建议:** 精读 / 选读 / 跳读
```

### 5.2 Section 明细（条件展开）

仅在 section 间最低分和最高分差距 >= 3 分时展开此表。若分差 < 3，改为一句话总结。

```
### Section 明细

| Section | 实用 | 面试 | 建议 |
|---------|------|------|------|
| 1.1 Bean Overview    | 8 | 9 | ⭐ 精读  |
| 1.2 Bean Scopes      | 7 | 8 | 📖 可读  |
| 1.3 Custom Scope     | 2 | 1 | ⏭️ 跳过  |
...
```

### 5.3 阅读建议

```
### 🎯 阅读建议
- **必读（>=7分）:** 1.1, 1.2
- **可读（4-6分）:** 1.5, 1.7
- **可跳过（<=3分）:** 1.3, 1.8
```

建议档位以**实用指数**为主，面试指数为辅——如果面试指数显著高于实用指数（差 >= 3），用 `💬 面试重点` 标注。

## 6. 与其他流程的关系

- **与笔记工作流完全独立**：打分后不自动触发笔记流程。用户自行决定是否发新的笔记请求。
- **不落盘**：评分报告仅在对话框中输出，不保存到仓库。
- **不影响 CLAUDE.md**：评分 skill 独立存在，不修改 CLAUDE.md 的工作流。

## 7. 实现路径

1. 通过 skill-creator 创建 `tech-doc-scorer` skill
2. Skill 内容包含：评分标准、输出模板、Bing MCP 抓取步骤
3. 在 CLAUDE.md 中可选地添加一句引用（如 "If you need to score a Spring doc page for relevance, invoke the /tech-doc-scorer skill"）
4. 手动测试：发一个 Spring 文档 URL 验证打分输出
