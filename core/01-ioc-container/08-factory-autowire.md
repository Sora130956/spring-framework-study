# Autowiring Collaborators

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-autowire.html

## 核心理解

Spring 的自动装配（autowiring）让容器自动解析 bean 之间的依赖关系，省去手动指定 `<constructor-arg>` 或 `<property>` 的繁琐。四种模式中，`byType` 是最常用也最安全的——只要容器中该类型只有一个 bean，装配就自动完成；`byName` 按 bean 名称匹配，直觉但脆弱；`constructor` 类似 `byType` 但作用于构造参数；`no` 则是关闭自动装配。

自动装配的真正威力在于集合注入：当使用 `byType` 或 `constructor` 模式时，Spring 可以把容器中**所有**匹配类型的 bean 自动注入到一个数组、List 或 `Map<String, T>` 中。这意味着你可以零配置地实现插件式架构——新增一个实现类，它自动被收集到列表中，无需修改任何配置。

但自动装配不是银弹。官方文档强调"一致使用才最有效"——如果项目中只有少数几个 bean 用了 autowiring，反而会让配置变得令人困惑。可以结合 `defaultCandidate=false` 和 `@Qualifier` 精细控制哪些 bean 参与自动装配。

## 关键点

### Autowiring Modes（四种自动装配模式）

> Table 1. Autowiring modes

| Mode | 说明 |
|------|------|
| `no` | 默认值，不自动装配。必须显式指定依赖 |
| `byName` | 按属性名匹配 bean name。如果属性名为 `foo`，容器中恰好有名为 `foo` 的 bean，就注入它 |
| `byType` | 按属性类型匹配 bean。容器中**恰好有一个**该类型的 bean 时注入；多个则抛异常 |
| `constructor` | 类似 `byType`，但作用于构造器参数。如果容器中没有一个该类型的 bean，也会抛异常 |

**XML 配置示例：**

```xml
<!-- no mode (default) -->
<bean id="movieRecommender" class="example.MovieRecommender">
    <property name="movieFinder" ref="movieFinder"/>
</bean>

<!-- byName mode -->
<bean id="movieRecommender" class="example.MovieRecommender" autowire="byName"/>
<!-- 属性名为 movieFinder → 自动注入 id="movieFinder" 的 bean -->

<!-- byType mode -->
<bean id="movieRecommender" class="example.MovieRecommender" autowire="byType"/>
<!-- MovieFinder 类型只有一个实现 → 自动注入 -->

<!-- constructor mode -->
<bean id="movieRecommender" class="example.MovieRecommender" autowire="constructor"/>
<!-- 构造参数类型为 MovieFinder → 自动注入 -->
```

**Java 配置 / 注解方式：**

```java
@Component
public class MovieRecommender {

    // byType: 字段注入
    @Autowired
    private MovieFinder movieFinder;

    // constructor: 构造器注入（推荐方式，Spring 4.3+ 单构造器可省略 @Autowired）
    private final MovieFinder finder;

    public MovieRecommender(MovieFinder finder) {
        this.finder = finder;
    }

    // byName: 配合 @Qualifier 实现按名称匹配
    @Autowired
    @Qualifier("specificMovieFinder")
    private MovieFinder movieFinder;
}
```

### 集合 / 数组 / Map 的自动装配

> With byType or constructor autowiring mode, you can wire arrays and typed collections. In such cases, all autowire candidates within the container that match the expected type are provided to satisfy the dependency. You can autowire strongly-typed Map instances if the expected key type is String. An autowired Map instance's values consist of all bean instances that match the expected type, and the Map instance's keys contain the corresponding bean names.

当使用 `byType` 或 `constructor` 模式时，Spring 可以将容器中**所有**匹配类型的 bean 注入到集合中：

- `List<T>` / `Set<T>` / `T[]` — 所有 T 类型的 bean 实例
- `Map<String, T>` — key 是 bean name，value 是 T 类型的 bean 实例

**实际用途：** 这是实现**策略模式**或**插件式架构**的绝佳方式。例如：

```java
// 定义一个校验器接口
public interface Validator {
    void validate(Order order);
}

// 多个实现
@Component
public class AddressValidator implements Validator { ... }
@Component
public class PaymentValidator implements Validator { ... }
@Component
public class InventoryValidator implements Validator { ... }

// 自动收集所有 Validator 实现
@Component
public class OrderService {

    // Spring 自动注入所有 Validator 实现
    @Autowired
    private List<Validator> validators;

    // 或按名称索引
    @Autowired
    private Map<String, Validator> validatorMap;

    public void placeOrder(Order order) {
        // 遍历所有校验器
        validators.forEach(v -> v.validate(order));

        // 或按名称取出特定校验器
        validatorMap.get("paymentValidator").validate(order);
    }
}
```

