# Using `@Autowired`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html

## 核心理解

`@Autowired` 是 Spring 注解驱动注入的核心机制，由 `AutowiredAnnotationBeanPostProcessor` 这个 BeanPostProcessor 实现。它可以标注在构造器、方法、字段上，本质就是告诉 Spring："这个 Bean 需要什么依赖，帮我自动注入"。

注入规则的核心是**按类型匹配**。当有多个同类型 Bean 时，通过 `@Primary`（首选）、`@Order`（排序）、`@Fallback`（兜底）三级优先级来解决歧义。默认情况下注入是**必须的**（`required=true`），找不到匹配 Bean 就报错；但可以通过 `required=false` 或 `@Nullable` 声明为非必须。

一个关键限制：`@Autowired` 本身由 BeanPostProcessor 处理，所以在**自定义的 BeanPostProcessor 或 BeanFactoryPostProcessor 中不能用 `@Autowired`**——这些类必须显式使用 XML 或 `@Bean` 方法手动装配依赖。在 `@Configuration` 类中，同一个配置类内的 `@Bean` 方法之间互相引用属于自引用场景，需要通过懒解析或 `static @Bean` 来处理。

## 关键点

### @Autowired 标注在任意名称、多参数的方法上

> You can apply `@Autowired` to methods with **arbitrary names and multiple arguments**.

```java
public class MovieRecommender {
    private MovieCatalog movieCatalog;
    private CustomerPreferenceDao customerPreferenceDao;

    @Autowired
    public void prepare(MovieCatalog movieCatalog,
                        CustomerPreferenceDao customerPreferenceDao) {
        this.movieCatalog = movieCatalog;
        this.customerPreferenceDao = customerPreferenceDao;
    }
}
```

**`prepare` 方法不需要手动调用。Spring 容器在初始化 MovieRecommender Bean 时，会自动检测到 `@Autowired` 注解，并调用 `prepare` 方法，通过依赖注入把 `movieCatalog` 和 `customerPreferenceDao` 传进去。** 容器在初始化某个 Bean 时，会调用所有标注了 `@Autowired` 的方法。

### @Autowired 标注在字段上，可与构造器混用

> You can apply `@Autowired` to fields as well and even mix it with constructors.

```java
public class MovieRecommender {
    @Autowired
    private MovieCatalog movieCatalog;          // 字段注入

    private final CustomerPreferenceDao customerPreferenceDao;

    @Autowired
    public MovieRecommender(CustomerPreferenceDao customerPreferenceDao) {  // 构造器注入
        this.customerPreferenceDao = customerPreferenceDao;
    }
}
```

**字段注入和构造器注入可以混合使用。** Spring 先通过构造器创建实例，再注入标记了 `@Autowired` 的字段。

### 注入点声明的类型必须与目标 Bean 类型一致

> Make sure that your target components are consistently declared by the **type** that you use for your `@Autowired`-annotated injection points. Otherwise, injection may fail due to a "no type match found" error at runtime.

**场景 1：XML 或类路径扫描定义的 Bean** — 容器通常知道具体类型，不太会出问题。

**场景 2：`@Bean` 工厂方法** — 需要确保声明的返回类型**足够具体**：
```java
@Configuration
public class AppConfig {
    // 错误做法：返回类型太泛
    @Bean
    public Object movieCatalog() {  // 返回 Object，容器不知道具体类型
        return new MovieCatalog();
    }
}

// 注入时会报 "no type match found"
@Autowired
private MovieCatalog catalog;  // 期望 MovieCatalog，但注册的是 Object 类型
```

```java
// 正确做法：声明具体的返回类型
@Bean
public MovieCatalog movieCatalog() {  // 返回具体类型
    return new MovieCatalog();
}
```

如果 Bean 实现了多个接口，并且注入点可能按实现类来引用它，`@Bean` 方法的返回类型至少要跟注入点期望的类型一样具体。

### 同一 @Configuration 类中 @Bean 方法的自引用问题

> Trying to inject the results from `@Bean` methods in the same `@Configuration` class is effectively a **self-reference** scenario as well.

当一个 `@Configuration` 类用 `@Autowired` 字段来注入同一个配置类中 `@Bean` 方法产生的 Bean 时，会导致自引用问题。

