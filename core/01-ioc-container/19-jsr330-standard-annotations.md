# JSR-330 Standard Annotations — Spring vs Jakarta 对比 & 实践定位

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/standard-annotations.html
>
> **实用指数:** 7/10 | **面试指数:** 6/10

> 💡 本页 4 个 section，本次聚焦 Limitations 对比表 + Jakarta 定位问题。@Inject/@Named DI 用法和 `@Autowired`/`@Qualifier` 几乎一一对应，跳过。

## 核心理解

JSR-330（`jakarta.inject`）是 Java 标准的依赖注入规范，Spring 提供了对它的兼容支持。对于以海外 freelancer 为目标、主要接 Spring Boot 新项目的开发者来说，**这张对比表的价值在于：让你一眼看清 Spring 比 JSR-330 多了哪些能力，避免在实际项目中选错注解。**

关于 Jakarta 的定位：你的判断是对的——Jakarta EE 确实是"更底层"的标准规范（Servlet、JPA、Bean Validation），Spring 是对这些规范的实现和增强。海外 Upwork 上以 Spring Boot 新项目为主流，花太多精力在 Jakarta 原生注解上 ROI 不高。但**认识它们、能读懂别人代码里的 `@Inject` / `@Named` / `Provider`** 仍然有价值——尤其是在维护老项目或对接 Jakarta EE 背景的团队时。

---

## 关键点

### Spring vs JSR-330 对照表（带代码示例）

> Table 1. Spring component model versus JSR-330 variants

#### 1. `@Autowired` vs `@Inject`

**核心区别：** `@Inject` 没有 `required` 属性，必须配合 `Optional` 实现可选注入。

```java
// Spring: @Autowired 自带 required 属性
@Autowired(required = false)
private MovieFinder movieFinder;

// JSR-330: @Inject 无 required，用 Optional 替代
@Inject
private Optional<MovieFinder> movieFinder;

// 或用 @Nullable
@Inject
private @Nullable MovieFinder movieFinder;
```

> JSR-330 restrictions: `@Inject` has no `required` attribute. Can be used with Java's `Optional` instead.

#### 2. `@Component` vs `@Named`

**核心区别：** JSR-330 的 `@Named` 只是"给组件起名字"，**不是可组合的构造型模型**。你不能像 `@Service` 继承 `@Component` 那样，用 `@Named` 构建自定义构造型注解。

```java
// Spring: 可组合的构造型体系
@Component
public class SimpleMovieLister { }

@Service  // 继承 @Component，语义更明确
public class MovieService { }

// 可以创建自定义构造型
@Component
public @interface MyCustomComponent { }

// ==========

// JSR-330: @Named 不可组合
@Named
public class SimpleMovieLister { }

// ❌ 无法像 @Service 那样基于 @Named 创建自定义构造型
// @Named 只是标记"这是一个有名字的组件"，没有可组合的元注解能力
```

> JSR-330 does not provide a composable model, only a way to identify named components.

#### 3. `@Scope("singleton")` vs `@Singleton`

**核心区别：** JSR-330 的默认作用域像 Spring 的 prototype，但 Spring 为了保持一致性，在容器内把 JSR-330 Bean 默认当 singleton 管理。

```java
// Spring
@Scope("singleton")
@Component
public class MyService { }

@Scope("prototype")
@Component
public class MyPrototypeBean { }

// JSR-330: 只能用 @Singleton，没有 @Prototype
@Singleton
public class MyService { }

// ❌ @Singleton 只标记单例，要用其他 scope 必须回到 Spring 的 @Scope
```

> The JSR-330 default scope is like Spring's prototype. However, a JSR-330 bean declared in the Spring container is `singleton` by default. In order to use a scope other than `singleton`, you should use Spring's `@Scope` annotation.

#### 4. `@Qualifier` vs `@Qualifier` / `@Named`

**核心区别：** `jakarta.inject.Qualifier` 只是一个**元注解**（用来创建自定义 qualifier），不能像 Spring 的 `@Qualifier("xxx")` 那样直接带字符串值。要用字符串限定符，得搭配 `@Named`。

```java
// Spring: @Qualifier 直接带值
@Autowired
@Qualifier("main")
private MovieFinder movieFinder;

// JSR-330: @Qualifier 只能做元注解，字符串限定用 @Named
@Inject
@Named("main")
private MovieFinder movieFinder;
```

> `jakarta.inject.Qualifier` is just a meta-annotation for building custom qualifiers. Concrete String qualifiers can be associated through `jakarta.inject.Named`.

#### 5. `@Value` — JSR-330 无等价物

JSR-330 没有办法注入外部化配置属性。`@Value` 是 Spring 独有的能力。

#### 6. `@Lazy` — JSR-330 无等价物

延迟初始化也没有 JSR-330 替代品。

#### 7. `ObjectFactory` vs `Provider`

```java
// Spring: ObjectFactory
@Autowired
private ObjectFactory<MovieFinder> movieFinderFactory;
// 使用: movieFinderFactory.getObject()

// JSR-330: Provider（方法名更短）
@Inject
private Provider<MovieFinder> movieFinder;
// 使用: movieFinder.get()
```

> `jakarta.inject.Provider` is a direct alternative to Spring's `ObjectFactory`, only with a shorter `get()` method name.

### 速查总表

| 能力 | Spring | JSR-330 | 用哪个？ |
|------|--------|---------|---------|
| 依赖注入 | `@Autowired` | `@Inject` | 新项目用 Spring |
| 可选注入 | `@Autowired(required=false)` | `@Inject` + `Optional` | Spring 更简洁 |
| 组件标记 | `@Component` + 派生注解 | `@Named` | **必须 Spring**（可组合） |
| 作用域 | `@Scope` | `@Singleton` | **必须 Spring**（功能全） |
| 限定符 | `@Qualifier("xxx")` | `@Named("xxx")` | 都行，Spring 更灵活 |
| 属性注入 | `@Value` | ❌ | **只有 Spring** |
| 延迟加载 | `@Lazy` | ❌ | **只有 Spring** |
| 延迟获取 | `ObjectFactory` | `Provider` | 都行 |

---

## 句子解析

### 原文: "JSR-330 does not provide a composable model, only a way to identify named components."

- **翻译:** JSR-330 不提供可组合的模型，只提供了一种标识具名组件的方式。
- **解析:** `composable model` = "可组合模型"，指 Spring 的 `@Service` → `@Component` 这种元注解继承体系。`only a way to` = "仅仅是一种...的方式"，语气上强调了 JSR-330 的能力边界。

### 原文: "These annotations may optionally be used as alternatives to Spring annotations."

- **翻译:** 这些注解可以选择性地作为 Spring 注解的替代方案使用。
- **解析:** `may optionally be used` 是典型的文档语气——"可以选择性地使用"，暗示这是可选项而非推荐项。`as alternatives to` = "作为...的替代方案"。

---

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| composable | adj. | 可组合的；指可以通过元注解派生出新注解的能力 |
| variant | n. | 变体；`JSR-330 variants` = JSR-330 版本/对应物 |
| superset | n. | 超集；`ApplicationContext is a complete superset of BeanFactory` |
| standard | adj./n. | 标准的 / 规范；JSR = Java Specification Request |
| mandatory | adj. | 强制性的；`@Inject` has no `required` attribute = 没有强制属性 |
| meta-annotation | n. | 元注解；用于注解其他注解的注解 |