新增一个校验器时，只需添加 `@Component`，无需修改 `OrderService`——这就是开闭原则（OCP）的优雅实现。

### 一致使用才最有效

> Autowiring works best when it is used consistently across a project.

官方文档的建议非常务实：自动装配要么全项目统一用，要么就少用。如果项目中只有少数几个 bean 用了 autowiring 而其他都是显式装配，会让后来维护的人摸不着头脑——不清楚依赖到底是自动绑定的还是手动指定的。在 Spring Boot 项目中，`@Autowired` 已成为事实标准，一致性这一点天然满足。

### defaultCandidate=false 与 @Qualifier 的配合

> a bean marked with defaultCandidate=false is only available for injection points where an additional qualifier indication is present.

通过 `defaultCandidate=false` 可以把某个 bean 排除在自动装配候选之外，但它仍然可以通过 `@Qualifier` 被精确引用：

```java
@Configuration
public class AppConfig {

    @Bean
    @Primary  // 默认注入这个
    public MovieFinder primaryMovieFinder() {
        return new PrimaryMovieFinder();
    }

    @Bean
    @Qualifier("secondary")  // 配合 @Qualifier 使用
    public MovieFinder secondaryMovieFinder() {
        return new SecondaryMovieFinder();
    }
}

// 使用时：
@Component
public class MovieRecommender {

    @Autowired
    private MovieFinder movieFinder;  // 注入 @Primary 的那个

    @Autowired
    @Qualifier("secondary")  // 精确指定要注入的 bean
    private MovieFinder anotherFinder;
}
```

`@Qualifier` 本质上就是一个"标签"——它给 bean 打上标记，注入时按标记匹配，解决 `byType` 模式下同一类型有多个 bean 的歧义问题。可以理解为：类型匹配是海选，`@Qualifier` 是决赛。

## 句子解析

### 原文: "On a per-bean basis, you can let Spring resolve collaborators automatically."

- **翻译:** 你可以基于每个 bean 的粒度，让 Spring 自动解析其协作者。
- **解析:** `on a ... basis` 是高频搭配，表示"以……为基础/以……为单位"。`per-bean` 中 `per` = "每个"，`per-bean basis` 就是"以每个 bean 为单位"——强调配置粒度为 bean 级别，而非全局一刀切。类似表达：`on a case-by-case basis`（具体问题具体分析）、`on a daily basis`（每天）。

### 原文: "As a consequence, autowiring by name nevertheless injects a bean if the name matches."

- **翻译:** 因此，按名称自动装配仍然会注入一个名字匹配的 bean（即使某些条件不满足）。
- **解析:** `nevertheless` = "尽管如此 / 然而"，表示转折。它比 `however` 更正式，常用于学术/技术文档中。句子逻辑：前面说了某种限制或规则 → `nevertheless` 表示"尽管有前述限制，按名称匹配仍然会生效"。

### 原文: "status"（在文档语境中）

- **翻译:** 身份、资格
- **解析:** 在这个上下文中 `status` 不是"状态"，而是指 bean 在自动装配系统中的"身份/资格"——即它是否具备被选为候选者的资格。类似"legal status"（法律地位）的用法。

### 原文: "In contrast, ..."

- **翻译:** 相比之下 / 与此相反
- **解析:** 用于对比两个对立情况。比 `but` / `however` 更精确，因为它暗示前后两者形成对照关系。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| autowire | v./n. | 自动装配（Spring IoC 容器自动解析 bean 依赖的机制） |
| collaborator | n. | 协作者（指一个 bean 所依赖的其他 bean） |
| candidate | n. | 候选者（有资格被注入的 bean） |
| qualifier | n. | 限定符（用于在多个同类型 bean 中精确指定要注入的 bean） |
| precedence | n. | 优先级 |
| resolution | n. | 解析（容器确定将哪个 bean 注入到依赖点的过程） |
| on a ... basis | phrase | 以……为基础/以……为单位 |
| nevertheless | adv. | 尽管如此、然而 |
| in contrast | phrase | 相比之下、与此相反 |
| inject | v. | 注入 |
| primary | adj. | 首选的（@Primary 标记的 bean 在同类型多个候选时优先注入） |