**三种解决方式：**

1. **懒解析** — 在真正需要的方法签名中注入（而不是在配置类字段中用 `@Autowired`）：
```java
@Configuration
public class AppConfig {
    // 直接在 @Bean 方法参数中注入，而不是用 @Autowired 字段
    @Bean
    public TransferService transferService(AccountRepository repo) {
        return new TransferServiceImpl(repo);
    }

    @Bean
    public AccountRepository accountRepository() {
        return new JdbcAccountRepository();
    }
}
```

2. **声明为 `static @Bean`** — 将 `@Bean` 方法声明为 `static`，把它从配置类实例的生命周期中解耦出来：
```java
@Configuration
public class AppConfig {
    @Bean
    public static AccountRepository accountRepository() {
        return new JdbcAccountRepository();
    }
}
```

3. **不解决的情况** — 如果不做上述处理，这类 Bean 只会被放在 **fallback 阶段**考虑，其他配置类上的匹配 Bean 会被优先选为主候选。

### @Order 影响注入点优先级，不影响启动顺序

> `@Order` values may influence priorities at injection points, but be aware that they **do not** influence singleton startup order, which is an orthogonal concern determined by dependency relationships and `@DependsOn` declarations.

**@Order 影响什么？**

| 场景 | 行为 |
|---|---|
| `@Autowired` 注入单个 Bean | 多匹配时 `@Order` 值小的优先（配合 `@Primary`） |
| `@Autowired` 注入数组 / 集合 | 元素按 `@Order` 值**排序**后注入 |

**@Order 不影响什么？**
- **Singleton 启动顺序** — 这由 `@DependsOn` 和依赖关系决定，是独立的问题（orthogonal concern）。

> Each `@Bean` method needs to have its own `@Order` annotation which applies within a set of multiple matches for the specific bean type (as returned by the factory method).

每个 `@Bean` 方法需要有自己的 `@Order`，它在该类型的多个匹配候选之间生效。因为 `@Order` 不能标注在方法上（只用在类和方法级别的注解不同处理方式），每个方法返回的类型如果要排序，需要在 `@Bean` 方法级别单独标注。

### @Primary / @Order / @Fallback 三级优先级

> `@Order` values in combination with `@Primary` or `@Fallback` on a single bean for each type.

三者组合使用时，优先级为：**@Primary > @Order 排序 > @Fallback**。`@Primary` 和 `@Fallback` 标注在单个 Bean 上，`@Order` 可以标注在多个 Bean 上。

```java
@Configuration
public class MovieConfiguration {
    @Bean
    @Primary           // 第一优先级：首选
    public MovieCatalog primaryCatalog() { ... }

    @Bean
    @Order(1)          // 第二优先级：排序
    public MovieCatalog orderedCatalog() { ... }

    @Bean
    @Fallback          // 第三优先级：兜底
    public MovieCatalog fallbackCatalog() { ... }
}
```

### required=false — 非必须注入

> By default, autowiring fails when no matching candidate beans are available for a given injection point.

**普通注入点（单个 Bean）：** `@Autowired(required=true)`（默认）且没有匹配的 Bean → 容器启动时抛出 `NoSuchBeanDefinitionException`。

> A non-required method will not be called at all if its dependency is not available. A non-required field will not get populated at all in such cases, leaving its default value in place.

```java
@Component
public class SimpleMovieLister {
    @Autowired(required = false)
    private MovieFinder movieFinder;  // 如果没有 MovieFinder，保持 null

    @Autowired(required = false)
    public void setMovieFinder(@Nullable MovieFinder movieFinder) {
        // 如果没有 MovieFinder，这个方法根本不会被调用
    }
}
```

- 非必须的方法 → 依赖不可用时**方法直接不被调用**
- 非必须的字段 → 依赖不可用时**字段保持默认值**（通常 null）

### 构造器注入的规则

> If a class only declares a **single constructor** to begin with, it will always be used, even if not annotated. Note that an annotated constructor does not have to be public.

