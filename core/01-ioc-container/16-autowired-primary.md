# Fine-tuning Annotation-based Autowiring with `@Primary` or `@Fallback`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-primary.html

## 核心理解

由于按类型自动装配（autowiring by type）可能匹配到多个候选 Bean，Spring 提供了两种 fine-tuning 手段来控制选择过程：`@Primary` 和 `@Fallback`。

`@Primary` 表示当存在多个同类型候选 Bean 时，该 Bean 应该被优先选择。如果候选者中恰好只有一个 `@Primary` Bean，它就会被注入。这是 Spring 一直以来的机制。

`@Fallback` 是 Spring 6.2 引入的新注解，语义与 `@Primary` 不同：它标注的是"后备"Bean —— 只有那些没有被标记为任何特殊角色（既不是 `@Primary` 也不是 `@Fallback`）的常规 Bean 才是首选。当常规 Bean 只剩一个时，它实际上就相当于 primary。如果连常规 Bean 都没有，才考虑 `@Fallback` Bean。

简单来说：**`@Primary` 是正向标记"我最优先"，而 `@Fallback` 是反向标记"我是备胎，实在没人才选我"**。两者的效果可以等价 —— 两个 Bean 时，标记其中一个为 `@Primary` 和标记另一个为 `@Fallback` 效果相同。

## 关键点

### `@Primary` — 标记首选 Bean

> `@Primary` indicates that a particular bean should be given preference when multiple beans are candidates to be autowired to a single-valued dependency. If exactly one primary bean exists among the candidates, it becomes the autowired value.

`@Primary` 注解明确告诉 Spring："在多个同类型候选者中，优先选我"。当恰好存在一个 primary bean 时，它就会成为注入值。

```java
@Configuration
public class MovieConfiguration {

    @Bean
    @Primary
    public MovieCatalog firstMovieCatalog() { ... }

    @Bean
    public MovieCatalog secondMovieCatalog() { ... }
}
```

```java
public class MovieRecommender {

    @Autowired
    private MovieCatalog movieCatalog;
    // movieCatalog → firstMovieCatalog（因为有 @Primary）
}
```

XML 中对应的配置方式是 `<bean>` 标签的 `primary="true"` 属性。

### `@Fallback` — 标记后备 Bean（Spring 6.2+）

> Alternatively, as of 6.2, there is a @Fallback annotation for demarcating any beans other than the regular ones to be injected. If only one regular bean is left, it is effectively primary as well.

Spring 6.2 新增了 `@Fallback` 注解。它的思路是区分三种角色：
1. **`@Primary` Bean** — 最优先
2. **Regular Bean（常规 Bean）** — 既没有 `@Primary` 也没有 `@Fallback`
3. **`@Fallback` Bean** — 最后的选择

如果没有 `@Primary` Bean，而常规 Bean 只剩一个，那这个常规 Bean 就相当于 primary。`@Fallback` 只有在没有其他更好的选择时才会被注入。

```java
@Configuration
public class MovieConfiguration {

    @Bean
    public MovieCatalog firstMovieCatalog() { ... }   // regular bean

    @Bean
    @Fallback
    public MovieCatalog secondMovieCatalog() { ... }   // 后备 bean
}
```

```java
public class MovieRecommender {

    @Autowired
    private MovieCatalog movieCatalog;
    // movieCatalog → firstMovieCatalog（常规 Bean 优先于 @Fallback）
}
```

### `@Primary` vs `@Fallback` 的语义差异

| | `@Primary` | `@Fallback` |
|---|---|---|
| 语义 | 正向提升某个 Bean 的优先级 | 反向降低某个 Bean 的优先级 |
| 版本 | 一直存在 | Spring 6.2+ |
| 效果（两个 Bean 时） | 标记优先级高的 | 标记优先级低的 |
| 多 Bean 场景 | 选出唯一的 primary | 排除 fallback 后，regular 中再选 |

## 句子解析

### 原文: "Because autowiring by type may lead to multiple candidates, it is often necessary to have more control over the selection process."

- **翻译:** 由于按类型自动装配可能会匹配到多个候选者，通常需要对选择过程进行更多控制。
- **解析:** `have more control over` 是常见搭配，表示"对……有更多控制"。`lead to` 后接名词，表示"导致/引发"。`it is necessary to` 是形式主语结构，真正的主语是 `to have more control...`。

### 原文: "Alternatively, as of 6.2, there is a @Fallback annotation for demarcating any beans other than the regular ones to be injected."

- **翻译:** 另一种方式是，从 6.2 版本开始，有一个 `@Fallback` 注解，用于标记那些"除常规 Bean 之外的"待注入 Bean。
- **解析:** `as of` = 从……开始（某个时间点/版本），是技术文档高频短语。`other than` = 除了……之外，修饰 `regular ones`。`demarcate` = 划定/标记界限，比 `mark` 更正式。整个 `for demarcating any beans (other than the regular ones) to be injected` 中，`other than the regular ones` 是插入修饰 `beans` 的，`to be injected` 是 `beans` 的后置定语。

### 原文: "If only one regular bean is left, it is effectively primary as well."

- **翻译:** 如果只剩下一个常规 Bean，它实际上也相当于 primary。
- **解析:** `is left` = 被剩下/留下。`effectively` = 实际上/事实上（虽然不是名义上的 primary，但效果等同）。`as well` = 也，放在句末。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| fine-tuning | n. | 微调，精细调整 |
| candidate | n. | 候选者 |
| demarcate | v. | 划定界限，标记 |
| regular | adj. | 常规的，普通的 |
| effectively | adv. | 实际上，实质上 |
| as of | prep. | 从……开始（某个时间点） |
| other than | prep. | 除了……之外 |
| preference | n. | 优先，偏好 |
| alternatively | adv. | 另一种方式是 |
