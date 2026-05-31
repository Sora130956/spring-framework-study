# Injection with `@Resource`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/resource.html

## 核心理解

`@Resource` 是 JSR-250（`jakarta.annotation.Resource`）定义的注入注解，Spring 对其提供了完整支持。它的默认语义是**按名称注入（by-name semantics）**——这与 `@Autowired` 的先按类型筛选截然不同。

当 `name` 属性被显式指定时，Spring 直接将其解析为 Bean 名称去容器中查找，这就是纯粹的 by-name 注入。

当 `name` 未显式指定时，`@Resource` 的行为分为两步：首先从字段名或 setter 方法名推导出默认的 Bean 名称进行按名称查找；**如果按名称找不到匹配的 Bean，它不会立即报错，而是回退（fallback）为按类型匹配**——此时行为类似于 `@Autowired`，会尝试在容器中寻找类型匹配的唯一 Bean，并支持 `@Primary` 等机制。

此外，`@Resource` 对 Spring 的知名可解析依赖类型（`BeanFactory`、`ApplicationContext`、`ResourceLoader`、`ApplicationEventPublisher`、`MessageSource`）会直接按类型注入，不经过名称查找。

## 关键点

### 显式指定 `name` — 纯按名称注入

> @Resource takes a name attribute. By default, Spring interprets that value as the bean name to be injected. In other words, it follows by-name semantics.

当 `@Resource(name="myMovieFinder")` 指定了 name 时，Spring **将这个名字解释（interprets）**为要注入的 Bean 名称，直接按名称查找：

```java
public class SimpleMovieLister {
    private MovieFinder movieFinder;

    @Resource(name="myMovieFinder")  // 直接找名为 "myMovieFinder" 的 Bean
    public void setMovieFinder(MovieFinder movieFinder) {
        this.movieFinder = movieFinder;
    }
}
```

### 未显式指定 `name` — 默认名称推导

> If no name is explicitly specified, the default name is derived from the field name or setter method. In case of a field, it takes the field name. In case of a setter method, it takes the bean property name.

默认名称推导规则：
- **字段注入：** 使用字段名（如 `movieFinder` → 查找名为 `"movieFinder"` 的 Bean）
- **setter 方法注入：** 使用 bean property 名（如 `setMovieFinder(...)` → 查找名为 `"movieFinder"` 的 Bean）

```java
public class SimpleMovieLister {
    private MovieFinder movieFinder;

    @Resource  // 未指定 name，默认查找名为 "movieFinder" 的 Bean
    public void setMovieFinder(MovieFinder movieFinder) {
        this.movieFinder = movieFinder;
    }
}
```

### 未指定 `name` 时的完整回退策略（两步走）

> In the exclusive case of @Resource usage with no explicit name specified, and similar to @Autowired, @Resource finds a primary type match instead of a specific named bean and resolves well known resolvable dependencies...

`@Resource` 在未指定 name 时的完整行为：

**第一步 — 按名称查找：** 从字段名/setter 方法名推导默认 Bean 名称，去容器中查找同名 Bean。如果找到 → 按名称注入，结束。

**第二步 — 按类型回退（fallback）：** 如果第一步按名称找不到匹配的 Bean，**不会立即报错**，而是退化为类似 `@Autowired` 的行为：按类型匹配，寻找唯一匹配的类型（支持 `@Primary` 等机制）。

```java
public class MovieRecommender {
    @Resource
    private CustomerPreferenceDao customerPreferenceDao;
    // 第一步：找名为 "customerPreferenceDao" 的 Bean
    // 如果没找到 → 第二步：按类型 CustomerPreferenceDao 匹配
    //   （支持 @Primary，能找到唯一类型匹配就注入）

    @Resource
    private ApplicationContext context;
    // ApplicationContext 是"知名可解析依赖"，直接按类型注入
}
```

### 知名可解析依赖（Well-known Resolvable Dependencies）

当 `@Resource` 未指定 name 时，以下 Spring 框架类型会被直接按类型注入，不经过名称查找：

- `BeanFactory`
- `ApplicationContext`
- `ResourceLoader`
- `ApplicationEventPublisher`
- `MessageSource`

## 句子解析

### 原文: "By default, Spring interprets that value as the bean name to be injected."

- **翻译:** 默认情况下，Spring 将该值解释为要注入的 Bean 名称。
- **解析:** `interprets ... as` = 将……解释为/理解为。`by default` = 默认情况下。`to be injected` 是不定式作后置定语修饰 `bean name`。

### 原文: "In other words, it follows by-name semantics, as demonstrated in the following example."

- **翻译:** 换句话说，它遵循按名称注入的语义，如下例所示。
- **解析:** `In other words` = 换句话说（换一种表达方式）。`follows by-name semantics` = 遵循按名称语义。`as demonstrated in` = 如……所示。

### 原文: "In the exclusive case of @Resource usage with no explicit name specified, and similar to @Autowired, @Resource finds a primary type match instead of a specific named bean..."

- **翻译:** 仅在未指定显式名称的 `@Resource` 使用场景中，与 `@Autowired` 类似，`@Resource` 会查找 primary 类型匹配而非特定名称的 Bean……
- **解析:** `In the exclusive case of` = 仅在……的情况下（`exclusive` 强调这是特例/排他性情况）。`with no explicit name specified` 中 `specified` 是过去分词作后置定语。`similar to` = 与……类似。整句说明这个 fallback 行为只在"未指定 name"时触发。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| interpret | v. | 解释，理解为 |
| derive | v. | 推导，派生 |
| fallback | n./adj. | 回退，后备（方案） |
| exclusive | adj. | 独有的，排他的，仅限……的 |
| explicitly | adv. | 显式地，明确地 |
| resolvable | adj. | 可解析的 |
| in other words | phr. | 换句话说 |
| by-name semantics | phr. | 按名称语义 |
| JNDI | abbr. | Java Naming and Directory Interface |
| indirection | n. | 间接性，间接层 |