| 场景 | Spring 行为 |
|---|---|
| 只有一个构造器 | 自动使用，不需要 `@Autowired` |
| 多个构造器，都未标注 `@Autowired` | 选无参构造器（primary/default） |
| 多个构造器，一个标注了 `@Autowired` | 使用那个标注了的 |
| 多个构造器，多个标注了 `@Autowired` | 必须都设 `required=false`，选最匹配的 |
| 多个构造器，无无参构造器且无 `@Autowired` | **报错** |

`@Autowired` 构造器的访问修饰符无关紧要，`private` 也可以。

### @Nullable 用于可选注入

```java
public class SimpleMovieLister {
    @Autowired
    public void setMovieFinder(@Nullable MovieFinder movieFinder) {
        // movieFinder 可以是 null
    }
}
```

`@Nullable` 的效果等价于 `required=false`，但它是参数级别的，更细粒度。

### BeanPostProcessor / BeanFactoryPostProcessor 中不能使用 @Autowired

> The `@Autowired`, `@Inject`, `@Value`, and `@Resource` annotations are handled by Spring **BeanPostProcessor** implementations. This means that **you cannot apply these annotations within your own BeanPostProcessor or BeanFactoryPostProcessor types** (if any).

这些注解的处理器本身就是 BeanPostProcessor。你自定义的 BeanPostProcessor 在容器启动的早期被实例化——此时负责处理 `@Autowired` 的 `AutowiredAnnotationBeanPostProcessor` 可能还没就绪，所以你不能在自己写的 BeanPostProcessor 中用 `@Autowired`。这些类必须用 XML 或 `@Bean` 方法显式装配。

## 句子解析

### 原文: "Make sure that your target components are consistently declared by the type that you use for your @Autowired-annotated injection points."

- **翻译:** 确保你的目标组件声明时使用的类型，与你在标注 `@Autowired` 的注入点上使用的类型一致。
- **解析:** 主句是 "Make sure that..."，"declared by the type" 中的 "by the type" 表示声明方式。"that you use for your @Autowired-annotated injection points" 是定语从句修饰 "the type"，说明注入点使用的类型。

### 原文: "Trying to inject the results from @Bean methods in the same @Configuration class is effectively a self-reference scenario as well."

- **翻译:** 尝试在同一个 `@Configuration` 类中注入来自 `@Bean` 方法的结果，实际上也是一种自引用场景。
- **解析:** "Trying to inject..." 是动名词作主语。"effectively" = "实际上"，表示本质上等同于自引用。"as well" = "也"，这里暗示之前可能已经讨论了其他自引用场景。

### 原文: "@Order values may influence priorities at injection points, but be aware that they do not influence singleton startup order, which is an orthogonal concern determined by dependency relationships and @DependsOn declarations."

- **翻译:** `@Order` 值可能会影响注入点的优先级，但要注意它们不会影响 singleton 的启动顺序——这是一个独立的问题，由依赖关系和 `@DependsOn` 声明决定。
- **解析:** "orthogonal" = 正交的/独立的，这里指"启动顺序和注入优先级是两个互不相关的问题"。"an orthogonal concern" 是软件开发术语，表示一个与当前话题无关的、独立的关注点。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| arbitrary | adj. | 任意的（arbitrary names = 方法名任意） |
| fallback | n./adj. | 后备的、兜底的（兜底机制/备选方案） |
| precedence | n. | 优先权，优先级（@Primary 的优先级高于 @Order） |
| factor out | v. phrase | 提取、抽离（将代码从当前位置移出） |
| delegate | n. | 委托（将逻辑委托给另一个 Bean） |
| obtain | v. | 获得，得到 |
| orthogonal | adj. | 正交的、独立的（两个互不影响的问题） |
| overall | adj. | 整体的、全部的 |
| self-reference | n. | 自引用（同一配置类中的 @Bean 互相引用） |
| decouple | v. | 解耦（static @Bean 从配置类实例生命周期中解耦） |
| fallback phase | n. | 后备阶段（低优先级的 Bean 候选阶段） |

### 三级优先级体系

| 机制 | 优先级 | 用法 |
|------|--------|------|
| `@Primary` | 最高 | 标在单个首选 Bean 上 |
| `@Order` | 中间 | 标在多个 Bean 上决定排序，影响数组/集合注入顺序 |
| `@Fallback` | 最低 | 标在兜底 Bean 上，没有其他候选时才用它 |
